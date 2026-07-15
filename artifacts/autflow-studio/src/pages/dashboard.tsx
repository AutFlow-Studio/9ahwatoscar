import { useGetDashboard, useResetDemoData } from "@workspace/api-client-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Users, 
  Briefcase, 
  AlertCircle, 
  CreditCard, 
  TrendingUp, 
  Clock, 
  Calendar,
  FileText,
  Plus,
  Printer,
  Trash2,
} from "lucide-react";
import { format } from "date-fns";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { StatusBadge, getProjectStatusVariant } from "@/components/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

function ClearDashboardDataDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { mutate: resetDemoData, isPending } = useResetDemoData();

  function handleConfirm() {
    resetDemoData(undefined, {
      onSuccess: () => {
        // Every list/detail page reads through react-query, so a full
        // invalidation is the simplest way to guarantee nothing shows
        // stale data after a destructive reset.
        queryClient.invalidateQueries();
        toast({ title: "Data cleared", description: "All demo data has been reset." });
        onOpenChange(false);
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to clear data.", variant: "destructive" });
      },
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Clear all dashboard data?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes every client, project, invoice, document, meeting, note, and task in the app.
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending ? "Clearing…" : "Clear Data"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default function Dashboard() {
  const { data: stats, isLoading } = useGetDashboard();
  const [clearDialogOpen, setClearDialogOpen] = useState(false);

  if (isLoading || !stats) {
    return (
      <div className="space-y-6">
        <PageHeader title="Command Center" description="Your agency at a glance" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-[400px] lg:col-span-2 rounded-xl" />
          <Skeleton className="h-[400px] rounded-xl" />
        </div>
      </div>
    );
  }

  const quickActions = [
    { label: "New Client", icon: Users, href: "/clients" },
    { label: "New Project", icon: Briefcase, href: "/projects" },
    { label: "New Task", icon: Plus, href: "/tasks" },
    { label: "New Invoice", icon: CreditCard, href: "/payments" },
  ];

  return (
    <div className="space-y-8 pb-8">
      <ClearDashboardDataDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen} />

      {/* Printable header -- only visible when printing */}
      <div className="hidden print:block mb-6">
        <h1 className="text-2xl font-bold">Command Center — Stats Report</h1>
        <p className="text-sm text-muted-foreground">{format(new Date(), "EEEE, MMMM do, yyyy 'at' h:mm a")}</p>
      </div>

      <PageHeader title="Command Center" description={format(new Date(), "EEEE, MMMM do, yyyy")}>
        <div className="flex gap-2 print:hidden">
          {quickActions.map(action => (
            <Link key={action.label} href={action.href}>
              <Button size="sm" variant="outline" className="hidden md:flex gap-2">
                <action.icon size={14} />
                {action.label}
              </Button>
            </Link>
          ))}
          <Button size="sm" variant="outline" className="hidden md:flex gap-2" onClick={() => window.print()}>
            <Printer size={14} />
            Print
          </Button>
          <Button size="sm" variant="outline" className="hidden md:flex gap-2 text-destructive hover:text-destructive" onClick={() => setClearDialogOpen(true)}>
            <Trash2 size={14} />
            Clear
          </Button>
          <Link href="/clients">
            <Button size="sm" className="md:hidden">
              <Plus size={16} />
            </Button>
          </Link>
        </div>
      </PageHeader>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card/40 backdrop-blur-sm border-border/50 hover:bg-card/60 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Clients</CardTitle>
            <Users className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.activeClients}</div>
            <p className="text-xs text-muted-foreground mt-1">Out of {stats.totalClients} total</p>
          </CardContent>
        </Card>
        
        <Card className="bg-card/40 backdrop-blur-sm border-border/50 hover:bg-card/60 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Projects in Progress</CardTitle>
            <Briefcase className="w-4 h-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.projectsInProgress}</div>
            <p className="text-xs text-muted-foreground mt-1">{stats.completedProjects} completed</p>
          </CardContent>
        </Card>

        <Card className="bg-card/40 backdrop-blur-sm border-border/50 hover:bg-card/60 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Unpaid Invoices</CardTitle>
            <AlertCircle className="w-4 h-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.invoicesAwaitingPayment}</div>
            <p className="text-xs text-muted-foreground mt-1">
              ${stats.outstandingPayments.toLocaleString()} outstanding
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/40 backdrop-blur-sm border-border/50 hover:bg-card/60 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Monthly Revenue</CardTitle>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">${stats.totalRevenue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">Collected this month</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Feed area */}
        <div className="lg:col-span-2 space-y-6">
          {/* Projects at Risk */}
          {stats.projectsAtRisk.length > 0 && (
            <Card className="border-destructive/30 bg-destructive/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-destructive">
                  <AlertCircle size={16} />
                  Projects at Risk
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3">
                {stats.projectsAtRisk.map(project => (
                  <Link key={project.id} href={`/projects/${project.id}`}>
                    <div className="flex items-center justify-between p-3 rounded-md bg-background/50 hover:bg-background/80 transition-colors cursor-pointer border border-destructive/10">
                      <div className="flex flex-col">
                        <span className="font-semibold text-sm">{project.name}</span>
                        <span className="text-xs text-muted-foreground">{project.clientName}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <StatusBadge variant={getProjectStatusVariant(project.status)}>
                          {project.status.replace("_", " ")}
                        </StatusBadge>
                        <div className="text-xs font-mono text-destructive">
                          {project.deadline ? format(new Date(project.deadline), "MMM d") : "No deadline"}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Upcoming Deadlines */}
          <Card className="border-border/50 bg-card/40 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Clock size={16} className="text-primary" />
                Upcoming Deadlines
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats.upcomingDeadlines.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground text-sm">No upcoming deadlines.</div>
              ) : (
                <div className="grid gap-2">
                  {stats.upcomingDeadlines.map(project => (
                    <Link key={project.id} href={`/projects/${project.id}`}>
                      <div className="flex items-center justify-between p-3 rounded-md bg-secondary/30 hover:bg-secondary/60 transition-colors cursor-pointer border border-transparent hover:border-border/50">
                        <div className="flex flex-col">
                          <span className="font-medium text-sm">{project.name}</span>
                          <span className="text-xs text-muted-foreground">{project.clientName}</span>
                        </div>
                        <div className="text-xs font-mono bg-background px-2 py-1 rounded">
                          {project.deadline ? format(new Date(project.deadline), "MMM d, yyyy") : "TBD"}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Activity Feed */}
          <Card className="border-border/50 bg-card/40 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              {stats.recentActivity.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground text-sm">No recent activity.</div>
              ) : (
                <div className="relative border-l border-border/50 ml-3 space-y-6 pb-2">
                  {stats.recentActivity.slice(0, 5).map(activity => (
                    <div key={activity.id} className="relative pl-6">
                      <span className="absolute -left-1.5 top-1.5 w-3 h-3 rounded-full bg-primary ring-4 ring-card"></span>
                      <div className="flex flex-col gap-1">
                        <div className="text-sm">
                          <span className="font-medium">{activity.clientName}</span>
                          <span className="text-muted-foreground mx-1">•</span>
                          <span className="text-muted-foreground">{activity.description}</span>
                        </div>
                        <span className="text-xs text-muted-foreground font-mono">
                          {format(new Date(activity.createdAt), "MMM d, h:mm a")}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar area */}
        <div className="space-y-6">
          {/* Upcoming Meetings */}
          <Card className="border-border/50 bg-card/40 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Calendar size={16} className="text-primary" />
                Upcoming Meetings
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats.upcomingMeetings.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground text-sm">No scheduled meetings.</div>
              ) : (
                <div className="grid gap-3">
                  {stats.upcomingMeetings.map(meeting => (
                    <div key={meeting.id} className="flex gap-3 p-3 rounded-md bg-secondary/30 border border-transparent">
                      <div className="flex flex-col items-center justify-center bg-background rounded-md min-w-12 h-12 border border-border/50">
                        <span className="text-xs font-bold text-primary uppercase">{format(new Date(meeting.date), "MMM")}</span>
                        <span className="text-lg font-bold leading-none">{format(new Date(meeting.date), "d")}</span>
                      </div>
                      <div className="flex flex-col justify-center">
                        <span className="font-medium text-sm">{meeting.clientName}</span>
                        <span className="text-xs text-muted-foreground">{format(new Date(meeting.date), "h:mm a")}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Notes */}
          <Card className="border-border/50 bg-card/40 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <FileText size={16} className="text-primary" />
                Recent Notes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats.recentNotes.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground text-sm">No recent notes.</div>
              ) : (
                <div className="grid gap-3">
                  {stats.recentNotes.slice(0, 3).map(note => (
                    <div key={note.id} className="flex flex-col gap-2 p-3 rounded-md bg-secondary/30 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-xs text-primary">{note.clientName}</span>
                        <span className="text-[10px] text-muted-foreground">{format(new Date(note.createdAt), "MMM d")}</span>
                      </div>
                      <p className="text-muted-foreground line-clamp-2 text-xs leading-relaxed">{note.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
