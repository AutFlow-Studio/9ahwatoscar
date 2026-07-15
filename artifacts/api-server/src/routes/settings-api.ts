import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, agencySettingsTable } from "@workspace/db";
import { requireAuth } from "../middleware/auth";

const router: IRouter = Router();

/** Get the singleton agency settings row, creating defaults if absent. */
async function getOrCreateSettings() {
  const [existing] = await db.select().from(agencySettingsTable).limit(1);
  if (existing) return existing;
  const [created] = await db.insert(agencySettingsTable).values({}).returning();
  return created;
}

// GET /api/settings/agency
router.get("/settings/agency", requireAuth, async (req, res): Promise<void> => {
  const settings = await getOrCreateSettings();
  res.json({
    ...settings,
    taxRate: settings.taxRate ? Number(settings.taxRate) : 0,
  });
});

// PUT /api/settings/agency
router.put("/settings/agency", requireAuth, async (req, res): Promise<void> => {
  const {
    agencyName,
    agencyEmail,
    website,
    supportEmail,
    logoUrl,
    defaultCurrency,
    timezone,
    invoicePrefix,
    paymentTermsDays,
    taxRate,
    notifyInvoicePaid,
    notifyDeadlineApproaching,
    notifyWeeklyDigest,
  } = req.body ?? {};

  const updates: Record<string, unknown> = {};
  if (agencyName !== undefined) updates.agencyName = String(agencyName).trim();
  if (agencyEmail !== undefined) updates.agencyEmail = String(agencyEmail).trim();
  if (website !== undefined) updates.website = website ? String(website).trim() : null;
  if (supportEmail !== undefined) updates.supportEmail = supportEmail ? String(supportEmail).trim() : null;
  if (logoUrl !== undefined) updates.logoUrl = logoUrl ? String(logoUrl).trim() : null;
  if (defaultCurrency !== undefined) updates.defaultCurrency = String(defaultCurrency).trim();
  if (timezone !== undefined) updates.timezone = String(timezone).trim();
  if (invoicePrefix !== undefined) updates.invoicePrefix = String(invoicePrefix).trim();
  if (paymentTermsDays !== undefined) updates.paymentTermsDays = Number(paymentTermsDays);
  if (taxRate !== undefined) updates.taxRate = String(Number(taxRate));
  if (notifyInvoicePaid !== undefined) updates.notifyInvoicePaid = Boolean(notifyInvoicePaid);
  if (notifyDeadlineApproaching !== undefined)
    updates.notifyDeadlineApproaching = Boolean(notifyDeadlineApproaching);
  if (notifyWeeklyDigest !== undefined) updates.notifyWeeklyDigest = Boolean(notifyWeeklyDigest);

  // Ensure the row exists
  const existing = await getOrCreateSettings();
  const [updated] = await db
    .update(agencySettingsTable)
    .set(updates)
    .where(eq(agencySettingsTable.id, existing.id))
    .returning();

  const result = updated ?? existing;
  res.json({ ...result, taxRate: result.taxRate ? Number(result.taxRate) : 0 });
});

export default router;
