import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, activityTable, clientsTable } from "@workspace/db";
import { ListActivityQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/activity", async (req, res): Promise<void> => {
  const parsed = ListActivityQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const limit = parsed.data.limit ?? 50;

  const rows = await db
    .select({ activity: activityTable, clientName: clientsTable.companyName })
    .from(activityTable)
    .leftJoin(clientsTable, eq(activityTable.clientId, clientsTable.id))
    .orderBy(sql`${activityTable.createdAt} DESC`)
    .limit(limit);

  res.json(
    rows.map(({ activity, clientName }) => ({
      ...activity,
      clientName: clientName ?? null,
      createdAt: activity.createdAt.toISOString(),
    })),
  );
});

export default router;
