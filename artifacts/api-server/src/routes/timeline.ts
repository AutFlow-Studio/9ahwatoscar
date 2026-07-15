import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, activityTable } from "@workspace/db";
import { GetClientTimelineParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/clients/:clientId/timeline", async (req, res): Promise<void> => {
  const params = GetClientTimelineParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const events = await db
    .select()
    .from(activityTable)
    .where(eq(activityTable.clientId, params.data.clientId))
    .orderBy(sql`${activityTable.createdAt} DESC`);

  res.json(
    events.map((e) => ({
      id: e.id,
      clientId: e.clientId,
      type: e.type,
      description: e.description,
      occurredAt: e.createdAt.toISOString(),
    })),
  );
});

export default router;
