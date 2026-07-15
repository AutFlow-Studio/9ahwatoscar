import { useListClients, useCreateClient, useUpdateClient, useDeleteClient, getListClientsQueryKey, type Client, type ClientInputStatus } from "@workspace/api-client-react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Search, Plus, Building2, Mail, Phone, ExternalLink, MoreVertical, Users } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { StatusBadge, getClientStatusVariant } from "@/components/status-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { useToast } from "@/hooks/use-toast";

interface ClientFormState {
  companyName: string;
  industry: string;
  email: string;
  phone: string;
  website: string;
  status: ClientInputStatus;
}

const EMPTY_FORM: ClientFormState = {
  companyName: "",
  industry: "",
  email: "",
  phone: "",
  website: "",
  status: "prospect",
};

function ClientFormDialog({
  open,
  onOpenChange,
  initial,
  onSubmit,
  isSubmitting,
  title,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: ClientFormState;
  onSubmit: (values: ClientFormState) => void;
  isSubmitting: boolean;
  title: string;
}) {
  const [form, setForm] = useState<ClientFormState>(initial);

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (o) setForm(initial); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Client details are used across projects, invoices, and reports.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(form);
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="companyName">Company Name</Label>
            <Input id="companyName" required value={form.companyName} onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="industry">Industry</Label>
              <Input id="industry" value={form.industry} onChange={(e) => setForm((f) => ({ ...f, industry: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v as ClientInputStatus }))}>
                <SelectTrigger id="status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="prospect">Prospect</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="churned">Churned</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="website">Website</Label>
            <Input id="website" value={form.website} onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting || !form.companyName}>
              {isSubmitting ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function ClientsList() {
  const [search, setSearch] = useState("");
  const { data: clients, isLoading } = useListClients({ search: search || undefined });
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [addOpen, setAddOpen] = useState(false);
  const [editClient, setEditClient] = useState<Client | null>(null);
  const [deleteClient, setDeleteClient] = useState<Client | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListClientsQueryKey() });

  const createClient = useCreateClient({
    mutation: {
      onSuccess: () => {
        invalidate();
        setAddOpen(false);
        toast({ title: "Client added", description: "The new client has been created." });
      },
      onError: () => toast({ title: "Failed to add client", variant: "destructive" }),
    },
  });

  const updateClient = useUpdateClient({
    mutation: {
      onSuccess: () => {
        invalidate();
        setEditClient(null);
        toast({ title: "Client updated" });
      },
      onError: () => toast({ title: "Failed to update client", variant: "destructive" }),
    },
  });

  const deleteClientMutation = useDeleteClient({
    mutation: {
      onSuccess: () => {
        invalidate();
        setDeleteClient(null);
        toast({ title: "Client deleted" });
      },
      onError: () => toast({ title: "Failed to delete client", variant: "destructive" }),
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Clients" description="Manage your agency's relationships">
        <Button className="gap-2" onClick={() => setAddOpen(true)}>
          <Plus size={16} />
          Add Client
        </Button>
      </PageHeader>

      <ClientFormDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        initial={EMPTY_FORM}
        isSubmitting={createClient.isPending}
        title="Add Client"
        onSubmit={(values) => createClient.mutate({ data: values })}
      />

      {editClient && (
        <ClientFormDialog
          open={!!editClient}
          onOpenChange={(o) => !o && setEditClient(null)}
          initial={{
            companyName: editClient.companyName,
            industry: editClient.industry || "",
            email: editClient.email || "",
            phone: editClient.phone || "",
            website: editClient.website || "",
            status: (editClient.status as ClientInputStatus) || "prospect",
          }}
          isSubmitting={updateClient.isPending}
          title="Edit Client"
          onSubmit={(values) => updateClient.mutate({ id: editClient.id, data: values })}
        />
      )}

      <AlertDialog open={!!deleteClient} onOpenChange={(o) => !o && setDeleteClient(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteClient?.companyName}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the client and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteClient && deleteClientMutation.mutate({ id: deleteClient.id })}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
          <Input 
            placeholder="Search clients by name, industry, email..." 
            className="pl-9 bg-card/50"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {/* Filters could go here */}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-48 rounded-xl" />)}
        </div>
      ) : !clients || clients.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center border rounded-xl bg-card/30 border-dashed">
          <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center mb-4 text-muted-foreground">
            <Users size={24} />
          </div>
          <h3 className="text-lg font-semibold mb-1">No clients found</h3>
          <p className="text-muted-foreground text-sm max-w-sm mb-6">
            {search ? "No clients match your search query." : "You haven't added any clients yet. Start by adding your first client."}
          </p>
          <Button onClick={() => setAddOpen(true)}>Add New Client</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clients.map(client => (
            <Card key={client.id} className="overflow-hidden flex flex-col hover:border-primary/50 transition-colors group bg-card/40 backdrop-blur-sm">
              <div className="p-5 flex-1 flex flex-col">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 border border-border/50">
                      <AvatarImage src={client.logoUrl || undefined} alt={client.companyName} />
                      <AvatarFallback className="bg-primary/10 text-primary font-bold">
                        {client.companyName.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <Link href={`/clients/${client.id}`} className="font-semibold hover:text-primary transition-colors line-clamp-1">
                        {client.companyName}
                      </Link>
                      <div className="text-xs text-muted-foreground mt-0.5">{client.industry || "No industry"}</div>
                    </div>
                  </div>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreVertical size={16} />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link href={`/clients/${client.id}`}>View Details</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setEditClient(client)}>Edit Client</DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onClick={() => setDeleteClient(client)}>Delete Client</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                
                <div className="space-y-2 mt-auto text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail size={14} className="shrink-0" />
                    <span className="truncate">{client.email || "No email"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone size={14} className="shrink-0" />
                    <span className="truncate">{client.phone || "No phone"}</span>
                  </div>
                  {client.website && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <ExternalLink size={14} className="shrink-0" />
                      <a href={client.website} target="_blank" rel="noreferrer" className="truncate hover:text-primary transition-colors">
                        {client.website.replace(/^https?:\/\//, '')}
                      </a>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="px-5 py-3 bg-secondary/30 border-t border-border/50 flex items-center justify-between">
                <StatusBadge variant={getClientStatusVariant(client.status)}>
                  {client.status}
                </StatusBadge>
                {client.contractValue && (
                  <div className="text-sm font-semibold">
                    ${client.contractValue.toLocaleString()}
                    {client.monthlyRetainer ? <span className="text-muted-foreground text-xs font-normal">/mo</span> : ""}
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

