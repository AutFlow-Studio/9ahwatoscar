import {
  useGetProject,
  useListDeliverables,
  useUpdateProject,
  useCreateDeliverable,
  useUpdateDeliverable,
  useDeleteDeliverable,
  getGetProjectQueryKey,
  getListDeliverablesQueryKey,
  getListProjectsQueryKey,
} from "@workspace/api-client-react";
import { PageHeader } from "@/components/page-header";
import { useParams, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Building2, 
  Calendar, 
  DollarSign, 
  Edit, 
  CheckCircle2, 
  Clock, 
  MoreVertical,
  PlayCircle,
  PauseCircle,
  AlertCircle,
  Plus
} from "lucide-react";
import { StatusBadge, getProjectStatusVariant, getProjectPriorityVariant, getTaskStatusVariant } from "@/components/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

// ─── Edit Project Dialog ──────────────────────────────────────────────────────

interface EditProjectDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  project: {
    id: number;
    name: string;
    status: string;
    priority: string;
    progress: number;
    deadline?: string | null;
    estimatedBudget?: number | null;
    description?: string | null;
    ownerNotes?: string | null;
  };
}

function EditProjectDialog({ open, onOpenChange, project }: EditProjectDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { mutate: updateProject, isPending } = useUpdateProject();

  const [name, setName] = useState(project.name);
  const [status, setStatus] = useState(project.status);
  const [priority, setPriority] = useState(project.priority);
  const [progress, setProgress] = useState(String(project.progress));
  const [deadline, setDeadline] = useState(project.deadline ?? "");
  const [estimatedBudget, setEstimatedBudget] = useState(
    project.estimatedBudget != null ? String(project.estimatedBudget) : ""
  );
  const [description, setDescription] = useState(project.description ?? "");
  const [ownerNotes, setOwnerNotes] = useState(project.ownerNotes ?? "");

  // Sync when dialog opens for a potentially changed project
  function handleOpenChange(v: boolean) {
    if (v) {
      setName(project.name);
      setStatus(project.status);
      setPriority(project.priority);
      setProgress(String(project.progress));
      setDeadline(project.deadline ?? "");
      setEstimatedBudget(project.estimatedBudget != null ? String(project.estimatedBudget) : "");
      setDescription(project.description ?? "");
      setOwnerNotes(project.ownerNotes ?? "");
    }
    onOpenChange(v);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    updateProject(
      {
        id: project.id,
        data: {
          name: name.trim(),
          status: status as any,
          priority: priority as any,
          progress: progress !== "" ? Math.min(100, Math.max(0, parseInt(progress, 10))) : undefined,
          deadline: deadline || undefined,
          estimatedBudget: estimatedBudget ? parseFloat(estimatedBudget) : undefined,
          description: description || undefined,
          ownerNotes: ownerNotes || undefined,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(project.id) });
          queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
          toast({ title: "Project updated", description: "Changes saved successfully." });
          onOpenChange(false);
        },
        onError: () => {
          toast({ title: "Error", description: "Failed to update project.", variant: "destructive" });
        },
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Project</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ep-name">Project Name</Label>
            <Input id="ep-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ep-status">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="ep-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["planning","waiting","design","development","testing","review","delivered","paused","cancelled"].map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ep-priority">Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger id="ep-priority"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["low","medium","high","urgent"].map(p => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ep-progress">Progress ({progress || 0}%)</Label>
            <input
              id="ep-progress"
              type="range"
              min="0"
              max="100"
              value={progress}
              onChange={(e) => setProgress(e.target.value)}
              className="w-full accent-primary"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ep-deadline">Deadline</Label>
              <Input id="ep-deadline" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ep-budget">Est. Budget ($)</Label>
              <Input id="ep-budget" type="number" min="0" step="0.01" value={estimatedBudget} onChange={(e) => setEstimatedBudget(e.target.value)} placeholder="0.00" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ep-desc">Description</Label>
            <Textarea id="ep-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ep-notes">Internal Notes</Label>
            <Textarea id="ep-notes" value={ownerNotes} onChange={(e) => setOwnerNotes(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isPending || !name.trim()}>
              {isPending ? "Saving…" : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Add Deliverable Dialog ───────────────────────────────────────────────────

interface AddDeliverableDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectId: number;
}

function AddDeliverableDialog({ open, onOpenChange, projectId }: AddDeliverableDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { mutate: createDeliverable, isPending } = useCreateDeliverable();

  const [title, setTitle] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [deadline, setDeadline] = useState("");

  function resetForm() {
    setTitle("");
    setAssignedTo("");
    setDeadline("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    createDeliverable(
      {
        projectId,
        data: {
          title: title.trim(),
          assignedTo: assignedTo || undefined,
          deadline: deadline || undefined,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListDeliverablesQueryKey(projectId) });
          toast({ title: "Deliverable added" });
          resetForm();
          onOpenChange(false);
        },
        onError: () => {
          toast({ title: "Error", description: "Failed to add deliverable.", variant: "destructive" });
        },
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Add Deliverable</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="del-title">Title *</Label>
            <Input id="del-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Final mockups" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="del-assigned">Assigned To</Label>
            <Input id="del-assigned" value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} placeholder="Name" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="del-deadline">Deadline</Label>
            <Input id="del-deadline" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { resetForm(); onOpenChange(false); }}>Cancel</Button>
            <Button type="submit" disabled={isPending || !title.trim()}>
              {isPending ? "Adding…" : "Add Item"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Edit Deliverable Dialog ──────────────────────────────────────────────────

interface EditDeliverableDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectId: number;
  item: {
    id: number;
    title: string;
    status: string;
    assignedTo?: string | null;
    deadline?: string | null;
    notes?: string | null;
  };
}

function EditDeliverableDialog({ open, onOpenChange, projectId, item }: EditDeliverableDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { mutate: updateDeliverable, isPending } = useUpdateDeliverable();

  const [title, setTitle] = useState(item.title);
  const [assignedTo, setAssignedTo] = useState(item.assignedTo ?? "");
  const [deadline, setDeadline] = useState(item.deadline ?? "");
  const [status, setStatus] = useState(item.status);

  function handleOpenChange(v: boolean) {
    if (v) {
      setTitle(item.title);
      setAssignedTo(item.assignedTo ?? "");
      setDeadline(item.deadline ?? "");
      setStatus(item.status);
    }
    onOpenChange(v);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    updateDeliverable(
      {
        id: item.id,
        data: {
          title: title.trim(),
          status: status as any,
          assignedTo: assignedTo || undefined,
          deadline: deadline || undefined,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListDeliverablesQueryKey(projectId) });
          toast({ title: "Deliverable updated" });
          onOpenChange(false);
        },
        onError: () => {
          toast({ title: "Error", description: "Failed to update deliverable.", variant: "destructive" });
        },
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit Deliverable</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ed-title">Title</Label>
            <Input id="ed-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ed-status">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger id="ed-status"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["pending","in_progress","review","done"].map(s => (
                  <SelectItem key={s} value={s}>{s.replace("_"," ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ed-assigned">Assigned To</Label>
            <Input id="ed-assigned" value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ed-deadline">Deadline</Label>
            <Input id="ed-deadline" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isPending || !title.trim()}>
              {isPending ? "Saving…" : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ProjectDetail() {
  const { id } = useParams();
  const projectId = parseInt(id || "0", 10);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: project, isLoading } = useGetProject(projectId, {
    query: { enabled: !!projectId, queryKey: getGetProjectQueryKey(projectId) }
  });

  const { data: deliverables } = useListDeliverables(projectId, {
    query: { enabled: !!projectId, queryKey: getListDeliverablesQueryKey(projectId) }
  });

  const { mutate: updateProject, isPending: isMarkingDelivered } = useUpdateProject();
  const { mutate: updateDeliverable } = useUpdateDeliverable();
  const { mutate: deleteDeliverable } = useDeleteDeliverable();

  const [editProjectOpen, setEditProjectOpen] = useState(false);
  const [addDeliverableOpen, setAddDeliverableOpen] = useState(false);
  const [editDeliverable, setEditDeliverable] = useState<import("@workspace/api-client-react").Deliverable | null>(null);
  const [deleteDeliverableTarget, setDeleteDeliverableTarget] = useState<number | null>(null);

  if (isLoading || !project) {
    return (
      <div className="space-y-6">
        <div className="space-y-2 mb-8">
          <Skeleton className="w-64 h-8" />
          <Skeleton className="w-32 h-4" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
        <Skeleton className="w-full h-[500px] rounded-xl" />
      </div>
    );
  }

  // Calculate financials safely
  const estimatedBudget = project.estimatedBudget || 0;
  const actualCost = project.actualCost || 0;
  const revenue = project.revenue || 0;
  const profit = project.profit || (revenue - actualCost);
  const profitMargin = revenue > 0 ? Math.round((profit / revenue) * 100) : 0;
  const isOverBudget = actualCost > estimatedBudget && estimatedBudget > 0;

  function handleMarkDelivered() {
    const proj = project;
    if (!proj) return;
    updateProject(
      {
        id: proj.id,
        data: { status: "delivered" },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(proj.id) });
          queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
          toast({ title: "Project marked as delivered" });
        },
        onError: () => {
          toast({ title: "Error", description: "Failed to update status.", variant: "destructive" });
        },
      }
    );
  }

  function handleToggleDeliverable(item: NonNullable<typeof deliverables>[number]) {
    const newStatus = item.status === "done" ? "pending" : "done";
    updateDeliverable(
      { id: item.id, data: { status: newStatus as any } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListDeliverablesQueryKey(projectId) });
        },
        onError: () => {
          toast({ title: "Error", description: "Failed to update deliverable.", variant: "destructive" });
        },
      }
    );
  }

  function handleDeleteDeliverable(deliverableId: number) {
    deleteDeliverable(
      { id: deliverableId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListDeliverablesQueryKey(projectId) });
          toast({ title: "Deliverable deleted" });
          setDeleteDeliverableTarget(null);
        },
        onError: () => {
          toast({ title: "Error", description: "Failed to delete deliverable.", variant: "destructive" });
          setDeleteDeliverableTarget(null);
        },
      }
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Dialogs */}
      <EditProjectDialog
        open={editProjectOpen}
        onOpenChange={setEditProjectOpen}
        project={project}
      />
      <AddDeliverableDialog
        open={addDeliverableOpen}
        onOpenChange={setAddDeliverableOpen}
        projectId={projectId}
      />
      {editDeliverable && (
        <EditDeliverableDialog
          open={!!editDeliverable}
          onOpenChange={(v) => { if (!v) setEditDeliverable(null as any); }}
          projectId={projectId}
          item={editDeliverable}
        />
      )}
      <AlertDialog open={deleteDeliverableTarget !== null} onOpenChange={(v) => { if (!v) setDeleteDeliverableTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Deliverable?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteDeliverableTarget !== null && handleDeleteDeliverable(deleteDeliverableTarget)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Project Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-2">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold tracking-tight">{project.name}</h1>
            <StatusBadge variant={getProjectStatusVariant(project.status)}>
              {project.status.replace("_", " ")}
            </StatusBadge>
            <StatusBadge variant={getProjectPriorityVariant(project.priority)}>
              {project.priority}
            </StatusBadge>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <span>Client:</span>
            <Link href={`/clients/${project.clientId}`} className="font-medium text-foreground hover:text-primary transition-colors flex items-center gap-1.5">
              <Building2 size={14} />
              {project.clientName}
            </Link>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {project.status !== "delivered" && project.status !== "cancelled" && (
            <Button
              variant="outline"
              className="gap-2 bg-background/50"
              onClick={handleMarkDelivered}
              disabled={isMarkingDelivered}
            >
              <CheckCircle2 size={16} className="text-emerald-500" />
              {isMarkingDelivered ? "Updating…" : "Mark Delivered"}
            </Button>
          )}
          <Button className="gap-2" onClick={() => setEditProjectOpen(true)}>
            <Edit size={16} />
            Edit Project
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="bg-card/40 backdrop-blur-sm border-border/50">
          <CardContent className="p-5">
            <div className="flex justify-between items-start mb-4">
              <div className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <PlayCircle size={14} /> Progress
              </div>
              <span className="font-mono font-bold text-lg">{project.progress}%</span>
            </div>
            <Progress value={project.progress} className="h-2 mb-2" />
            <div className="flex justify-between text-xs text-muted-foreground font-mono mt-3 pt-3 border-t border-border/50">
              <span className="flex items-center gap-1"><Clock size={12}/> Start: {project.startDate ? format(new Date(project.startDate), "MMM d") : "—"}</span>
              <span className="flex items-center gap-1 text-foreground"><Calendar size={12}/> Due: {project.deadline ? format(new Date(project.deadline), "MMM d") : "—"}</span>
            </div>
          </CardContent>
        </Card>

        <Card className={isOverBudget ? "bg-destructive/5 border-destructive/30" : "bg-card/40 backdrop-blur-sm border-border/50"}>
          <CardContent className="p-5">
            <div className="flex justify-between items-start mb-4">
              <div className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <DollarSign size={14} /> Budget
              </div>
              {isOverBudget && <AlertCircle size={16} className="text-destructive" />}
            </div>
            <div className="flex items-baseline gap-2 mb-1">
              <span className="font-mono font-bold text-2xl">${actualCost.toLocaleString()}</span>
              <span className="text-sm text-muted-foreground font-mono">/ ${estimatedBudget.toLocaleString()}</span>
            </div>
            <Progress value={estimatedBudget > 0 ? Math.min((actualCost / estimatedBudget) * 100, 100) : 0} className={`h-2 mb-2 ${isOverBudget ? "[&>div]:bg-destructive" : ""}`} />
            <div className="text-xs mt-3 pt-3 border-t border-border/50 flex justify-between">
               <span className="text-muted-foreground">Status</span>
               <span className={isOverBudget ? "text-destructive font-medium" : "text-emerald-500 font-medium"}>
                 {isOverBudget ? "Over Budget" : "On Track"}
               </span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/40 backdrop-blur-sm border-border/50">
          <CardContent className="p-5">
            <div className="flex justify-between items-start mb-4">
              <div className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <DollarSign size={14} /> Profitability
              </div>
              <StatusBadge variant={profitMargin > 20 ? "success" : profitMargin > 0 ? "warning" : "destructive"}>
                {profitMargin}% Margin
              </StatusBadge>
            </div>
            <div className="space-y-2 font-mono text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Revenue</span>
                <span>${revenue.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Costs</span>
                <span>-${actualCost.toLocaleString()}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-border/50 font-bold text-base">
                <span>Profit</span>
                <span className={profit >= 0 ? "text-emerald-500" : "text-destructive"}>
                  ${profit.toLocaleString()}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="deliverables" className="w-full">
        <TabsList className="w-full justify-start h-auto p-1 bg-card/40 backdrop-blur-sm border overflow-x-auto overflow-y-hidden">
          <TabsTrigger value="deliverables" className="py-2 px-4">Deliverables</TabsTrigger>
          <TabsTrigger value="details" className="py-2 px-4">Project Details</TabsTrigger>
          <TabsTrigger value="notes" className="py-2 px-4">Notes</TabsTrigger>
        </TabsList>

        <div className="mt-6">
          <TabsContent value="deliverables" className="m-0">
             <Card className="bg-card/40 backdrop-blur-sm border-border/50">
              <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-border/50">
                <CardTitle className="text-lg">Deliverables Checklist</CardTitle>
                <Button size="sm" variant="outline" className="gap-2" onClick={() => setAddDeliverableOpen(true)}>
                  <Plus size={16} />
                  Add Item
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                {!deliverables || deliverables.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground text-sm">
                    No deliverables defined yet. Add some tasks to track progress.
                  </div>
                ) : (
                  <div className="divide-y divide-border/50">
                    {deliverables.map(item => (
                      <div key={item.id} className="p-4 flex items-center justify-between hover:bg-secondary/20 transition-colors">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => handleToggleDeliverable(item)}
                            className={`w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 transition-colors ${item.status === 'done' ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground/50 hover:border-primary'}`}
                          >
                            {item.status === 'done' && <CheckCircle2 size={12} />}
                          </button>
                          <div className={item.status === 'done' ? 'line-through text-muted-foreground' : 'font-medium'}>
                            {item.title}
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          {item.assignedTo && (
                            <span className="text-xs text-muted-foreground hidden md:inline-block">
                              Assigned to: {item.assignedTo}
                            </span>
                          )}
                          <StatusBadge variant={getTaskStatusVariant(item.status)}>
                            {item.status.replace("_", " ")}
                          </StatusBadge>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                                <MoreVertical size={16} />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setEditDeliverable(item)}>
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => setDeleteDeliverableTarget(item.id)}
                              >
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="details" className="m-0">
            <Card className="bg-card/40 backdrop-blur-sm border-border/50">
              <CardHeader>
                <CardTitle>Project Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-muted-foreground leading-relaxed text-sm">
                  {project.description || "No description provided."}
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notes" className="m-0">
            <Card className="bg-card/40 backdrop-blur-sm border-border/50">
              <CardHeader>
                <CardTitle>Internal Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-muted-foreground leading-relaxed text-sm">
                  {project.ownerNotes || "No internal notes provided."}
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
