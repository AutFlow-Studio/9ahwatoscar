import { useListPayments, useCreatePayment, useListClients, getListPaymentsQueryKey } from "@workspace/api-client-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, Plus, Filter, Download } from "lucide-react";
import jsPDF from "jspdf";
import { useAgencyProfile } from "@/components/agency-profile-provider";
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { StatusBadge, getPaymentStatusVariant } from "@/components/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
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
import type { Payment } from "@workspace/api-client-react";

function CreateInvoiceDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: clients } = useListClients();
  const { mutate: createPayment, isPending } = useCreatePayment();

  const [clientId, setClientId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<string>("pending");
  const [dueDate, setDueDate] = useState("");

  function resetForm() {
    setClientId("");
    setInvoiceNumber("");
    setAmount("");
    setStatus("pending");
    setDueDate("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId || !invoiceNumber.trim() || !amount) return;
    createPayment(
      {
        data: {
          clientId: parseInt(clientId, 10),
          invoiceNumber: invoiceNumber.trim(),
          amount: parseFloat(amount),
          status: status as any,
          dueDate: dueDate || undefined,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListPaymentsQueryKey() });
          toast({ title: "Invoice created", description: `Invoice "${invoiceNumber}" was created successfully.` });
          resetForm();
          onOpenChange(false);
        },
        onError: () => {
          toast({ title: "Error", description: "Failed to create invoice.", variant: "destructive" });
        },
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Invoice</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="inv-client">Client *</Label>
            <Select value={clientId} onValueChange={setClientId} required>
              <SelectTrigger id="inv-client">
                <SelectValue placeholder="Select client" />
              </SelectTrigger>
              <SelectContent>
                {clients?.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.companyName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inv-number">Invoice Number *</Label>
            <Input
              id="inv-number"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder="e.g. INV-001"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inv-amount">Amount ($) *</Label>
            <Input
              id="inv-amount"
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="inv-status">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="inv-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["pending", "paid", "overdue", "cancelled"].map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inv-due">Due Date</Label>
              <Input
                id="inv-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { resetForm(); onOpenChange(false); }}>Cancel</Button>
            <Button type="submit" disabled={isPending || !clientId || !invoiceNumber.trim() || !amount}>
              {isPending ? "Creating…" : "Create Invoice"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function downloadInvoicePDF(
  payment: Payment,
  agencyName: string,
  agencyEmail: string,
  agencyWebsite: string,
) {
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  const right = pageW - 20;

  // ── Header bar ────────────────────────────────────────────────────────────
  doc.setFillColor(15, 15, 25);
  doc.rect(0, 0, pageW, 40, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("INVOICE", 20, 26);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(180, 180, 200);
  doc.text(`#${payment.invoiceNumber}`, right, 20, { align: "right" });
  doc.text(
    `Status: ${payment.status.toUpperCase()}`,
    right,
    28,
    { align: "right" },
  );

  // ── Agency & Client columns ────────────────────────────────────────────────
  doc.setTextColor(50, 50, 60);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("FROM", 20, 56);
  doc.text("TO", 110, 56);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(agencyName, 20, 64);
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 110);
  if (agencyEmail) doc.text(agencyEmail, 20, 71);
  if (agencyWebsite) doc.text(agencyWebsite, 20, 78);

  doc.setTextColor(50, 50, 60);
  doc.setFontSize(10);
  doc.text(payment.clientName ?? "Client", 110, 64);

  // ── Date row ──────────────────────────────────────────────────────────────
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 110);
  const issuedLabel = "Issue Date:";
  const dueLabel = "Due Date:";
  const paidLabel = "Paid Date:";
  doc.text(issuedLabel, 20, 92);
  doc.text(
    payment.createdAt
      ? format(new Date(payment.createdAt as string), "MMM d, yyyy")
      : "—",
    20 + doc.getTextWidth(issuedLabel) + 2,
    92,
  );
  doc.text(dueLabel, 85, 92);
  doc.text(
    payment.dueDate ? format(new Date(payment.dueDate), "MMM d, yyyy") : "—",
    85 + doc.getTextWidth(dueLabel) + 2,
    92,
  );
  if (payment.paidDate) {
    doc.text(paidLabel, 150, 92);
    doc.text(
      format(new Date(payment.paidDate), "MMM d, yyyy"),
      150 + doc.getTextWidth(paidLabel) + 2,
      92,
    );
  }

  // ── Divider ───────────────────────────────────────────────────────────────
  doc.setDrawColor(220, 220, 230);
  doc.setLineWidth(0.4);
  doc.line(20, 98, right, 98);

  // ── Line items table header ───────────────────────────────────────────────
  doc.setFillColor(245, 245, 250);
  doc.rect(20, 102, pageW - 40, 8, "F");
  doc.setTextColor(80, 80, 90);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("Description", 24, 108);
  doc.text("Amount", right, 108, { align: "right" });

  // ── Line items ────────────────────────────────────────────────────────────
  doc.setFont("helvetica", "normal");
  doc.setTextColor(50, 50, 60);
  doc.setFontSize(10);
  doc.text("Professional Services", 24, 122);
  doc.text(`${payment.amount.toLocaleString()}`, right, 122, {
    align: "right",
  });

  // ── Total ─────────────────────────────────────────────────────────────────
  doc.setLineWidth(0.3);
  doc.setDrawColor(200, 200, 210);
  doc.line(20, 130, right, 130);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(15, 15, 25);
  doc.text("Total Due", 130, 142);
  doc.setFontSize(13);
  doc.text(`${payment.amount.toLocaleString()}`, right, 142, {
    align: "right",
  });

  // ── Notes ─────────────────────────────────────────────────────────────────
  if (payment.notes) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 90);
    doc.text("Notes:", 20, 160);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 110);
    const noteLines = doc.splitTextToSize(payment.notes, pageW - 40);
    doc.text(noteLines, 20, 167);
  }

  // ── Footer ────────────────────────────────────────────────────────────────
  doc.setFontSize(8);
  doc.setTextColor(160, 160, 170);
  doc.text("Thank you for your business.", pageW / 2, 274, { align: "center" });
  doc.text(agencyName, pageW / 2, 280, { align: "center" });

  doc.save(`invoice-${payment.invoiceNumber}.pdf`);
}

const PAYMENT_STATUSES = ["pending", "paid", "overdue", "cancelled"] as const;

export default function PaymentsList() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data: payments, isLoading } = useListPayments();
  const { profile: agencyProfile } = useAgencyProfile();
  const [, navigate] = useLocation();

  // Filter payments locally since API doesn't have a search param for payments yet
  const filteredPayments = payments?.filter(p => {
    const matchesSearch = !search ||
      p.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
      p.clientName?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalOutstanding = payments?.filter(p => p.status === 'pending' || p.status === 'overdue')
    .reduce((sum, p) => sum + p.amount, 0) || 0;

  const totalOverdue = payments?.filter(p => p.status === 'overdue')
    .reduce((sum, p) => sum + p.amount, 0) || 0;

  return (
    <div className="space-y-6">
      <PageHeader title="Payments" description="Manage invoices and track revenue">
        <Button className="gap-2" onClick={() => setDialogOpen(true)}>
          <Plus size={16} />
          Create Invoice
        </Button>
      </PageHeader>

      <CreateInvoiceDialog open={dialogOpen} onOpenChange={setDialogOpen} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card className="bg-card/40 backdrop-blur-sm border-border/50">
          <CardContent className="p-5">
            <div className="text-sm font-medium text-muted-foreground mb-1">Total Outstanding</div>
            <div className="text-2xl font-bold font-mono">${totalOutstanding.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card className="bg-destructive/5 border-destructive/30">
          <CardContent className="p-5">
            <div className="text-sm font-medium text-destructive mb-1">Overdue Amount</div>
            <div className="text-2xl font-bold font-mono text-destructive">${totalOverdue.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card className="bg-card/40 backdrop-blur-sm border-border/50">
          <CardContent className="p-5 flex items-center justify-between h-full">
            <div>
              <div className="text-sm font-medium text-muted-foreground mb-1">Payment Settings</div>
              <div className="text-sm text-muted-foreground">Configure billing details in Settings</div>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate("/settings")}>Manage</Button>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
          <Input
            placeholder="Search invoices by number or client..."
            className="pl-9 bg-card/50"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44 bg-card/50 gap-2">
              <Filter size={14} className="text-muted-foreground shrink-0" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {PAYMENT_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      ) : !filteredPayments || filteredPayments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center border rounded-xl bg-card/30 border-dashed">
          <h3 className="text-lg font-semibold mb-1">No invoices found</h3>
          <p className="text-muted-foreground text-sm max-w-sm mb-6">
            {search || statusFilter !== "all" ? "No invoices match your search or filter." : "You don't have any invoices yet."}
          </p>
          <Button onClick={() => setDialogOpen(true)}>Create your first invoice</Button>
        </div>
      ) : (
        <div className="rounded-xl border border-border/50 bg-card/40 backdrop-blur-sm overflow-hidden">
          <Table>
            <TableHeader className="bg-secondary/50">
              <TableRow>
                <TableHead className="w-[150px]">Invoice</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPayments.map(payment => (
                <TableRow key={payment.id} className="hover:bg-secondary/20 transition-colors group">
                  <TableCell className="font-medium font-mono text-sm">
                    {payment.invoiceNumber}
                  </TableCell>
                  <TableCell>
                    <Link href={`/clients/${payment.clientId}`} className="hover:text-primary transition-colors text-muted-foreground font-medium">
                      {payment.clientName}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <StatusBadge variant={getPaymentStatusVariant(payment.status)}>
                      {payment.status}
                    </StatusBadge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {payment.dueDate ? format(new Date(payment.dueDate), "MMM d, yyyy") : "—"}
                  </TableCell>
                  <TableCell className="text-right font-mono font-bold">
                    ${payment.amount.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Download summary"
                      onClick={() => downloadInvoicePDF(payment, agencyProfile.agencyName, agencyProfile.agencyEmail, agencyProfile.website)}
                    >
                      <Download size={16} />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
