import { useGetClient, useListProjects, useListPayments, useListDocuments, useCreateDocument, useListNotes, useCreateNote, useUpdateClient, useCreateProject, useCreatePayment, getGetClientQueryKey, getListProjectsQueryKey, getListPaymentsQueryKey, getListDocumentsQueryKey, getListNotesQueryKey, type ClientInputStatus, type ProjectInputStatus, type ProjectInputPriority, type PaymentInputStatus, type DocumentInputType } from "@workspace/api-client-react";
import { PageHeader } from "@/components/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useParams, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { 
  Building2, 
  Mail, 
  Phone, 
  Globe, 
  MapPin, 
  Clock, 
  DollarSign, 
  Calendar,
  Edit,
  Plus
} from "lucide-react";
import { StatusBadge, getClientStatusVariant, getProjectStatusVariant, getPaymentStatusVariant } from "@/components/status-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FileText, ExternalLink, StickyNote } from "lucide-react";

export default function ClientDetail() {
  const { id } = useParams();
  const clientId = parseInt(id || "0", 10);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: client, isLoading } = useGetClient(clientId, {
    query: { enabled: !!clientId, queryKey: getGetClientQueryKey(clientId) }
  });
  
  const { data: projects } = useListProjects({ clientId });
  const { data: payments } = useListPayments({ clientId });
  const { data: documents } = useListDocuments(clientId, { query: { enabled: !!clientId, queryKey: getListDocumentsQueryKey(clientId) } });
  const { data: notes } = useListNotes({ clientId }, { query: { enabled: !!clientId, queryKey: getListNotesQueryKey({ clientId }) } });

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ companyName: "", industry: "", website: "", phone: "", email: "", status: "active" as ClientInputStatus });
  const [projectOpen, setProjectOpen] = useState(false);
  const [projectForm, setProjectForm] = useState({ name: "", status: "planning" as ProjectInputStatus, priority: "medium" as ProjectInputPriority, deadline: "" });
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState({ invoiceNumber: "", amount: "", status: "pending" as PaymentInputStatus, dueDate: "" });
  const [documentOpen, setDocumentOpen] = useState(false);
  const [documentForm, setDocumentForm] = useState({ title: "", type: "other" as DocumentInputType, url: "", notes: "" });
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteContent, setNoteContent] = useState("");

  const updateClient = useUpdateClient({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetClientQueryKey(clientId) });
        setEditOpen(false);
        toast({ title: "Client updated" });
      },
      onError: () => toast({ title: "Failed to update client", variant: "destructive" }),
    },
  });

  const createProject = useCreateProject({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey({ clientId }) });
        setProjectOpen(false);
        toast({ title: "Project created" });
      },
      onError: () => toast({ title: "Failed to create project", variant: "destructive" }),
    },
  });

  const createPayment = useCreatePayment({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListPaymentsQueryKey({ clientId }) });
        setInvoiceOpen(false);
        toast({ title: "Invoice created" });
      },
      onError: () => toast({ title: "Failed to create invoice", variant: "destructive" }),
    },
  });

  const createDocument = useCreateDocument({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey(clientId) });
        setDocumentOpen(false);
        setDocumentForm({ title: "", type: "other", url: "", notes: "" });
        toast({ title: "Document added" });
      },
      onError: () => toast({ title: "Failed to add document", variant: "destructive" }),
    },
  });

  const createNote = useCreateNote({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListNotesQueryKey({ clientId }) });
        setNoteOpen(false);
        setNoteContent("");
        toast({ title: "Note added" });
      },
      onError: () => toast({ title: "Failed to add note", variant: "destructive" }),
    },
  });

  const openEditDialog = () => {
    if (!client) return;
    setEditForm({
      companyName: client.companyName,
      industry: client.industry || "",
      website: client.website || "",
      phone: client.phone || "",
      email: client.email || "",
      status: (client.status as ClientInputStatus) || "active",
    });
    setEditOpen(true);
  };

  if (isLoading || !client) {
    return (
      <div className="space-y-6">
        <div className="flex gap-4 items-center mb-8">
          <Skeleton className="w-20 h-20 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="w-64 h-8" />
            <Skeleton className="w-32 h-4" />
          </div>
        </div>
        <Skeleton className="w-full h-[500px] rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Client Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 bg-card/40 backdrop-blur-sm border rounded-2xl p-6">
        <div className="flex items-center gap-6">
          <Avatar className="h-24 w-24 border-2 border-border bg-background shadow-xl">
            <AvatarImage src={client.logoUrl || undefined} alt={client.companyName} className="object-cover" />
            <AvatarFallback className="bg-primary/10 text-primary text-3xl font-bold">
              {client.companyName.substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold tracking-tight">{client.companyName}</h1>
              <StatusBadge variant={getClientStatusVariant(client.status)} className="mt-1">
                {client.status}
              </StatusBadge>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
              {client.industry && <span className="flex items-center gap-1.5"><Building2 size={14}/> {client.industry}</span>}
              {client.website && (
                <a href={client.website} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:text-primary transition-colors">
                  <Globe size={14}/> {client.website.replace(/^https?:\/\//, '')}
                </a>
              )}
              {client.address && <span className="flex items-center gap-1.5"><MapPin size={14}/> {client.address}</span>}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2" onClick={openEditDialog}>
            <Edit size={16} />
            Edit Client
          </Button>
          <Button className="gap-2" onClick={() => setProjectOpen(true)}>
            <Plus size={16} />
            New Project
          </Button>
        </div>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Client</DialogTitle>
            <DialogDescription>Update this client's core details.</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              updateClient.mutate({ id: clientId, data: editForm });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="edit-companyName">Company Name</Label>
              <Input id="edit-companyName" required value={editForm.companyName} onChange={(e) => setEditForm((f) => ({ ...f, companyName: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-industry">Industry</Label>
                <Input id="edit-industry" value={editForm.industry} onChange={(e) => setEditForm((f) => ({ ...f, industry: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-status">Status</Label>
                <Select value={editForm.status} onValueChange={(v) => setEditForm((f) => ({ ...f, status: v as ClientInputStatus }))}>
                  <SelectTrigger id="edit-status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="prospect">Prospect</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="churned">Churned</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-website">Website</Label>
              <Input id="edit-website" value={editForm.website} onChange={(e) => setEditForm((f) => ({ ...f, website: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-phone">Phone</Label>
                <Input id="edit-phone" value={editForm.phone} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-email">Email</Label>
                <Input id="edit-email" type="email" value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={updateClient.isPending}>{updateClient.isPending ? "Saving..." : "Save"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={projectOpen} onOpenChange={setProjectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Project</DialogTitle>
            <DialogDescription>Create a new project for {client.companyName}.</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              createProject.mutate({
                data: {
                  clientId,
                  name: projectForm.name,
                  status: projectForm.status,
                  priority: projectForm.priority,
                  deadline: projectForm.deadline || undefined,
                },
              });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="project-name">Project Name</Label>
              <Input id="project-name" required value={projectForm.name} onChange={(e) => setProjectForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="project-status">Status</Label>
                <Select value={projectForm.status} onValueChange={(v) => setProjectForm((f) => ({ ...f, status: v as ProjectInputStatus }))}>
                  <SelectTrigger id="project-status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planning">Planning</SelectItem>
                    <SelectItem value="waiting">Waiting</SelectItem>
                    <SelectItem value="design">Design</SelectItem>
                    <SelectItem value="development">Development</SelectItem>
                    <SelectItem value="testing">Testing</SelectItem>
                    <SelectItem value="review">Review</SelectItem>
                    <SelectItem value="delivered">Delivered</SelectItem>
                    <SelectItem value="paused">Paused</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="project-priority">Priority</Label>
                <Select value={projectForm.priority} onValueChange={(v) => setProjectForm((f) => ({ ...f, priority: v as ProjectInputPriority }))}>
                  <SelectTrigger id="project-priority"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-deadline">Deadline</Label>
              <Input id="project-deadline" type="date" value={projectForm.deadline} onChange={(e) => setProjectForm((f) => ({ ...f, deadline: e.target.value }))} />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={createProject.isPending || !projectForm.name}>{createProject.isPending ? "Creating..." : "Create Project"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={invoiceOpen} onOpenChange={setInvoiceOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Invoice</DialogTitle>
            <DialogDescription>Create a new invoice for {client.companyName}.</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              createPayment.mutate({
                data: {
                  clientId,
                  invoiceNumber: invoiceForm.invoiceNumber,
                  amount: parseFloat(invoiceForm.amount || "0"),
                  status: invoiceForm.status,
                  dueDate: invoiceForm.dueDate || undefined,
                },
              });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="invoice-number">Invoice Number</Label>
              <Input id="invoice-number" required value={invoiceForm.invoiceNumber} onChange={(e) => setInvoiceForm((f) => ({ ...f, invoiceNumber: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="invoice-amount">Amount</Label>
                <Input id="invoice-amount" type="number" min="0" step="0.01" required value={invoiceForm.amount} onChange={(e) => setInvoiceForm((f) => ({ ...f, amount: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invoice-status">Status</Label>
                <Select value={invoiceForm.status} onValueChange={(v) => setInvoiceForm((f) => ({ ...f, status: v as PaymentInputStatus }))}>
                  <SelectTrigger id="invoice-status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="invoice-due">Due Date</Label>
              <Input id="invoice-due" type="date" value={invoiceForm.dueDate} onChange={(e) => setInvoiceForm((f) => ({ ...f, dueDate: e.target.value }))} />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={createPayment.isPending || !invoiceForm.invoiceNumber}>{createPayment.isPending ? "Creating..." : "Create Invoice"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="w-full justify-start h-auto p-1 bg-card/40 backdrop-blur-sm border overflow-x-auto overflow-y-hidden">
          <TabsTrigger value="overview" className="py-2 px-4">Overview</TabsTrigger>
          <TabsTrigger value="projects" className="py-2 px-4">Projects ({projects?.length || 0})</TabsTrigger>
          <TabsTrigger value="payments" className="py-2 px-4">Payments</TabsTrigger>
          <TabsTrigger value="documents" className="py-2 px-4">Documents</TabsTrigger>
          <TabsTrigger value="notes" className="py-2 px-4">Notes</TabsTrigger>
        </TabsList>

        <div className="mt-6">
          <TabsContent value="overview" className="space-y-6 m-0">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 space-y-6">
                <Card className="bg-card/40 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle>Client Details</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-8">
                    <div>
                      <div className="text-sm font-medium text-muted-foreground mb-1">Primary Contact</div>
                      <div className="font-medium">{client.primaryContact || "—"}</div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-muted-foreground mb-1">Secondary Contact</div>
                      <div className="font-medium">{client.secondaryContact || "—"}</div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-muted-foreground mb-1">Email</div>
                      <div className="flex items-center gap-2">
                        <Mail size={14} className="text-muted-foreground" />
                        {client.email ? <a href={`mailto:${client.email}`} className="hover:text-primary">{client.email}</a> : "—"}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-muted-foreground mb-1">Phone</div>
                      <div className="flex items-center gap-2">
                        <Phone size={14} className="text-muted-foreground" />
                        {client.phone ? <a href={`tel:${client.phone}`} className="hover:text-primary">{client.phone}</a> : "—"}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-muted-foreground mb-1">Timezone</div>
                      <div className="flex items-center gap-2">
                        <Clock size={14} className="text-muted-foreground" />
                        {client.timezone || "—"}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-muted-foreground mb-1">Start Date</div>
                      <div className="flex items-center gap-2">
                        <Calendar size={14} className="text-muted-foreground" />
                        {client.startDate ? format(new Date(client.startDate), "MMM d, yyyy") : "—"}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {client.notes && (
                  <Card className="bg-card/40 backdrop-blur-sm">
                    <CardHeader>
                      <CardTitle>About / General Notes</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="whitespace-pre-wrap text-sm text-muted-foreground leading-relaxed">
                        {client.notes}
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>

              <div className="space-y-6">
                <Card className="bg-card/40 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle>Financials</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between items-center p-3 rounded-lg bg-secondary/50">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                          <DollarSign size={16} />
                        </div>
                        <span className="font-medium text-sm">Contract Value</span>
                      </div>
                      <span className="font-bold">${client.contractValue?.toLocaleString() || "0"}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 rounded-lg bg-secondary/50">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                          <DollarSign size={16} />
                        </div>
                        <span className="font-medium text-sm">Monthly Retainer</span>
                      </div>
                      <span className="font-bold">${client.monthlyRetainer?.toLocaleString() || "0"}</span>
                    </div>
                  </CardContent>
                </Card>

                {client.tags && client.tags.length > 0 && (
                  <Card className="bg-card/40 backdrop-blur-sm">
                    <CardHeader>
                      <CardTitle>Tags</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {client.tags.map(tag => (
                          <span key={tag} className="px-2.5 py-1 rounded-md bg-secondary text-secondary-foreground text-xs font-medium">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="projects" className="m-0">
            <Card className="bg-card/40 backdrop-blur-sm border-border/50">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Projects</CardTitle>
                  <CardDescription>All projects associated with this client</CardDescription>
                </div>
                <Button size="sm" className="gap-2" onClick={() => setProjectOpen(true)}>
                  <Plus size={16} />
                  Add Project
                </Button>
              </CardHeader>
              <CardContent>
                {!projects || projects.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground text-sm border rounded-lg border-dashed">
                    No projects found for this client.
                  </div>
                ) : (
                  <div className="divide-y divide-border/50">
                    {projects.map(project => (
                      <div key={project.id} className="py-4 first:pt-0 last:pb-0 flex items-center justify-between group">
                        <div>
                          <Link href={`/projects/${project.id}`} className="font-medium hover:text-primary transition-colors block mb-1">
                            {project.name}
                          </Link>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar size={12} />
                              Due: {project.deadline ? format(new Date(project.deadline), "MMM d, yyyy") : "TBD"}
                            </span>
                            <span className="flex items-center gap-1">
                              <DollarSign size={12} />
                              {project.estimatedBudget ? `$${project.estimatedBudget.toLocaleString()}` : "No budget"}
                            </span>
                          </div>
                        </div>
                        <StatusBadge variant={getProjectStatusVariant(project.status)}>
                          {project.status.replace("_", " ")}
                        </StatusBadge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payments" className="m-0">
             <Card className="bg-card/40 backdrop-blur-sm border-border/50">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Invoices & Payments</CardTitle>
                  <CardDescription>Billing history for this client</CardDescription>
                </div>
                <Button size="sm" className="gap-2" onClick={() => setInvoiceOpen(true)}>
                  <Plus size={16} />
                  Create Invoice
                </Button>
              </CardHeader>
              <CardContent>
                {!payments || payments.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground text-sm border rounded-lg border-dashed">
                    No payments found for this client.
                  </div>
                ) : (
                  <div className="divide-y divide-border/50">
                    {payments.map(payment => (
                      <div key={payment.id} className="py-4 first:pt-0 last:pb-0 flex items-center justify-between">
                        <div>
                          <div className="font-medium font-mono text-sm mb-1">{payment.invoiceNumber}</div>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>Due: {payment.dueDate ? format(new Date(payment.dueDate), "MMM d, yyyy") : "—"}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <span className="font-bold font-mono">${payment.amount.toLocaleString()}</span>
                          <StatusBadge variant={getPaymentStatusVariant(payment.status)}>
                            {payment.status}
                          </StatusBadge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="documents" className="m-0">
            <Card className="bg-card/40 backdrop-blur-sm border-border/50">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Documents</CardTitle>
                <Button size="sm" className="gap-2" onClick={() => setDocumentOpen(true)}>
                  <Plus size={16} />
                  Add Document
                </Button>
              </CardHeader>
              <CardContent>
                {!documents || documents.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground text-sm border rounded-lg border-dashed">
                    No documents found for this client.
                  </div>
                ) : (
                  <div className="divide-y divide-border/50">
                    {documents.map((doc) => (
                      <div key={doc.id} className="py-4 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <FileText size={16} className="text-muted-foreground shrink-0" />
                          <div className="min-w-0">
                            <div className="font-medium text-sm truncate">{doc.title}</div>
                            <div className="text-xs text-muted-foreground capitalize">{doc.type.replace(/_/g, " ")}</div>
                          </div>
                        </div>
                        {doc.url && (
                          <a href={doc.url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary shrink-0">
                            <ExternalLink size={16} />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notes" className="m-0">
             <Card className="bg-card/40 backdrop-blur-sm border-border/50">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Notes</CardTitle>
                <Button size="sm" className="gap-2" onClick={() => setNoteOpen(true)}>
                  <Plus size={16} />
                  Add Note
                </Button>
              </CardHeader>
              <CardContent>
                {!notes || notes.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground text-sm border rounded-lg border-dashed">
                    No notes found for this client.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {notes.map((note) => (
                      <div key={note.id} className="p-3 rounded-lg border border-border/50 bg-background/40 flex gap-3">
                        <StickyNote size={16} className="text-muted-foreground shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm">{note.content}</p>
                          {note.createdAt && (
                            <p className="text-xs text-muted-foreground mt-1">{format(new Date(note.createdAt), "MMM d, yyyy 'at' h:mm a")}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </div>
      </Tabs>

      <Dialog open={documentOpen} onOpenChange={setDocumentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Document</DialogTitle>
            <DialogDescription>Attach a document or link for {client.companyName}.</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              createDocument.mutate({
                clientId,
                data: {
                  title: documentForm.title,
                  type: documentForm.type,
                  url: documentForm.url || undefined,
                  notes: documentForm.notes || undefined,
                },
              });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="doc-title">Title</Label>
              <Input id="doc-title" required value={documentForm.title} onChange={(e) => setDocumentForm((f) => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="doc-type">Type</Label>
              <Select value={documentForm.type} onValueChange={(v) => setDocumentForm((f) => ({ ...f, type: v as DocumentInputType }))}>
                <SelectTrigger id="doc-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="contract">Contract</SelectItem>
                  <SelectItem value="invoice">Invoice</SelectItem>
                  <SelectItem value="proposal">Proposal</SelectItem>
                  <SelectItem value="design">Design</SelectItem>
                  <SelectItem value="brand_assets">Brand Assets</SelectItem>
                  <SelectItem value="link">Link</SelectItem>
                  <SelectItem value="google_drive">Google Drive</SelectItem>
                  <SelectItem value="github">GitHub</SelectItem>
                  <SelectItem value="figma">Figma</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="doc-url">URL</Label>
              <Input id="doc-url" placeholder="https://..." value={documentForm.url} onChange={(e) => setDocumentForm((f) => ({ ...f, url: e.target.value }))} />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={createDocument.isPending || !documentForm.title}>{createDocument.isPending ? "Adding..." : "Add Document"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Note</DialogTitle>
            <DialogDescription>Add an internal note about {client.companyName}.</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              createNote.mutate({ data: { clientId, content: noteContent } });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="note-content">Note</Label>
              <Textarea id="note-content" required rows={4} value={noteContent} onChange={(e) => setNoteContent(e.target.value)} />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={createNote.isPending || !noteContent.trim()}>{createNote.isPending ? "Adding..." : "Add Note"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}