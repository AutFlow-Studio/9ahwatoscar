import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, meetingsTable, clientsTable, activityTable } from "@workspace/db";
import {
  ListMeetingsQueryParams,
  CreateMeetingBody,
  GetMeetingParams,
  UpdateMeetingParams,
  UpdateMeetingBody,
  DeleteMeetingParams,
} from "@workspace/api-zod";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";

const objectStorage = new ObjectStorageService();

/** Parse the JSON-encoded attachments array stored in the text column. */
function parseAttachmentPaths(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const items = JSON.parse(raw) as Array<{ objectPath?: string }>;
    return Array.isArray(items) ? items.map((i) => i.objectPath).filter((p): p is string => !!p) : [];
  } catch {
    return [];
  }
}

const router: IRouter = Router();

function mapMeeting(m: typeof meetingsTable.$inferSelect, clientName?: string | null) {
  return {
    ...m,
    clientName: clientName ?? null,
    date: m.date.toISOString(),
    nextMeeting: m.nextMeeting ? m.nextMeeting.toISOString() : null,
    createdAt: m.createdAt.toISOString(),
  };
}

router.get("/meetings", async (req, res): Promise<void> => {
  const parsed = ListMeetingsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { clientId } = parsed.data;

  const conditions = [];
  if (clientId) conditions.push(eq(meetingsTable.clientId, clientId));

  const rows = await db
    .select({ meeting: meetingsTable, clientName: clientsTable.companyName })
    .from(meetingsTable)
    .leftJoin(clientsTable, eq(meetingsTable.clientId, clientsTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(sql`${meetingsTable.date} DESC`);

  res.json(rows.map(({ meeting, clientName }) => mapMeeting(meeting, clientName)));
});

router.post("/meetings", async (req, res): Promise<void> => {
  const parsed = CreateMeetingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [meeting] = await db
    .insert(meetingsTable)
    .values({
      ...parsed.data,
      date: new Date(parsed.data.date),
      nextMeeting: parsed.data.nextMeeting ? new Date(parsed.data.nextMeeting) : null,
    })
    .returning();

  const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, meeting.clientId));

  await db.insert(activityTable).values({
    type: "meeting_logged",
    entityType: "meeting",
    entityId: meeting.id,
    description: `Meeting with "${client?.companyName ?? ""}" logged`,
    clientId: meeting.clientId,
  });

  res.status(201).json(mapMeeting(meeting, client?.companyName ?? null));
});

router.get("/meetings/:id", async (req, res): Promise<void> => {
  const params = GetMeetingParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [row] = await db
    .select({ meeting: meetingsTable, clientName: clientsTable.companyName })
    .from(meetingsTable)
    .leftJoin(clientsTable, eq(meetingsTable.clientId, clientsTable.id))
    .where(eq(meetingsTable.id, params.data.id));

  if (!row) {
    res.status(404).json({ error: "Meeting not found" });
    return;
  }

  res.json(mapMeeting(row.meeting, row.clientName));
});

router.patch("/meetings/:id", async (req, res): Promise<void> => {
  const params = UpdateMeetingParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateMeetingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = { ...parsed.data };
  if (updateData.date) updateData.date = new Date(updateData.date as string);
  if (updateData.nextMeeting) updateData.nextMeeting = new Date(updateData.nextMeeting as string);

  const [meeting] = await db
    .update(meetingsTable)
    .set(updateData)
    .where(eq(meetingsTable.id, params.data.id))
    .returning();

  if (!meeting) {
    res.status(404).json({ error: "Meeting not found" });
    return;
  }

  const clientName = (
    await db.select().from(clientsTable).where(eq(clientsTable.id, meeting.clientId))
  )[0]?.companyName;

  res.json(mapMeeting(meeting, clientName ?? null));
});

router.delete("/meetings/:id", async (req, res): Promise<void> => {
  const params = DeleteMeetingParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [meeting] = await db
    .delete(meetingsTable)
    .where(eq(meetingsTable.id, params.data.id))
    .returning();

  if (!meeting) {
    res.status(404).json({ error: "Meeting not found" });
    return;
  }

  // Fire-and-forget GCS cleanup for any file attachments
  const paths = parseAttachmentPaths(meeting.attachments);
  for (const objectPath of paths) {
    objectStorage
      .getObjectEntityFile(objectPath)
      .then((f) => f.delete())
      .catch(() => { /* already gone — ignore */ });
  }

  res.sendStatus(204);
});

export default router;
