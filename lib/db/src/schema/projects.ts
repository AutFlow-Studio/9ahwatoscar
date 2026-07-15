import {
  pgTable,
  text,
  serial,
  timestamp,
  numeric,
  integer,
  date,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { clientsTable } from "./clients";

export const projectsTable = pgTable("projects", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id")
    .notNull()
    .references(() => clientsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  status: text("status").notNull().default("planning"),
  priority: text("priority").notNull().default("medium"),
  progress: integer("progress").notNull().default(0),
  startDate: date("start_date", { mode: "string" }),
  deadline: date("deadline", { mode: "string" }),
  estimatedBudget: numeric("estimated_budget", { precision: 15, scale: 2 }),
  actualCost: numeric("actual_cost", { precision: 15, scale: 2 }),
  revenue: numeric("revenue", { precision: 15, scale: 2 }),
  description: text("description"),
  ownerNotes: text("owner_notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertProjectSchema = createInsertSchema(projectsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projectsTable.$inferSelect;
