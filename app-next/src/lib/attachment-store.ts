export type AttachmentEntityType = "inquiries" | "quotations";

export type AttachmentSummary = {
  id: string;
  fileName: string;
  contentType: string;
  size: number;
  createdAt: string;
};

type StoredAttachment = AttachmentSummary & {
  bytes: Uint8Array;
};

const store: Record<AttachmentEntityType, Map<number, StoredAttachment[]>> = {
  inquiries: new Map(),
  quotations: new Map(),
};

function bucket(entityType: AttachmentEntityType, entityId: number) {
  const entityBucket = store[entityType];
  const current = entityBucket.get(entityId);
  if (current) return current;
  const created: StoredAttachment[] = [];
  entityBucket.set(entityId, created);
  return created;
}

export function listAttachments(entityType: AttachmentEntityType, entityId: number): AttachmentSummary[] {
  return bucket(entityType, entityId).map(({ bytes: _bytes, ...meta }) => meta);
}

export function addAttachments(
  entityType: AttachmentEntityType,
  entityId: number,
  files: Array<{ fileName: string; contentType: string; size: number; bytes: Uint8Array }>,
): AttachmentSummary[] {
  const current = bucket(entityType, entityId);
  const added = files.map<StoredAttachment>((file) => ({
    id: crypto.randomUUID(),
    fileName: file.fileName,
    contentType: file.contentType,
    size: file.size,
    bytes: file.bytes,
    createdAt: new Date().toISOString(),
  }));
  current.unshift(...added);
  return added.map(({ bytes: _bytes, ...meta }) => meta);
}

export function getAttachment(entityType: AttachmentEntityType, entityId: number, attachmentId: string) {
  return bucket(entityType, entityId).find((item) => item.id === attachmentId) ?? null;
}

export function removeAttachment(entityType: AttachmentEntityType, entityId: number, attachmentId: string) {
  const current = bucket(entityType, entityId);
  const index = current.findIndex((item) => item.id === attachmentId);
  if (index === -1) return false;
  current.splice(index, 1);
  return true;
}