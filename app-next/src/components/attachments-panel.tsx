"use client";

import * as React from "react";
import { Paperclip, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, ApiClientError } from "@/lib/api-client";
import { useResource } from "@/lib/hooks";
import type { AttachmentEntityType, AttachmentSummary } from "@/lib/attachment-store";

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export async function uploadEntityAttachments(
  entityType: AttachmentEntityType,
  entityId: number,
  files: File[],
) {
  if (files.length === 0) return [];
  const body = new FormData();
  for (const file of files) body.append("files", file);
  return api<AttachmentSummary[]>(`/api/${entityType}/${entityId}/attachments`, {
    method: "POST",
    body,
  });
}

export function AttachmentsPanel({
  entityType,
  entityId,
  pendingFiles,
  onPendingFilesChange,
  emptyMessage,
}: {
  entityType: AttachmentEntityType;
  entityId?: number;
  pendingFiles: File[];
  onPendingFilesChange: (files: File[]) => void;
  emptyMessage?: string;
}) {
  const { data, loading, refresh } = useResource<AttachmentSummary[]>(
    entityId ? `/api/${entityType}/${entityId}/attachments` : null,
  );
  const [uploading, setUploading] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  async function handleSelected(fileList: FileList | null) {
    const selected = Array.from(fileList ?? []);
    if (selected.length === 0) return;
    if (!entityId) {
      onPendingFilesChange([...pendingFiles, ...selected]);
      toast.success(`${selected.length} attachment${selected.length > 1 ? "s" : ""} queued for first save`);
      return;
    }
    setUploading(true);
    try {
      await uploadEntityAttachments(entityType, entityId, selected);
      toast.success(`${selected.length} attachment${selected.length > 1 ? "s" : ""} uploaded`);
      refresh();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Attachment upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function deleteExisting(attachmentId: string) {
    if (!entityId) return;
    setDeletingId(attachmentId);
    try {
      await api(`/api/${entityType}/${entityId}/attachments/${attachmentId}`, { method: "DELETE" });
      toast.success("Attachment removed");
      refresh();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Failed to delete attachment");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground">
        {entityId
          ? "Upload one or more files. They are kept in server memory for this POC and reset on server restart."
          : emptyMessage ?? "You can add multiple files now. They will upload automatically after the first save."}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          type="file"
          multiple
          onChange={(e) => {
            void handleSelected(e.target.files);
            e.currentTarget.value = "";
          }}
          disabled={uploading}
        />
        {uploading ? (
          <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Upload className="h-4 w-4 animate-pulse" /> Uploading...
          </div>
        ) : null}
      </div>

      {pendingFiles.length ? (
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Queued for upload</div>
          {pendingFiles.map((file, index) => (
            <div key={`${file.name}-${index}`} className="flex items-center justify-between rounded-md border bg-muted/20 px-3 py-2 text-sm">
              <div className="min-w-0">
                <div className="truncate font-medium">{file.name}</div>
                <div className="text-xs text-muted-foreground">{formatBytes(file.size)}</div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onPendingFilesChange(pendingFiles.filter((_, pendingIndex) => pendingIndex !== index))}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      ) : null}

      <div className="space-y-2">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">Uploaded attachments</div>
        {!entityId ? (
          <div className="rounded-md border border-dashed px-3 py-6 text-sm text-muted-foreground">
            Save the record once to persist attachments.
          </div>
        ) : loading ? (
          <div className="rounded-md border border-dashed px-3 py-6 text-sm text-muted-foreground">Loading attachments...</div>
        ) : data && data.length > 0 ? (
          data.map((attachment) => (
            <div key={attachment.id} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
              <a
                href={`/api/${entityType}/${entityId}/attachments/${attachment.id}`}
                className="min-w-0 flex-1"
                download={attachment.fileName}
              >
                <div className="flex items-center gap-2 font-medium">
                  <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{attachment.fileName}</span>
                </div>
                <div className="pl-6 text-xs text-muted-foreground">
                  {formatBytes(attachment.size)} • {new Date(attachment.createdAt).toLocaleString()}
                </div>
              </a>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={deletingId === attachment.id}
                onClick={() => void deleteExisting(attachment.id)}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))
        ) : (
          <div className="rounded-md border border-dashed px-3 py-6 text-sm text-muted-foreground">No attachments uploaded yet.</div>
        )}
      </div>
    </div>
  );
}