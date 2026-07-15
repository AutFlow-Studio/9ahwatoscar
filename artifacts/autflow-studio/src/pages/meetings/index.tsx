import {
  useListMeetings,
  useCreateMeeting,
  useUpdateMeeting,
  useDeleteMeeting,
  useListClients,
  getListMeetingsQueryKey,
  type MeetingInput,
  type MeetingUpdate,
  type Meeting,
} from "@workspace/api-client-react";
import { PageHeader } from "@/components/page-header";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useRef, useState } from "react";
import {
  Plus,
  Paperclip,
  Download,
  Trash2,
  Edit2,
  Calendar,
  ChevronDown,
  ChevronUp,
  File,
  Upload,
  X,
  Users,
} from "lucide-react";

// ─── Attachment model ────────────────────────────────────────────────────────

interface MeetingAttachment {
  objectPath: string; // e.g. "/objects/uploads/uuid"
  name: string;
  size: number;
  contentType: string;
}

function parseAttachments(raw: string | null | undefined): MeetingAttachment[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function serializeAttachments(atts: MeetingAttachment[]): string {
  return JSON.stringify(atts);
}

function fileServeUrl(objectPath: string, filename?: string): string {
  const base = `/api/storage${objectPath}`;
  return filename ? `${base}?filename=${encodeURIComponent(filename)}` : base;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const ACCEPTED_FILE_TYPES = ".pdf,.docx,.doc,.xlsx,.xls,.png,.jpg,.jpeg";
const MAX_FILE_SIZE_MB = 50;

// ─── Upload helpers ──────────────────────────────────────────────────────────

async function requestUploadUrl(file: File): Promise<{ uploadURL: string; objectPath: string }> {
  const res = await fetch("/api/storage/uploads/request-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as any).error ?? "Failed to get upload URL");
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

async function deleteStorageObject(objectPath: string): Promise<void> {
  await fetch(`/api/storage${objectPath}`, {
    method: "DELETE",
    credentials: "include",
  });
}

async function uploadAttachment(
  file: File,
  onProgress?: (pct: number) => void,
): Promise<MeetingAttachment> {
  onProgress?.(10);
  const { uploadURL, objectPath } = await requestUploadUrl(file);
  onProgress?.(40);
  await uploadToGcs(uploadURL, file);
  onProgress?.(100);
  return { objectPath, name: file.name, size: file.size, contentType: file.type };
}

// ─── Attachment pill component ───────────────────────────────────────────────

function AttachmentPill({
  att,
  onDelete,
  deletable = false,
}: {
  att: MeetingAttachment;
  onDelete?: () => void;
  deletable?: boolean;
}) {
  return (
    <div className="inline-flex items-center gap-1.5 pl-2.5 pr-1 py-1 rounded-full border border-border/60 bg-secondary/60 text-xs max-w-[220px]">
      <File size={11} className="text-muted-foreground flex-shrink-0" />
      <span className="truncate flex-1">{att.name}</span>
      <span className="text-muted-foreground flex-shrink-0">{formatBytes(att.size)}</span>
      <a
        href={fileServeUrl(att.objectPath, att.name)}
        target="_blank"
        rel="noreferrer"
        className="flex-shrink-0 p-0.5 rounded-full hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
        title="Download"
        onClick={(e) => e.stopPropagation()}
      >
        <Download size={11} />
      </a>
      {deletable && onDelete && (
        <button
          type="button"
          className="flex-shrink-0 p-0.5 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
          title="Remove attachment"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
        >
          <X size={11} />
        </button>
      )}
    </div>
  );
}

// ─── File queue for dialogs ──────────────────────────────────────────────────

function FileQueueItem({
  file,
  onRemove,
  uploading,
  progress,
}: {
  file: File;
  onRemove: () => void;
  uploading: boolean;
  progress: number;
}) {
  return (
    <div className="flex items-center gap-2 p-2 rounded-lg border border-border/50 bg-secondary/30 text-xs">
      <File size={13} className="text-muted-foreground flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="truncate font-medium">{file.name}</p>
        {uploading ? (
          <div className="mt-1 h-1 w-full rounded-full bg-secondary overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
        ) : (
          <p className="text-muted-foreground">{formatBytes(file.size)}</p>
        )}
      </div>
      {!uploading && (
        <button type="button" onClick={onRemove} className="flex-shrink-0 text-muted-foreground hover:text-destructive transition-colors p-0.5">
          <X size={13} />
        </button>
      )}
    </div>
  );
}

// ─── Attachment uploader sub-component ──────────────────────────────────────

function AttachmentUploader({
  existing,
  onExistingDelete,
  pendingFiles,
  onAddFiles,
  onRemovePending,
  uploadingIdx,
  uploadProgress,
}: {
  existing: MeetingAttachment[];
  onExistingDelete: (idx: number) => void;
  pendingFiles: File[];
  onAddFiles: (files: File[]) => void;
  onRemovePending: (idx: number) => void;
  uploadingIdx: number; // -1 = not uploading, ≥0 = index being uploaded
  uploadProgress: number;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const added = Array.from(e.target.files ?? []).filter(
      (f) => f.size <= MAX_FILE_SIZE_MB * 1024 * 1024,
    );
    onAddFiles(added);
    e.target.value = "";
  }

  return (
    <div className="space-y-2">
      <Label>Attachments</Label>

      {/* Existing saved attachments */}
      {existing.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {existing.map((att, i) => (
            <AttachmentPill key={att.objectPath} att={att} deletable onDelete={() => onExistingDelete(i)} />
          ))}
        </div>
      )}

      {/* Pending uploads */}
      {pendingFiles.length > 0 && (
        <div className="space-y-1">
          {pendingFiles.map((f, i) => (
            <FileQueueItem
              key={i}
              file={f}
              onRemove={() => onRemovePending(i)}
              uploading={uploadingIdx === i}
              progress={uploadingIdx === i ? uploadProgress : 0}
            />
          ))}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_FILE_TYPES}
        multiple
        className="hidden"
        onChange={handleInputChange}
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="flex items-center gap-2 px-3 py-2 w-full rounded-lg border border-dashed border-border text-xs text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors"
        disabled={uploadingIdx >= 0}
      >
        <Upload size={13} />
        {existing.length + pendingFiles.length > 0 ? "Add more files…" : "Attach files (PDF, DOCX, XLSX, PNG, JPG)"}
      </button>
    </div>
  );
}

// ─── Log / Edit Meeting Dialog ───────────────────────────────────────────────

type MeetingFormData = {
  clientId: string;
  date: string; // datetime-local value
  summary: string;
  actionItems: string;
  nextMeeting: string;
};

const EMPTY_FORM: MeetingFormData = {
  clientId: "",
  date: "",
  summary: "",
  actionItems: "",
  nextMeeting: "",
};

function MeetingDialog({
  open,
  onOpenChange,
  mode,
  meeting,
  defaultClientId,
  clients,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mode: "create" | "edit";
  meeting?: Meeting;
  defaultClientId?: number | null;
  clients?: { id: number; companyName: string }[];
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const { mutate: createMeeting, isPending: isCreating } = useCreateMeeting();
  const { mutate: updateMeeting, isPending: isUpdating } = useUpdateMeeting();

  // Form fields
  const [form, setForm] = useState<MeetingFormData>(() =>
    meeting
      ? {
          clientId: String(meeting.clientId),
          date: meeting.date ? format(new Date(meeting.date), "yyyy-MM-dd'T'HH:mm") : "",
          summary: meeting.summary ?? "",
          actionItems: meeting.actionItems ?? "",
          nextMeeting: meeting.nextMeeting ? format(new Date(meeting.nextMeeting), "yyyy-MM-dd'T'HH:mm") : "",
        }
      : { ...EMPTY_FORM, clientId: defaultClientId ? String(defaultClientId) : "" },
  );

  // Existing attachments (for edit mode)
  const [existingAtts, setExistingAtts] = useState<MeetingAttachment[]>(
    () => (mode === "edit" ? parseAttachments(meeting?.attachments) : []),
  );
  // Pending file queue (not yet uploaded)
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploadingIdx, setUploadingIdx] = useState(-1);
  const [uploadProgress, setUploadProgress] = useState(0);

  const isSaving = isCreating || isUpdating;
  const isUploading = uploadingIdx >= 0;

  function resetDialog() {
    setForm({ ...EMPTY_FORM, clientId: defaultClientId ? String(defaultClientId) : "" });
    setExistingAtts([]);
    setPendingFiles([]);
    setUploadingIdx(-1);
    setUploadProgress(0);
  }

  function handleClose() {
    resetDialog();
    onOpenChange(false);
  }

  async function uploadAllPending(): Promise<MeetingAttachment[]> {
    const uploaded: MeetingAttachment[] = [];
    for (let i = 0; i < pendingFiles.length; i++) {
      setUploadingIdx(i);
      setUploadProgress(0);
      try {
        const att = await uploadAttachment(pendingFiles[i], setUploadProgress);
        uploaded.push(att);
      } catch (err) {
        toast({
          title: "Upload failed",
          description: `Could not upload "${pendingFiles[i].name}": ${err instanceof Error ? err.message : "Unknown error"}`,
          variant: "destructive",
        });
        setUploadingIdx(-1);
        throw err;
      }
    }
    setUploadingIdx(-1);
    return uploaded;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.clientId || !form.date) return;

    let newlyUploaded: MeetingAttachment[] = [];
    if (pendingFiles.length > 0) {
      try {
        newlyUploaded = await uploadAllPending();
      } catch {
        return; // toast already shown
      }
    }

    const allAttachments = [...existingAtts, ...newlyUploaded];
    const attachmentsJson = allAttachments.length > 0 ? serializeAttachments(allAttachments) : undefined;

    const payload = {
      clientId: parseInt(form.clientId, 10),
      date: new Date(form.date).toISOString(),
      summary: form.summary.trim() || undefined,
      actionItems: form.actionItems.trim() || undefined,
      nextMeeting: form.nextMeeting ? new Date(form.nextMeeting).toISOString() : undefined,
      attachments: attachmentsJson,
    };

    if (mode === "create") {
      createMeeting(
        { data: payload as MeetingInput },
        {
          onSuccess: () => {
            toast({ title: "Meeting logged" });
            handleClose();
            onSaved();
          },
          onError: () => toast({ title: "Failed to log meeting", variant: "destructive" }),
        },
      );
    } else if (meeting) {
      updateMeeting(
        { id: meeting.id, data: payload as MeetingUpdate },
        {
          onSuccess: () => {
            toast({ title: "Meeting updated" });
            handleClose();
            onSaved();
          },
          onError: () => toast({ title: "Failed to update meeting", variant: "destructive" }),
        },
      );
    }
  }

  function handleExistingDelete(idx: number) {
    const att = existingAtts[idx];
    // Fire-and-forget GCS delete — server-side will also clean up if meeting is deleted
    deleteStorageObject(att.objectPath).catch(() => {});
    setExistingAtts((prev) => prev.filter((_, i) => i !== idx));
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else onOpenChange(v); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Log Meeting" : "Edit Meeting"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Client */}
          <div className="space-y-1.5">
            <Label htmlFor="m-client">Client *</Label>
            <Select
              value={form.clientId}
              onValueChange={(v) => setForm((f) => ({ ...f, clientId: v }))}
              required
            >
              <SelectTrigger id="m-client"><SelectValue placeholder="Select a client…" /></SelectTrigger>
              <SelectContent>
                {clients?.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.companyName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date */}
          <div className="space-y-1.5">
            <Label htmlFor="m-date">Date & Time *</Label>
            <Input
              id="m-date"
              type="datetime-local"
              required
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
            />
          </div>

          {/* Summary */}
          <div className="space-y-1.5">
            <Label htmlFor="m-summary">Summary</Label>
            <Textarea
              id="m-summary"
              rows={3}
              placeholder="Key topics discussed…"
              value={form.summary}
              onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
            />
          </div>

          {/* Action Items */}
          <div className="space-y-1.5">
            <Label htmlFor="m-actions">Action Items</Label>
            <Textarea
              id="m-actions"
              rows={2}
              placeholder="Next steps and owners…"
              value={form.actionItems}
              onChange={(e) => setForm((f) => ({ ...f, actionItems: e.target.value }))}
            />
          </div>

          {/* Next Meeting */}
          <div className="space-y-1.5">
            <Label htmlFor="m-next">Next Meeting (optional)</Label>
            <Input
              id="m-next"
              type="datetime-local"
              value={form.nextMeeting}
              onChange={(e) => setForm((f) => ({ ...f, nextMeeting: e.target.value }))}
            />
          </div>

          {/* Attachments */}
          <AttachmentUploader
            existing={existingAtts}
            onExistingDelete={handleExistingDelete}
            pendingFiles={pendingFiles}
            onAddFiles={(files) => setPendingFiles((prev) => [...prev, ...files])}
            onRemovePending={(idx) => setPendingFiles((prev) => prev.filter((_, i) => i !== idx))}
            uploadingIdx={uploadingIdx}
            uploadProgress={uploadProgress}
          />

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={isSaving || isUploading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving || isUploading || !form.clientId || !form.date}>
              {isUploading ? `Uploading ${uploadingIdx + 1}/${pendingFiles.length}…` : isSaving ? "Saving…" : mode === "create" ? "Log Meeting" : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Meeting Card ────────────────────────────────────────────────────────────

function MeetingCard({
  meeting,
  clients,
  onEdited,
  onDeleted,
}: {
  meeting: Meeting;
  clients?: { id: number; companyName: string }[];
  onEdited: () => void;
  onDeleted: () => void;
}) {
  const { toast } = useToast();
  const { mutate: deleteMeeting, isPending: isDeleting } = useDeleteMeeting();
  const [expanded, setExpanded] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const attachments = parseAttachments(meeting.attachments);

  function handleDelete() {
    if (!window.confirm("Delete this meeting record? This cannot be undone.")) return;
    deleteMeeting(
      { id: meeting.id },
      {
        onSuccess: () => {
          toast({ title: "Meeting deleted" });
          onDeleted();
        },
        onError: () => toast({ title: "Failed to delete meeting", variant: "destructive" }),
      },
    );
  }

  const clientName = meeting.clientName
    ?? clients?.find((c) => c.id === meeting.clientId)?.companyName
    ?? "Unknown Client";

  return (
    <>
      <div className="rounded-xl border border-border/50 bg-card/40 backdrop-blur-sm overflow-hidden hover:border-border transition-colors">
        {/* Header row */}
        <div className="p-4 flex items-start gap-4">
          {/* Date badge */}
          <div className="flex-shrink-0 w-12 text-center">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {format(new Date(meeting.date), "MMM")}
            </div>
            <div className="text-2xl font-bold leading-none">
              {format(new Date(meeting.date), "d")}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              {format(new Date(meeting.date), "yyyy")}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-sm">{clientName}</span>
              <span className="text-[10px] text-muted-foreground font-mono">
                {format(new Date(meeting.date), "h:mm a")}
              </span>
              {attachments.length > 0 && (
                <span className="flex items-center gap-1 text-[10px] text-primary bg-primary/10 rounded-full px-2 py-0.5">
                  <Paperclip size={9} />
                  {attachments.length}
                </span>
              )}
            </div>
            {meeting.summary && (
              <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                {meeting.summary}
              </p>
            )}
            {meeting.nextMeeting && (
              <div className="flex items-center gap-1 mt-1.5 text-[10px] text-muted-foreground">
                <Calendar size={10} />
                Next: {format(new Date(meeting.nextMeeting), "MMM d, yyyy 'at' h:mm a")}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
              onClick={() => setEditOpen(true)}
              title="Edit meeting"
            >
              <Edit2 size={13} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
              onClick={handleDelete}
              disabled={isDeleting}
              title="Delete meeting"
            >
              <Trash2 size={13} />
            </Button>
            {(meeting.actionItems || attachments.length > 0) && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                onClick={() => setExpanded((v) => !v)}
                title={expanded ? "Collapse" : "Expand"}
              >
                {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </Button>
            )}
          </div>
        </div>

        {/* Expanded section */}
        {expanded && (
          <div className="px-4 pb-4 space-y-3 border-t border-border/40 pt-3">
            {meeting.actionItems && (
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Action Items
                </div>
                <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
                  {meeting.actionItems}
                </p>
              </div>
            )}
            {attachments.length > 0 && (
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Attachments
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {attachments.map((att) => (
                    <AttachmentPill key={att.objectPath} att={att} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <MeetingDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        mode="edit"
        meeting={meeting}
        clients={clients}
        onSaved={onEdited}
      />
    </>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function MeetingsList() {
  const queryClient = useQueryClient();
  const [clientFilter, setClientFilter] = useState("all");
  const [logOpen, setLogOpen] = useState(false);

  const { data: clients } = useListClients();
  const effectiveClientId = clientFilter === "all" ? undefined : parseInt(clientFilter, 10);

  const { data: meetings, isLoading } = useListMeetings(
    effectiveClientId !== undefined ? { clientId: effectiveClientId } : undefined,
    { query: { queryKey: getListMeetingsQueryKey(effectiveClientId !== undefined ? { clientId: effectiveClientId } : undefined) } },
  );

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: getListMeetingsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListMeetingsQueryKey({ clientId: effectiveClientId }) });
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Meetings" description="Log and manage client meetings with file attachments">
        <Button className="gap-2" onClick={() => setLogOpen(true)}>
          <Plus size={16} /> Log Meeting
        </Button>
      </PageHeader>

      <MeetingDialog
        open={logOpen}
        onOpenChange={setLogOpen}
        mode="create"
        defaultClientId={clientFilter !== "all" ? effectiveClientId : null}
        clients={clients}
        onSaved={invalidate}
      />

      {/* Client filter */}
      {clients && clients.length > 0 && (
        <div className="flex items-center gap-3">
          <Label htmlFor="m-client-filter" className="text-sm font-medium shrink-0">
            <Users size={14} className="inline mr-1.5" />Client
          </Label>
          <Select value={clientFilter} onValueChange={setClientFilter}>
            <SelectTrigger id="m-client-filter" className="w-56 bg-card/50">
              <SelectValue />
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

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-card/40 animate-pulse border border-border/50" />
          ))}
        </div>
      ) : !meetings || meetings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center border rounded-xl bg-card/30 border-dashed">
          <Calendar size={32} className="text-muted-foreground mb-3 opacity-50" />
          <h3 className="text-lg font-semibold mb-1">No meetings yet</h3>
          <p className="text-muted-foreground text-sm max-w-sm mb-6">
            {clientFilter !== "all"
              ? "No meetings for this client."
              : "Log your first client meeting to get started."}
          </p>
          <Button onClick={() => setLogOpen(true)}>Log Meeting</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {meetings.map((m) => (
            <MeetingCard
              key={m.id}
              meeting={m}
              clients={clients}
              onEdited={invalidate}
              onDeleted={invalidate}
            />
          ))}
        </div>
      )}
    </div>
  );
}
