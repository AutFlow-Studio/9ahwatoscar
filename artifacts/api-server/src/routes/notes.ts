import { Router, type IRouter } from "express";
import { eq, ilike, and, sql } from "drizzle-orm";
import { db, notesTable, clientsTable, activityTable } from "@workspace/db";
import {
  ListNotesQueryParams,
  CreateNoteBody,
  GetNoteParams,
  UpdateNoteParams,
  UpdateNoteBody,
  DeleteNoteParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function mapNote(n: typeof notesTable.$inferSelect, clientName?: string | null) {
  return {
    ...n,
    clientName: clientName ?? null,
    createdAt: n.createdAt.toISOString(),
    updatedAt: n.updatedAt.toISOString(),
  };
}

router.get("/notes", async (req, res): Promise<void> => {
  const parsed = ListNotesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { clientId, search } = parsed.data;

  const conditions = [];
  if (clientId) conditions.push(eq(notesTable.clientId, clientId));
  if (search) conditions.push(ilike(notesTable.content, `%${search}%`));

  const rows = await db
    .select({ note: notesTable, clientName: clientsTable.companyName })
    .from(notesTable)
    .leftJoin(clientsTable, eq(notesTable.clientId, clientsTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(sql`${notesTable.createdAt} DESC`);

  res.json(rows.map(({ note, clientName }) => mapNote(note, clientName)));
});

router.post("/notes", async (req, res): Promise<void> => {
  const parsed = CreateNoteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [note] = await db.insert(notesTable).values(parsed.data).returning();

  if (note.clientId) {
    const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, note.clientId));
    await db.insert(activityTable).values({
      type: "note_added",
      entityType: "note",
      entityId: note.id,
      description: `Note added`,
      clientId: note.clientId,
    });

    res.status(201).json(mapNote(note, client?.companyName ?? null));
    return;
  }

  res.status(201).json(mapNote(note, null));
});

router.get("/notes/:id", async (req, res): Promise<void> => {
  const params = GetNoteParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [row] = await db
    .select({ note: notesTable, clientName: clientsTable.companyName })
    .from(notesTable)
    .leftJoin(clientsTable, eq(notesTable.clientId, clientsTable.id))
    .where(eq(notesTable.id, params.data.id));

  if (!row) {
    res.status(404).json({ error: "Note not found" });
    return;
  }

  res.json(mapNote(row.note, row.clientName));
});

router.patch("/notes/:id", async (req, res): Promise<void> => {
  const params = UpdateNoteParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateNoteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [note] = await db
    .update(notesTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(notesTable.id, params.data.id))
    .returning();

  if (!note) {
    res.status(404).json({ error: "Note not found" });
    return;
  }

  const clientName = note.clientId
    ? (await db.select().from(clientsTable).where(eq(clientsTable.id, note.clientId)))[0]?.companyName
    : null;

  res.json(mapNote(note, clientName ?? null));
});

router.delete("/notes/:id", async (req, res): Promise<void> => {
  const params = DeleteNoteParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [note] = await db
    .delete(notesTable)
    .where(eq(notesTable.id, params.data.id))
    .returning();

  if (!note) {
    res.status(404).json({ error: "Note not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
