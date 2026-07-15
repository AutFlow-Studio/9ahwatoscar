import {
  useListDocuments,
  useListAllDocuments,
  useCreateDocument,
  useDeleteDocument,
  useUpdateDocument,
  useListClients,
  getListDocumentsQueryKey,
  getListAllDocumentsQueryKey,
  type ListClientsResponseItem,
} from "@workspace/api-client-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Search,
  Plus,
  Filter,
  FileText,
  FileDown,
  Link as LinkIcon,
  Folder,
  Code,
  PenTool,
  Upload,
  Download,
  Trash2,
  RefreshCw,
  ExternalLink,
  File,
} from "lucide-react";
import { useRef, useState } from "react";
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
import { format } from "date-fns";

const DOC_TYPES = [
  "contract",
  "invoice",
  "proposal",
  "design",
  "brand_assets",
  "link",
  "google_drive",
  "github",
  "figma",
  "other",
] as const;

const ACCEPTED_FILE_TYPES = ".pdf,.docx,.doc,.xlsx,.xls,.png,.jpg,.jpeg";
const MAX_FILE_SIZE_MB = 50;

/** Returns true when the stored URL is a GCS object path (file upload). */
function isFileBacked(url: string | null | undefined): boolean {
  return !!url?.startsWith("/objects/");
}

/** Build the URL used to download/serve a GCS object. */
function fileServeUrl(objectPath: string, filename?: string): string {
  const base = `/api/storage${objectPath}`;
  return filename ? `${base}?filename=${encodeURIComponent(filename)}` : base;
}

function getDocIcon(type: string) {
  switch (type) {
    case "contract":     return <FileText className="text-blue-500" />;
    case "invoice":      return <FileDown className="text-amber-500" />;
    case "proposal":     return <FileDown className="text-amber-500" />;
    case "design":       return <PenTool className="text-pink-500" />;
    case "brand_assets": return <PenTool className="text-pink-500" />;
    case "github":       return <Code className="text-foreground" />;
    case "figma":        return <PenTool className="text-purple-500" />;
    case "google_drive": return <Folder className="text-emerald-500" />;
    default:             return <LinkIcon className="text-muted-foreground" />;
  }
}

// ─── Upload helper ─────────────────────────────────────────────────────────

async function requestUploadUrl(file: File): Promise<{ uploadURL: string; objectPath: string }> {
  const res = await fetch("/api/storage/uploads/request-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "Failed to get upload URL");
  }
  return res.json();
}

async function uploadToGcs(uploadURL: string, file: File): Promise<void> {
  const res = await fetch(uploadURL, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!res.ok) throw new Error("Upload to storage failed");
}

async function uploadFile(
  file: File,
  onProgress?: (pct: number) => void,
): Promise<string> {
  onProgress?.(10);
  const { uploadURL, objectPath } = await requestUploadUrl(file);
  onProgress?.(40);
  await uploadToGcs(uploadURL, file);
  onProgress?.(100);
  return objectPath;
}

// ─── Add Document Dialog ────────────────────────────────────────────────────

