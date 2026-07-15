import { useListProjects, useCreateProject, useListClients, getListProjectsQueryKey } from "@workspace/api-client-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, Plus, Filter, Calendar, DollarSign, LayoutList, Grip } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import { StatusBadge, getProjectStatusVariant, getProjectPriorityVariant } from "@/components/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { format } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

function NewProjectDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: clients } = useListClients();
  const { mutate: createProject, isPending } = useCreateProject();

  const [name, setName] = useState("");
  const [clientId, setClientId] = useState("");
  const [status, setStatus] = useState<string>("planning");
  const [priority, setPriority] = useState<string>("medium");
  const [deadline, setDeadline] = useState("");
  const [estimatedBudget, setEstimatedBudget] = useState("");

  function resetForm() {
    setName("");
    setClientId("");
    setStatus("planning");
    setPriority("medium");
    setDeadline("");
    setEstimatedBudget("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !clientId) return;
    createProject(
      {
        data: {
          clientId: parseInt(clientId, 10),
          name: name.trim(),
          status: status as any,
          priority: priority as any,
          deadline: deadline || undefined,
          estimatedBudget: estimatedBudget ? parseFloat(estimatedBudget) : undefined,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
          toast({ title: "Project created", description: `"${name}" was created successfully.` });
          resetForm();
          onOpenChange(false);
        },
        onError: () => {
          toast({ title: "Error", description: "Failed to create project.", variant: "destructive" });
        },
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Project</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="proj-name">Project Name *</Label>
            <Input id="proj-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Brand Redesign" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="proj-client">Client *</Label>
            <Select value={clientId} onValueChange={setClientId} required>
              <SelectTrigger id="proj-client">
                <SelectValue placeholder="Select client" />
              </SelectTrigger>
              <SelectContent>
                {clients?.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.companyName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="proj-status">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="proj-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["planning","waiting","design","development","testing","review","delivered","paused","cancelled"].map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="proj-priority">Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger id="proj-priority"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["low","medium","high","urgent"].map(p => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="proj-deadline">Deadline</Label>
              <Input id="proj-deadline" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="proj-budget">Est. Budget ($)</Label>
              <Input id="proj-budget" type="number" min="0" step="0.01" value={estimatedBudget} onChange={(e) => setEstimatedBudget(e.target.value)} placeholder="0.00" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { resetForm(); onOpenChange(false); }}>Cancel</Button>
            <Button type="submit" disabled={isPending || !name.trim() || !clientId}>
              {isPending ? "Creating…" : "Create Project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const PROJECT_STATUSES = ["planning", "waiting", "design", "development", "testing", "review", "delivered", "paused", "cancelled"] as const;
const PROJECT_PRIORITIES = ["low", "medium", "high", "urgent"] as const;

export default function ProjectsList() {
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"list" | "grid">("list");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");

  const { data: allProjects, isLoading } = useListProjects({ search: search || undefined });

  const projects = allProjects?.filter((p) => {
    const matchesStatus = statusFilter === "all" || p.status === statusFilter;
    const matchesPriority = priorityFilter === "all" || p.priority === priorityFilter;
    return matchesStatus && matchesPriority;
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Projects" description="Track all active and past projects">
        <Button className="gap-2" onClick={() => setDialogOpen(true)}>
          <Plus size={16} />
          New Project
        </Button>
      </PageHeader>

      <NewProjectDialog open={dialogOpen} onOpenChange={setDialogOpen} />

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
          <Input 
            placeholder="Search projects..." 
            className="pl-9 bg-card/50"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40 bg-card/50 gap-2">
              <Filter size={14} className="text-muted-foreground shrink-0" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {PROJECT_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-36 bg-card/50">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              {PROJECT_PRIORITIES.map((p) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Tabs value={view} onValueChange={(v) => setView(v as "list" | "grid")} className="hidden sm:block">
            <TabsList className="bg-card/50 border">
              <TabsTrigger value="list" className="px-2.5"><LayoutList size={16} /></TabsTrigger>
              <TabsTrigger value="grid" className="px-2.5"><Grip size={16} /></TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : !projects || projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center border rounded-xl bg-card/30 border-dashed">
          <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center mb-4 text-muted-foreground">
            <LayoutList size={24} />
          </div>
          <h3 className="text-lg font-semibold mb-1">No projects found</h3>
          <p className="text-muted-foreground text-sm max-w-sm mb-6">
            {search || statusFilter !== "all" || priorityFilter !== "all"
              ? "No projects match your search or filters."
              : "You haven't created any projects yet."}
          </p>
          <Button onClick={() => setDialogOpen(true)}>Create Project</Button>
        </div>
      ) : view === "list" ? (
        <div className="rounded-xl border border-border/50 bg-card/40 backdrop-blur-sm overflow-hidden">
          <Table>
            <TableHeader className="bg-secondary/50">
              <TableRow>
                <TableHead className="w-[300px]">Project Name</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead className="w-[150px]">Progress</TableHead>
                <TableHead className="text-right">Deadline</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map(project => (
                <TableRow key={project.id} className="hover:bg-secondary/20 transition-colors group">
                  <TableCell className="font-medium">
                    <Link href={`/projects/${project.id}`} className="hover:text-primary transition-colors block">
                      {project.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    <Link href={`/clients/${project.clientId}`} className="hover:underline">
                      {project.clientName}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <StatusBadge variant={getProjectStatusVariant(project.status)}>
                      {project.status.replace("_", " ")}
                    </StatusBadge>
                  </TableCell>
                  <TableCell>
                    <StatusBadge variant={getProjectPriorityVariant(project.priority)}>
                      {project.priority}
                    </StatusBadge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Progress value={project.progress} className="h-2 flex-1" />
                      <span className="text-xs text-muted-foreground font-mono w-8 text-right">{project.progress}%</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {project.deadline ? format(new Date(project.deadline), "MMM d, yyyy") : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map(project => (
            <Card key={project.id} className="bg-card/40 backdrop-blur-sm hover:border-primary/50 transition-colors">
              <CardContent className="p-5 flex flex-col h-full">
                <div className="flex justify-between items-start mb-3">
                  <StatusBadge variant={getProjectStatusVariant(project.status)}>
                    {project.status.replace("_", " ")}
                  </StatusBadge>
                  <StatusBadge variant={getProjectPriorityVariant(project.priority)}>
                    {project.priority}
                  </StatusBadge>
                </div>
                
                <Link href={`/projects/${project.id}`} className="text-lg font-bold hover:text-primary transition-colors line-clamp-1 mb-1">
                  {project.name}
                </Link>
                <Link href={`/clients/${project.clientId}`} className="text-sm text-muted-foreground hover:underline mb-6">
                  {project.clientName}
                </Link>
                
                <div className="mt-auto space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-mono">{project.progress}%</span>
                    </div>
                    <Progress value={project.progress} className="h-2" />
                  </div>
                  
                  <div className="flex items-center justify-between text-xs pt-4 border-t border-border/50">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Calendar size={14} />
                      {project.deadline ? format(new Date(project.deadline), "MMM d") : "TBD"}
                    </div>
                    <div className="flex items-center gap-1.5 font-medium">
                      <DollarSign size={14} className="text-muted-foreground" />
                      {project.estimatedBudget ? project.estimatedBudget.toLocaleString() : "—"}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
