import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { requireOwner } from "../middleware/auth";

const router: IRouter = Router();

// Demo-data reset: irreversibly truncates every table so the app can be
// re-seeded from a clean slate. Gated behind an explicit confirmation
// dialog in the UI and restricted to owners only.
router.post("/admin/reset", requireOwner, async (req, res): Promise<void> => {
  await db.execute(sql`
    TRUNCATE TABLE
      activity,
      deliverables,
      documents,
      meetings,
      notes,
      payments,
      tasks,
      projects,
      clients
    RESTART IDENTITY CASCADE
  `);

  res.json({ success: true });
});

export default router;
