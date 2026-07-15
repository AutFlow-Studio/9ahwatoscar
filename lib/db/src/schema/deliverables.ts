import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
  date,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { projectsTable } from "./projects";

export const deliverablesTable = pgTable("deliverables", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id")
    .notNull()
    .references(() => projectsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  status: text("status").notNull().default("pending"),
  deadline: date("deadline", { mode: "string" }),
  assignedTo: text("assigned_to"),
  completionDate: date("completion_date", { mode: "string" }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertDeliverableSchema = createInsertSchema(
  deliverablesTable,
).omit({ id: true, createdAt: true });
export type InsertDeliverable = z.infer<typeof insertDeliverableSchema>;
export type Deliverable = typeof deliverablesTable.$inferSelect;
