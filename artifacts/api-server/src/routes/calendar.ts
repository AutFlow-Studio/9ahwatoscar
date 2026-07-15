import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { db, projectsTable, meetingsTable, paymentsTable, clientsTable } from "@workspace/db";
import { GetCalendarQueryParams } from "@workspace/api-zod";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

router.get("/calendar", async (req, res): Promise<void> => {
  const parsed = GetCalendarQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const events: Array<{
    id: string;
    type: string;
    title: string;
    date: string;
    clientId: number | null;
    clientName: string | null;
    entityId: number | null;
  }> = [];

  // Collect project deadlines
  const projects = await db
    .select({ project: projectsTable, clientName: clientsTable.companyName })
    .from(projectsTable)
    .leftJoin(clientsTable, eq(projectsTable.clientId, clientsTable.id))
    .where(sql`${projectsTable.deadline} IS NOT NULL`);

  for (const { project, clientName } of projects) {
    if (project.deadline) {
      events.push({
        id: `deadline-${project.id}`,
        type: "deadline",
        title: `${project.name} Deadline`,
        date: project.deadline,
        clientId: project.clientId,
        clientName: clientName ?? null,
        entityId: project.id,
      });
    }
  }

  // Collect meetings
  const meetings = await db
    .select({ meeting: meetingsTable, clientName: clientsTable.companyName })
    .from(meetingsTable)
    .leftJoin(clientsTable, eq(meetingsTable.clientId, clientsTable.id));

  for (const { meeting, clientName } of meetings) {
    events.push({
      id: `meeting-${meeting.id}`,
      type: "meeting",
      title: `Meeting: ${clientName ?? "Unknown"}`,
      date: meeting.date.toISOString().split("T")[0],
      clientId: meeting.clientId,
      clientName: clientName ?? null,
      entityId: meeting.id,
    });

    if (meeting.nextMeeting) {
      events.push({
        id: `nextmeeting-${meeting.id}`,
        type: "meeting",
        title: `Upcoming Meeting: ${clientName ?? "Unknown"}`,
        date: meeting.nextMeeting.toISOString().split("T")[0],
        clientId: meeting.clientId,
        clientName: clientName ?? null,
        entityId: meeting.id,
      });
    }
  }

  // Collect payment due dates
  const payments = await db
    .select({ payment: paymentsTable, clientName: clientsTable.companyName })
    .from(paymentsTable)
    .leftJoin(clientsTable, eq(paymentsTable.clientId, clientsTable.id))
    .where(sql`${paymentsTable.dueDate} IS NOT NULL AND ${paymentsTable.status} IN ('pending', 'overdue')`);

  for (const { payment, clientName } of payments) {
    if (payment.dueDate) {
      events.push({
        id: `payment-${payment.id}`,
        type: "payment_due",
        title: `Invoice ${payment.invoiceNumber} Due`,
        date: payment.dueDate,
        clientId: payment.clientId,
        clientName: clientName ?? null,
        entityId: payment.id,
      });
    }
  }

  // Sort by date
  events.sort((a, b) => a.date.localeCompare(b.date));

  res.json(events);
});

export default router;
