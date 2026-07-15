import {
  useListTasks,
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  useListClients,
  getListTasksQueryKey,
} from "@workspace/api-client-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Plus, GripVertical, CheckCircle2, Clock, Calendar, Trash2 } from "lucide-react";
import { StatusBadge, getTaskStatusVariant, getProjectPriorityVariant } from "@/components/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

// ─── New Task Dialog ──────────────────────────────────────────────────────────

function NewTaskDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: clients } = useListClients();
  const { mutate: createTask, isPending } = useCreateTask();

  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<string>("medium");
  const [status, setStatus] = useState<string>("todo");
  const [deadline, setDeadline] = useState("");
  const [clientId, setClientId] = useState("");

  function resetForm() {
    setTitle("");
    setPriority("medium");
    setStatus("todo");
    setDeadline("");
    setClientId("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    createTask(
      {
        data: {
          title: title.trim(),
          priority: priority as any,
          status: status as any,
          deadline: deadline || undefined,
          clientId: clientId ? parseInt(clientId, 10) : undefined,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
          toast({ title: "Task created" });
          resetForm();
          onOpenChange(false);
        },
        onError: () => {
          toast({ title: "Error", description: "Failed to create task.", variant: "destructive" });
        },
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>New Task</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="nt-title">Title *</Label>
            <Input id="nt-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Task title" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="nt-priority">Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger id="nt-priority"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["low","medium","high","urgent"].map(p => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nt-status">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="nt-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">To Do</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nt-deadline">Deadline</Label>
            <Input id="nt-deadline" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nt-client">Client (optional)</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger id="nt-client">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
                {clients?.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.companyName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { resetForm(); onOpenChange(false); }}>Cancel</Button>
            <Button type="submit" disabled={isPending || !title.trim()}>
              {isPending ? "Creating…" : "Create Task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Task Detail Dialog ───────────────────────────────────────────────────────

interface TaskItem {
  id: number;
  title: string;
  priority: string;
  status: string;
  deadline?: string | null;
  notes?: string | null;
  clientId?: number | null;
  clientName?: string | null;
  projectName?: string | null;
}

interface TaskDetailDialogProps {
  task: TaskItem | null;
  onClose: () => void;
  onDelete: (id: number) => void;
}

function TaskDetailDialog({ task, onClose, onDelete }: TaskDetailDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { mutate: updateTask, isPending } = useUpdateTask();
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!task) return null;

  function handleStatusChange(newStatus: string) {
    if (!task) return;
    updateTask(
      { id: task.id, data: { status: newStatus as any } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
          toast({ title: "Task updated" });
        },
        onError: () => {
          toast({ title: "Error", description: "Failed to update task.", variant: "destructive" });
        },
      }
    );
  }

  return (
    <>
      <Dialog open={!!task} onOpenChange={(v) => { if (!v) onClose(); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="pr-6">{task.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <StatusBadge variant={getProjectPriorityVariant(task.priority)}>
                {task.priority}
              </StatusBadge>
              {task.clientName && (
                <Link href={`/clients/${task.clientId}`} className="text-xs text-muted-foreground hover:text-primary truncate">
                  {task.clientName}
                </Link>
              )}
              {task.projectName && (
                <span className="text-xs text-muted-foreground truncate">{task.projectName}</span>
              )}
            </div>

            {task.deadline && (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Calendar size={14} />
                Due: {format(new Date(task.deadline), "MMM d, yyyy")}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="td-status">Status</Label>
              <Select value={task.status} onValueChange={handleStatusChange} disabled={isPending}>
                <SelectTrigger id="td-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">To Do</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {task.notes && (
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{task.notes}</p>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="destructive"
              size="sm"
              className="gap-1.5 mr-auto"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 size={14} />
              Delete
            </Button>
            <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { onDelete(task.id); setConfirmDelete(false); onClose(); }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TasksList() {
  const { data: tasks, isLoading } = useListTasks();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { mutate: deleteTask } = useDeleteTask();

  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);

  function handleDeleteTask(id: number) {
    deleteTask(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
          toast({ title: "Task deleted" });
        },
        onError: () => {
          toast({ title: "Error", description: "Failed to delete task.", variant: "destructive" });
        },
      }
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Tasks" description="Manage your internal to-do list" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-[500px] rounded-xl" />
          <Skeleton className="h-[500px] rounded-xl" />
          <Skeleton className="h-[500px] rounded-xl" />
        </div>
      </div>
    );
  }

  // Simple Kanban board visualization
  const columns = [
    { id: "todo", title: "To Do", items: tasks?.filter(t => t.status === "todo") || [] },
    { id: "in_progress", title: "In Progress", items: tasks?.filter(t => t.status === "in_progress") || [] },
    { id: "done", title: "Done", items: tasks?.filter(t => t.status === "done") || [] },
  ];

  return (
    <div className="space-y-6 h-full flex flex-col">
      <PageHeader title="Tasks" description="Manage your internal to-do list">
        <Button className="gap-2" onClick={() => setNewTaskOpen(true)}>
          <Plus size={16} />
          New Task
        </Button>
      </PageHeader>

      <NewTaskDialog open={newTaskOpen} onOpenChange={setNewTaskOpen} />
      <TaskDetailDialog
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
        onDelete={handleDeleteTask}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1 min-h-0">
        {columns.map(col => (
          <div key={col.id} className="flex flex-col h-full bg-secondary/20 rounded-xl border border-border/50 overflow-hidden">
            <div className="p-4 border-b border-border/50 bg-secondary/50 flex items-center justify-between">
              <h3 className="font-semibold">{col.title}</h3>
              <span className="bg-background px-2 py-0.5 rounded-full text-xs font-medium text-muted-foreground border">
                {col.items.length}
              </span>
            </div>
            
            <div className="p-3 flex-1 overflow-y-auto space-y-3">
              {col.items.length === 0 ? (
                <div className="text-center p-6 text-sm text-muted-foreground border border-dashed rounded-lg border-border/50">
                  No tasks here.
                </div>
              ) : (
                col.items.map(task => (
                  <Card
                    key={task.id}
                    className="bg-card cursor-pointer hover:border-primary/50 transition-colors shadow-sm group"
                    onClick={() => setSelectedTask(task)}
                  >
                    <CardContent className="p-3">
                      <div className="flex justify-between items-start mb-2">
                        <StatusBadge variant={getProjectPriorityVariant(task.priority)} className="text-[10px] px-1.5 py-0">
                          {task.priority}
                        </StatusBadge>
                        <GripVertical size={14} className="text-muted-foreground opacity-0 group-hover:opacity-100 cursor-grab" />
                      </div>
                      
                      <div className="font-medium text-sm mb-2 leading-tight">
                        {task.title}
                      </div>
                      
                      {task.clientName && (
                        <span
                          className="text-xs text-muted-foreground hover:text-primary block mb-2 truncate"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Link href={`/clients/${task.clientId}`}>{task.clientName}</Link>
                        </span>
                      )}
                      
                      {task.deadline && (
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-mono mt-3 pt-2 border-t border-border/50">
                          <Calendar size={12} />
                          {format(new Date(task.deadline), "MMM d")}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
