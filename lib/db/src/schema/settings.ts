import {
  pgTable,
  text,
  serial,
  timestamp,
  boolean,
  numeric,
  integer,
} from "drizzle-orm/pg-core";

export const agencySettingsTable = pgTable("agency_settings", {
  id: serial("id").primaryKey(),
  agencyName: text("agency_name").notNull().default("AutFlow Studio"),
  agencyEmail: text("agency_email").notNull().default("hello@autflowstudio.com"),
  website: text("website"),
  supportEmail: text("support_email"),
  logoUrl: text("logo_url"),
  defaultCurrency: text("default_currency").notNull().default("USD"),
  timezone: text("timezone").notNull().default("UTC"),
  invoicePrefix: text("invoice_prefix").notNull().default("INV"),
  paymentTermsDays: integer("payment_terms_days").notNull().default(30),
  taxRate: numeric("tax_rate", { precision: 5, scale: 2 }).notNull().default("0"),
  notifyInvoicePaid: boolean("notify_invoice_paid").notNull().default(true),
  notifyDeadlineApproaching: boolean("notify_deadline_approaching").notNull().default(true),
  notifyWeeklyDigest: boolean("notify_weekly_digest").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type AgencySettings = typeof agencySettingsTable.$inferSelect;
