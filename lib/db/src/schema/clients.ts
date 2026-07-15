import {
  pgTable,
  text,
  serial,
  timestamp,
  numeric,
  date,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const clientsTable = pgTable("clients", {
  id: serial("id").primaryKey(),
  companyName: text("company_name").notNull(),
  logoUrl: text("logo_url"),
  industry: text("industry"),
  website: text("website"),
  email: text("email"),
  phone: text("phone"),
  primaryContact: text("primary_contact"),
  secondaryContact: text("secondary_contact"),
  address: text("address"),
  timezone: text("timezone"),
  status: text("status").notNull().default("active"),
  startDate: date("start_date", { mode: "string" }),
  contractValue: numeric("contract_value", { precision: 15, scale: 2 }),
  monthlyRetainer: numeric("monthly_retainer", { precision: 15, scale: 2 }),
  paymentMethod: text("payment_method"),
  notes: text("notes"),
  tags: text("tags").array().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertClientSchema = createInsertSchema(clientsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clientsTable.$inferSelect;
