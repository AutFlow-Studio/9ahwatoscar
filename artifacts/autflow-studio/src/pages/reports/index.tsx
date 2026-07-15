import { useGetReportsOverview, useGetRevenueReport } from "@workspace/api-client-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from "recharts";

export default function ReportsView() {
  const { data: overview, isLoading: isOverviewLoading } = useGetReportsOverview();
  const { data: revenue, isLoading: isRevenueLoading } = useGetRevenueReport();

  if (isOverviewLoading || isRevenueLoading || !overview || !revenue) {
    return (
      <div className="space-y-6">
        <PageHeader title="Reports" description="Agency performance and analytics" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-[400px] rounded-xl" />
          <Skeleton className="h-[400px] rounded-xl" />
        </div>
      </div>
    );
  }

  const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

  return (
    <div className="space-y-6 pb-12">
      <PageHeader title="Reports" description="Agency performance and analytics" />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card/40 backdrop-blur-sm border-border/50">
          <CardContent className="p-5">
            <div className="text-sm font-medium text-muted-foreground mb-1">Total Revenue YTD</div>
            <div className="text-2xl font-bold font-mono text-emerald-500">${overview.totalRevenue.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card className="bg-card/40 backdrop-blur-sm border-border/50">
          <CardContent className="p-5">
            <div className="text-sm font-medium text-muted-foreground mb-1">Total Collected</div>
            <div className="text-2xl font-bold font-mono">${overview.totalPaid.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card className="bg-card/40 backdrop-blur-sm border-border/50">
          <CardContent className="p-5">
            <div className="text-sm font-medium text-muted-foreground mb-1">Outstanding Invoices</div>
            <div className="text-2xl font-bold font-mono">${overview.outstandingPayments.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card className="bg-card/40 backdrop-blur-sm border-border/50">
          <CardContent className="p-5">
            <div className="text-sm font-medium text-muted-foreground mb-1">Active Projects</div>
            <div className="text-2xl font-bold">{overview.totalProjects}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Revenue Chart */}
        <Card className="bg-card/40 backdrop-blur-sm border-border/50">
          <CardHeader>
            <CardTitle>Monthly Revenue</CardTitle>
            <p className="text-xs text-muted-foreground">Last 11 months, through the current month</p>
          </CardHeader>
          <CardContent className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenue.byMonth} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="monthLabel" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(value) => `$${value/1000}k`} />
                <RechartsTooltip 
                  cursor={{ fill: 'hsl(var(--secondary))' }}
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '0.5rem' }}
                  formatter={(value: number) => [`$${value.toLocaleString()}`, 'Revenue']}
                />
                <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
                  {revenue.byMonth.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === revenue.byMonth.length - 1 ? 'hsl(var(--primary))' : 'hsl(var(--primary) / 0.5)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Project Status Distribution */}
        <Card className="bg-card/40 backdrop-blur-sm border-border/50">
          <CardHeader>
            <CardTitle>Projects by Status</CardTitle>
          </CardHeader>
          <CardContent className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={overview.projectsByStatus}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={120}
                  paddingAngle={5}
                  dataKey="count"
                  nameKey="status"
                >
                  {overview.projectsByStatus.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '0.5rem' }}
                  formatter={(value: number, name: string) => [value, name.replace('_', ' ')]}
                />
                <Legend layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{ fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Client Revenue Breakdown */}
        <Card className="lg:col-span-2 bg-card/40 backdrop-blur-sm border-border/50">
          <CardHeader>
            <CardTitle>Revenue by Client</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {revenue.byClient.sort((a,b) => b.revenue - a.revenue).map((client, index) => {
                const maxRevenue = Math.max(...revenue.byClient.map(c => c.revenue));
                const percentage = maxRevenue > 0 ? (client.revenue / maxRevenue) * 100 : 0;
                
                return (
                  <div key={client.clientId} className="grid grid-cols-12 items-center gap-4">
                    <div className="col-span-4 sm:col-span-3 font-medium text-sm truncate">{client.clientName}</div>
                    <div className="col-span-5 sm:col-span-7 h-2 bg-secondary rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full" 
                        style={{ width: `${percentage}%`, backgroundColor: COLORS[index % COLORS.length] }}
                      />
                    </div>
                    <div className="col-span-3 sm:col-span-2 text-right font-mono text-sm font-bold">
                      ${client.revenue.toLocaleString()}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}