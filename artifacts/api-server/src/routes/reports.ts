import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, clientsTable, projectsTable, paymentsTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/reports/overview", async (req, res): Promise<void> => {
  const [clients, projects, payments] = await Promise.all([
    db.select().from(clientsTable),
    db.select().from(projectsTable),
    db.select().from(paymentsTable),
  ]);

  const totalClients = clients.length;
  const activeClients = clients.filter((c) => c.status === "active").length;
  const totalProjects = projects.length;

  // Projects by status
  const statusCounts: Record<string, number> = {};
  for (const p of projects) {
    statusCounts[p.status] = (statusCounts[p.status] ?? 0) + 1;
  }
  const projectsByStatus = Object.entries(statusCounts).map(([status, count]) => ({
    status,
    count,
  }));

  const totalRevenue = payments
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + Number(p.amount), 0);

  const outstandingPayments = payments
    .filter((p) => p.status === "pending")
    .reduce((sum, p) => sum + Number(p.amount), 0);

  const overduePayments = payments
    .filter((p) => p.status === "overdue")
    .reduce((sum, p) => sum + Number(p.amount), 0);

  const totalPaid = payments
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + Number(p.amount), 0);

  res.json({
    totalClients,
    activeClients,
    totalProjects,
    projectsByStatus,
    totalRevenue,
    outstandingPayments,
    overduePayments,
    totalPaid,
  });
});

router.get("/reports/revenue", async (req, res): Promise<void> => {
  const [clients, payments] = await Promise.all([
    db.select().from(clientsTable),
    db.select().from(paymentsTable),
  ]);

  const clientMap = Object.fromEntries(clients.map((c) => [c.id, c.companyName]));

  const totalRevenue = payments
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + Number(p.amount), 0);

  const totalOutstanding = payments
    .filter((p) => p.status === "pending")
    .reduce((sum, p) => sum + Number(p.amount), 0);

  const totalOverdue = payments
    .filter((p) => p.status === "overdue")
    .reduce((sum, p) => sum + Number(p.amount), 0);

  // By client
  const clientRevMap: Record<number, { revenue: number; outstanding: number }> = {};
  for (const p of payments) {
    if (!clientRevMap[p.clientId]) {
      clientRevMap[p.clientId] = { revenue: 0, outstanding: 0 };
    }
    if (p.status === "paid") clientRevMap[p.clientId].revenue += Number(p.amount);
    if (p.status === "pending" || p.status === "overdue")
      clientRevMap[p.clientId].outstanding += Number(p.amount);
  }

  const byClient = Object.entries(clientRevMap).map(([clientId, data]) => ({
    clientId: Number(clientId),
    clientName: clientMap[Number(clientId)] ?? "Unknown",
    revenue: data.revenue,
    outstanding: data.outstanding,
  }));

  // By month -- always the latest 11 months anchored to the current date,
  // including months with zero revenue, so the chart reflects "now" rather
  // than whatever historical data happens to exist.
  const monthRevMap: Record<string, { revenue: number; collected: number }> = {};
  for (const p of payments) {
    const date = p.paidDate ?? p.dueDate ?? p.createdAt.toISOString().split("T")[0];
    const month = date.substring(0, 7); // YYYY-MM
    if (!monthRevMap[month]) monthRevMap[month] = { revenue: 0, collected: 0 };
    monthRevMap[month].revenue += Number(p.amount);
    if (p.status === "paid") monthRevMap[month].collected += Number(p.amount);
  }

  const MONTH_LABELS = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const now = new Date();
  const months: string[] = [];
  for (let i = 10; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  const byMonth = months.map((month) => {
    const [yearStr, monthStr] = month.split("-");
    const data = monthRevMap[month] ?? { revenue: 0, collected: 0 };
    return {
      month,
      monthLabel: `${MONTH_LABELS[Number(monthStr) - 1]} '${yearStr!.slice(-2)}`,
      ...data,
    };
  });

  res.json({ totalRevenue, totalOutstanding, totalOverdue, byClient, byMonth });
});

export default router;