function AddDocumentDialog({
  open,
  onOpenChange,
  clientId: initialClientId,
  clients: allClients,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clientId: number | null;
  clients?: ListClientsResponseItem[];
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { mutate: createDocument, isPending: isSaving } = useCreateDocument();

  const [mode, setMode] = useState<"file" | "url">("file");
  const [selectedClientId, setSelectedClientId] = useState<string>(
    initialClientId != null ? String(initialClientId) : "",
  );
  const [title, setTitle] = useState("");
  const [type, setType] = useState<string>("other");
  const [url, setUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const needsClientPicker = initialClientId === null;
  const isPending = isUploading || isSaving;

  function resetForm() {
    setMode("file");
    setTitle("");
    setType("other");
    setUrl("");
    setNotes("");
    setSelectedFile(null);
    setUploadProgress(0);
    setIsUploading(false);
    if (initialClientId != null) setSelectedClientId(String(initialClientId));
    else setSelectedClientId("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const resolvedClientId = needsClientPicker
      ? parseInt(selectedClientId, 10)
      : initialClientId!;
    if (!title.trim() || !resolvedClientId) return;

    let docUrl: string | undefined;

    if (mode === "file") {
      if (!selectedFile) {
        toast({ title: "No file selected", description: "Please choose a file to upload.", variant: "destructive" });
        return;
      }
      if (selectedFile.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        toast({ title: "File too large", description: `Max file size is ${MAX_FILE_SIZE_MB} MB.`, variant: "destructive" });
        return;
      }
      setIsUploading(true);
      try {
        docUrl = await uploadFile(selectedFile, setUploadProgress);
      } catch (err) {
        toast({ title: "Upload failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
        setIsUploading(false);
        return;
      }
      setIsUploading(false);
    } else {
      docUrl = url.trim() || undefined;
    }

    createDocument(
      {
        clientId: resolvedClientId,
        data: {
          title: title.trim(),
          type: type as typeof DOC_TYPES[number],
          url: docUrl,
          notes: notes.trim() || undefined,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey(resolvedClientId) });
          queryClient.invalidateQueries({ queryKey: getListAllDocumentsQueryKey() });
          toast({ title: "Document added", description: `"${title}" was added successfully.` });
          resetForm();
          onOpenChange(false);
        },
        onError: () => {
          toast({ title: "Error", description: "Failed to add document.", variant: "destructive" });
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Document</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {needsClientPicker && (
            <div className="space-y-1.5">
              <Label htmlFor="doc-client">Client *</Label>
              <Select value={selectedClientId} onValueChange={setSelectedClientId} required>
                <SelectTrigger id="doc-client"><SelectValue placeholder="Select a client…" /></SelectTrigger>
                <SelectContent>
                  {allClients?.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.companyName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Mode toggle */}
          <div className="flex rounded-lg border border-border overflow-hidden">
            <button
              type="button"
              onClick={() => setMode("file")}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium transition-colors ${
                mode === "file"
                  ? "bg-primary text-primary-foreground"
                  : "bg-transparent text-muted-foreground hover:bg-accent"
              }`}
            >
              <Upload size={14} /> Upload File
            </button>
            <button
              type="button"
              onClick={() => setMode("url")}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium transition-colors ${
                mode === "url"
                  ? "bg-primary text-primary-foreground"
                  : "bg-transparent text-muted-foreground hover:bg-accent"
              }`}
            >
              <LinkIcon size={14} /> Add Link
            </button>
          </div>

          {mode === "file" ? (
            <div className="space-y-1.5">
              <Label>File *</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_FILE_TYPES}
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setSelectedFile(f);
                  if (f && !title.trim()) {
                    // Auto-fill title from filename (strip extension)
                    setTitle(f.name.replace(/\.[^.]+$/, ""));
                  }
                }}
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-3 p-3 border border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 hover:bg-accent/30 transition-colors"
              >
                <File size={20} className="text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  {selectedFile ? (
                    <>
                      <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(selectedFile.size / 1024 / 1024).toFixed(1)} MB
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-muted-foreground">Click to choose a file</p>
                      <p className="text-xs text-muted-foreground">PDF, DOCX, XLSX, PNG, JPG · max {MAX_FILE_SIZE_MB} MB</p>
                    </>
                  )}
                </div>
                {selectedFile && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                    onClick={(e) => { e.stopPropagation(); setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                  >
                    Clear
                  </Button>
                )}
              </div>
              {isUploading && (
                <div className="space-y-1">
                  <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Uploading… {uploadProgress}%</p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="doc-url">URL</Label>
              <Input
                id="doc-url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="doc-title">Title *</Label>
            <Input
              id="doc-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Master Service Agreement"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="doc-type">Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger id="doc-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DOC_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="doc-notes">Notes (optional)</Label>
            <Textarea
              id="doc-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes…"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => { resetForm(); onOpenChange(false); }}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                isPending ||
                !title.trim() ||
                (needsClientPicker && !selectedClientId) ||
                (mode === "file" && !selectedFile)
              }
            >
              {isUploading ? "Uploading…" : isSaving ? "Adding…" : "Add Document"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Replace File Dialog ────────────────────────────────────────────────────

function ReplaceFileDialog({
  open,
  onOpenChange,
  docId,
  docTitle,
  onReplaced,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  docId: number;
  docTitle: string;
  onReplaced: () => void;
}) {
  const { toast } = useToast();
  const { mutate: updateDocument } = useUpdateDocument();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setSelectedFile(null);
    setUploadProgress(0);
    setIsUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleReplace() {
    if (!selectedFile) return;
    setIsUploading(true);
    try {
      const objectPath = await uploadFile(selectedFile, setUploadProgress);
      updateDocument(
        { id: docId, data: { url: objectPath } },
        {
          onSuccess: () => {
            toast({ title: "File replaced", description: `"${docTitle}" now points to the new file.` });
            reset();
            onOpenChange(false);
            onReplaced();
          },
          onError: () => {
            toast({ title: "Error", description: "File uploaded but failed to update record.", variant: "destructive" });
          },
        },
      );
    } catch (err) {
      toast({ title: "Upload failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
      setIsUploading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Replace File</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Upload a new file to replace the current one for <span className="font-medium text-foreground">"{docTitle}"</span>.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_FILE_TYPES}
            className="hidden"
            onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
          />
          <div
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-3 p-3 border border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 hover:bg-accent/30 transition-colors"
          >
            <File size={20} className="text-muted-foreground flex-shrink-0" />
            <div className="flex-1 min-w-0">
              {selectedFile ? (
                <>
                  <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">{(selectedFile.size / 1024 / 1024).toFixed(1)} MB</p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Click to choose a replacement file</p>
              )}
            </div>
          </div>
          {isUploading && (
            <div className="space-y-1">
              <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
              </div>
              <p className="text-xs text-muted-foreground">Uploading… {uploadProgress}%</p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => { reset(); onOpenChange(false); }} disabled={isUploading}>
            Cancel
          </Button>
          <Button onClick={handleReplace} disabled={!selectedFile || isUploading}>
            {isUploading ? "Uploading…" : "Replace File"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Document Card ──────────────────────────────────────────────────────────

type AnyDocument = {
  id: number;
  title: string;
  type: string;
  url?: string | null;
  notes?: string | null;
  clientId: number;
  createdAt: string;
  clientName?: string;
};

function DocumentCard({
  doc,
  clients,
  onDeleted,
  onUpdated,
}: {
  doc: AnyDocument;
  clients?: ListClientsResponseItem[];
  onDeleted: () => void;
  onUpdated: () => void;
}) {
  const { toast } = useToast();
  const { mutate: deleteDocument, isPending: isDeleting } = useDeleteDocument();
  const [replaceOpen, setReplaceOpen] = useState(false);
  const fileBacked = isFileBacked(doc.url);

  function handleOpen() {
    if (!doc.url) return;
    if (fileBacked) {
      window.open(fileServeUrl(doc.url, doc.title), "_blank", "noreferrer");
    } else {
      window.open(doc.url, "_blank", "noreferrer");
    }
  }

  function handleDelete() {
    if (!window.confirm(`Delete "${doc.title}"? This cannot be undone.`)) return;
    deleteDocument(
      { id: doc.id },
      {
        onSuccess: () => {
          toast({ title: "Deleted", description: `"${doc.title}" was removed.` });
          onDeleted();
        },
        onError: () => {
          toast({ title: "Error", description: "Failed to delete document.", variant: "destructive" });
        },
      },
    );
  }

  const clientName = doc.clientName ?? clients?.find((c) => c.id === doc.clientId)?.companyName ?? "";

  return (
    <>
      <div className="p-4 rounded-xl border border-border/50 bg-card/40 backdrop-blur-sm hover:border-primary/30 transition-colors group flex flex-col gap-3">
        {/* Top row: icon + metadata */}
        <div
          className="flex items-start gap-4 cursor-pointer"
          onClick={doc.url ? handleOpen : undefined}
        >
          <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0 relative">
            {getDocIcon(doc.type)}
            {fileBacked && (
              <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                <Upload size={8} className="text-primary-foreground" />
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-sm truncate group-hover:text-primary transition-colors">{doc.title}</h4>
            {clientName && (
              <p className="text-xs text-muted-foreground mt-0.5 truncate">{clientName}</p>
            )}
            <div className="text-[10px] text-muted-foreground font-mono mt-2 uppercase tracking-wider">
              {doc.type.replace(/_/g, " ")} • {format(new Date(doc.createdAt), "MMM d, yyyy")}
              {fileBacked && " • FILE"}
            </div>
          </div>
        </div>

        {/* Action row */}
        <div className="flex items-center gap-1 pt-1 border-t border-border/40">
          {doc.url && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
              onClick={handleOpen}
              title={fileBacked ? "Download / view file" : "Open link"}
            >
              {fileBacked ? <Download size={13} /> : <ExternalLink size={13} />}
              {fileBacked ? "Download" : "Open"}
            </Button>
          )}
          {fileBacked && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
              onClick={() => setReplaceOpen(true)}
              title="Replace with a new file"
            >
              <RefreshCw size={13} /> Replace
            </Button>
          )}
          <div className="flex-1" />
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs gap-1.5 text-muted-foreground hover:text-destructive"
            onClick={handleDelete}
            disabled={isDeleting}
            title="Delete document"
          >
            <Trash2 size={13} />
            {isDeleting ? "…" : "Delete"}
          </Button>
        </div>
      </div>

      <ReplaceFileDialog
        open={replaceOpen}
        onOpenChange={setReplaceOpen}
        docId={doc.id}
        docTitle={doc.title}
        onReplaced={onUpdated}
      />
    </>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function DocumentsList() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string>("all");
  const queryClient = useQueryClient();

  const { data: clients, isLoading: clientsLoading } = useListClients();

  const isAllClients = selectedClientId === "all";
  const effectiveClientId = isAllClients ? null : parseInt(selectedClientId, 10);

  const { data: clientDocuments, isLoading: clientDocsLoading } = useListDocuments(
    effectiveClientId ?? 0,
    { query: { enabled: !isAllClients && effectiveClientId !== null, queryKey: getListDocumentsQueryKey(effectiveClientId ?? 0) } },
  );
  const { data: allDocuments, isLoading: allDocsLoading } = useListAllDocuments(
    { query: { enabled: isAllClients, queryKey: getListAllDocumentsQueryKey() } },
  );

  const documents = isAllClients ? allDocuments : clientDocuments;
  const filteredDocs = documents?.filter((doc) => {
    const matchesSearch = !search || doc.title.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === "all" || doc.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const isLoading = clientsLoading || (isAllClients ? allDocsLoading : clientDocsLoading);
  const addDialogClientId = isAllClients ? (clients?.[0]?.id ?? null) : effectiveClientId;

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: getListAllDocumentsQueryKey() });
    if (effectiveClientId) {
      queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey(effectiveClientId) });
    }
  }

  if (!clientsLoading && (!clients || clients.length === 0)) {
    return (
      <div className="space-y-6">
        <PageHeader title="Documents" description="Central hub for all client files and links" />
        <div className="flex flex-col items-center justify-center py-20 text-center border rounded-xl bg-card/30 border-dashed">
          <h3 className="text-lg font-semibold mb-1">No clients yet</h3>
          <p className="text-muted-foreground text-sm max-w-sm">Add a client first to start managing documents.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Documents" description="Central hub for all client files and links">
        <Button className="gap-2" onClick={() => setDialogOpen(true)}>
          <Plus size={16} /> Add Document
        </Button>
      </PageHeader>

      <AddDocumentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        clientId={isAllClients ? null : effectiveClientId}
        clients={clients}
      />

      {/* Client selector */}
      {clients && clients.length > 0 && (
        <div className="flex items-center gap-3">
          <Label htmlFor="doc-client-select" className="text-sm font-medium shrink-0">Client</Label>
          <Select value={selectedClientId} onValueChange={setSelectedClientId}>
            <SelectTrigger id="doc-client-select" className="w-56 bg-card/50">
              <SelectValue placeholder="Select client" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Clients</SelectItem>
              {clients.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>{c.companyName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
          <Input
            placeholder="Search documents..."
            className="pl-9 bg-card/50"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-40 bg-card/50 gap-2">
              <Filter size={14} className="text-muted-foreground shrink-0" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {DOC_TYPES.map((t) => (
                <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-28 rounded-xl bg-card/40 animate-pulse border border-border/50" />
          ))}
        </div>
      ) : !filteredDocs || filteredDocs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center border rounded-xl bg-card/30 border-dashed">
          <h3 className="text-lg font-semibold mb-1">No documents found</h3>
          <p className="text-muted-foreground text-sm max-w-sm mb-6">
            {search || typeFilter !== "all"
              ? "No documents match your filters."
              : isAllClients
                ? "No documents yet across any client."
                : "No documents for this client yet."}
          </p>
          {!search && typeFilter === "all" && (
            <Button onClick={() => setDialogOpen(true)}>Add Document</Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDocs.map((doc) => (
            <DocumentCard
              key={doc.id}
              doc={doc}
              clients={clients}
              onDeleted={invalidateAll}
              onUpdated={invalidateAll}
            />
          ))}
        </div>
      )}
    </div>
  );
}
