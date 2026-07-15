import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { clientsTable } from "./clients";

export const meetingsTable = pgTable("meetings", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id")
    .notNull()
    .references(() => clientsTable.id, { onDelete: "cascade" }),
  date: timestamp("date", { withTimezone: true }).notNull(),
  summary: text("summary"),
  actionItems: text("action_items"),
  nextMeeting: timestamp("next_meeting", { withTimezone: true }),
  attachments: text("attachments"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertMeetingSchema = createInsertSchema(meetingsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertMeeting = z.infer<typeof insertMeetingSchema>;
export type Meeting = typeof meetingsTable.$inferSelect;
