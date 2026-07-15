import { Router, type IRouter } from "express";
import { eq, sql, and } from "drizzle-orm";
import {
  db,
  clientsTable,
  projectsTable,
  paymentsTable,
  activityTable,
  meetingsTable,
  notesTable,
} from "@workspace/db";

const router: IRouter = Router();

router.get("/dashboard", async (req, res): Promise<void> => {
  const now = new Date();
  const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const thirtyDaysStr = thirtyDaysLater.toISOString().split("T")[0];
  const nowStr = now.toISOString().split("T")[0];

  const [
    allClients,
    allProjects,
    allPayments,
    recentActivityRows,
    upcomingMeetingRows,
    recentNoteRows,
  ] = await Promise.all([
    db.select().from(clientsTable),
    db
      .select({ project: projectsTable, clientName: clientsTable.companyName })
      .from(projectsTable)
      .leftJoin(clientsTable, eq(projectsTable.clientId, clientsTable.id)),
    db
      .select({ payment: paymentsTable, clientName: clientsTable.companyName })
      .from(paymentsTable)
      .leftJoin(clientsTable, eq(paymentsTable.clientId, clientsTable.id)),
    db
      .select({ activity: activityTable, clientName: clientsTable.companyName })
      .from(activityTable)
      .leftJoin(clientsTable, eq(activityTable.clientId, clientsTable.id))
      .orderBy(sql`${activityTable.createdAt} DESC`)
      .limit(10),
    db
      .select({ meeting: meetingsTable, clientName: clientsTable.companyName })
      .from(meetingsTable)
      .leftJoin(clientsTable, eq(meetingsTable.clientId, clientsTable.id))
      .where(sql`${meetingsTable.date} >= NOW()`)
      .orderBy(meetingsTable.date)
      .limit(5),
    db
      .select({ note: notesTable, clientName: clientsTable.companyName })
      .from(notesTable)
      .leftJoin(clientsTable, eq(notesTable.clientId, clientsTable.id))
      .orderBy(sql`${notesTable.createdAt} DESC`)
      .limit(5),
  ]);

  const totalClients = allClients.length;
  const activeClients = allClients.filter((c) => c.status === "active").length;

  const projects = allProjects.map(({ project, clientName }) => ({
    ...project,
    clientName: clientName ?? null,
    estimatedBudget: project.estimatedBudget ? Number(project.estimatedBudget) : null,
    actualCost: project.actualCost ? Number(project.actualCost) : null,
    revenue: project.revenue ? Number(project.revenue) : null,
    profit:
      project.revenue && project.actualCost
        ? Number(project.revenue) - Number(project.actualCost)
        : null,
    updatedAt: project.updatedAt.toISOString(),
    createdAt: project.createdAt.toISOString(),
  }));

  const projectsInProgress = projects.filter((p) =>
    ["design", "development", "testing", "review"].includes(p.status),
  ).length;
  const completedProjects = projects.filter((p) => p.status === "delivered").length;
  const delayedProjects = projects.filter(
    (p) => p.deadline && p.deadline < nowStr && p.status !== "delivered" && p.status !== "cancelled",
  ).length;

  const upcomingDeadlines = projects
    .filter(
      (p) =>
        p.deadline &&
        p.deadline >= nowStr &&
        p.deadline <= thirtyDaysStr &&
        p.status !== "delivered" &&
        p.status !== "cancelled",
    )
    .sort((a, b) => (a.deadline ?? "").localeCompare(b.deadline ?? ""))
    .slice(0, 5);

  const projectsAtRisk = projects.filter(
    (p) =>
      (p.deadline && p.deadline < nowStr && p.status !== "delivered" && p.status !== "cancelled") ||
      (p.progress < 30 && p.deadline && p.deadline <= thirtyDaysStr),
  ).slice(0, 5);

  const projectsNeedingAttention = projects
    .filter((p) => p.status === "paused" || p.status === "waiting" || (p.progress === 0 && p.status !== "planning" && p.status !== "cancelled"))
    .slice(0, 5);

  const invoicesAwaitingPayment = allPayments.filter(
    ({ payment }) => payment.status === "pending" || payment.status === "overdue",
  ).length;

  const totalRevenue = allPayments
    .filter(({ payment }) => payment.status === "paid")
    .reduce((sum, { payment }) => sum + Number(payment.amount), 0);

  const outstandingPayments = allPayments
    .filter(({ payment }) => payment.status === "pending" || payment.status === "overdue")
    .reduce((sum, { payment }) => sum + Number(payment.amount), 0);

  const recentActivity = recentActivityRows.map(({ activity, clientName }) => ({
    ...activity,
    clientName: clientName ?? null,
    createdAt: activity.createdAt.toISOString(),
  }));

  const upcomingMeetings = upcomingMeetingRows.map(({ meeting, clientName }) => ({
    ...meeting,
    clientName: clientName ?? null,
    date: meeting.date.toISOString(),
    nextMeeting: meeting.nextMeeting ? meeting.nextMeeting.toISOString() : null,
    createdAt: meeting.createdAt.toISOString(),
  }));

  const recentNotes = recentNoteRows.map(({ note, clientName }) => ({
    ...note,
    clientName: clientName ?? null,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
  }));

  res.json({
    totalClients,
    activeClients,
    projectsInProgress,
    completedProjects,
    delayedProjects,
    upcomingDeadlines,
    invoicesAwaitingPayment,
    totalRevenue,
    outstandingPayments,
    projectsAtRisk,
    recentActivity,
    upcomingMeetings,
    recentNotes,
    projectsNeedingAttention,
  });
});

export default router;
