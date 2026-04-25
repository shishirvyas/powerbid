/**
 * Lightweight activity logger backed by the audit_log table.
 * Captures structured events — entity creates, status changes, sends, clones, etc.
 * Failures here must never break the originating request.
 */
import { auditLog } from "../db/schema";
import type { DB } from "../db/client";

export interface ActivityEvent {
  entity: "customer" | "inquiry" | "quotation" | "user";
  entityId: number;
  action: string;
  userId?: number | null;
  payload?: Record<string, unknown> | null;
}

export async function logActivity(db: DB, event: ActivityEvent): Promise<void> {
  try {
    await db.insert(auditLog).values({
      entity: event.entity,
      entityId: event.entityId,
      action: event.action,
      userId: event.userId ?? null,
      payload: event.payload ? JSON.stringify(event.payload) : null,
    });
  } catch {
    // Swallow — activity logging is best-effort.
  }
}
