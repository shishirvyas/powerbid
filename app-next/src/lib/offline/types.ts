/**
 * Shared types for the offline-first data layer.
 *
 * Design rule: every record stored in IndexedDB conforms to `BaseRecord`.
 * The UI never writes directly to the network. Writes go local-first; the
 * outbox queue is the *only* mechanism that pushes mutations to the server.
 */

export type SyncStatus = 'draft' | 'pending' | 'synced' | 'error';

export type EntityName = 'inquiries' | 'quotations' | 'salesOrders';

export type OutboxOp = 'create' | 'update' | 'delete';

/**
 * Discriminated action type, used by both the queue and the wire protocol.
 * Naming follows ACTION_NOUN convention used across ERP audit/event logs.
 */
export type OutboxActionType =
  | 'CREATE_INQUIRY'   | 'UPDATE_INQUIRY'   | 'DELETE_INQUIRY'
  | 'CREATE_QUOTATION' | 'UPDATE_QUOTATION' | 'DELETE_QUOTATION'
  | 'CREATE_SALES_ORDER' | 'UPDATE_SALES_ORDER' | 'DELETE_SALES_ORDER';

/**
 * Lifecycle of a queued operation:
 *   pending   — waiting in queue, eligible at `nextAttemptAt`
 *   in_flight — currently being sent (single-flight guard)
 *   failed    — last attempt failed; will be retried per backoff schedule
 *   parked    — retries exhausted or permanent error; awaits manual retry
 */
export type OutboxStatus = 'pending' | 'in_flight' | 'failed' | 'parked';

export interface BaseRecord {
  /** Local UUID. Stable for the lifetime of the record on this device. */
  id: string;
  /** Server-assigned id, populated after the first successful sync. */
  serverId: string | null;
  /** True only when local state matches the last server-acknowledged state. */
  isSynced: boolean;
  /** Last local mutation timestamp (ms since epoch). */
  lastModified: number;
  /** Coarse status used by the UI to render badges. */
  syncStatus: SyncStatus;
  /** Last sync error message, if any. */
  syncError?: string | null;
}

/**
 * One queued mutation. The queue is append-only from the UI's perspective;
 * only the sync engine drains it.
 */
export interface OutboxItem {
  id: string;
  /** ACTION_NOUN string — used as the action label and for the audit trail. */
  type: OutboxActionType;
  entity: EntityName;
  op: OutboxOp;
  /** Local id of the record this mutation targets. */
  recordId: string;
  /** Snapshot of the record at enqueue time (for create/update). */
  payload: unknown;
  /**
   * Stable per-operation key. Sent to the server as `Idempotency-Key` so
   * retries (after timeouts, network failures, app crashes) can be deduped.
   * Survives across page reloads because it is generated at enqueue time
   * and persisted with the row.
   */
  idempotencyKey: string;
  status: OutboxStatus;
  attempts: number;
  /** Earliest time (ms) at which this item is eligible for retry. */
  nextAttemptAt: number;
  createdAt: number;
  updatedAt: number;
  lastError?: string | null;
}

/** Domain-specific shapes layered on top of BaseRecord. Extend as needed. */
export interface InquiryRecord extends BaseRecord {
  customerId: string | null;
  subject: string;
  notes?: string;
  items?: Array<{ productId: string; qty: number; rate?: number }>;
}

export interface QuotationRecord extends BaseRecord {
  inquiryId: string | null;
  customerId: string | null;
  number?: string;
  total?: number;
  items?: Array<{ productId: string; qty: number; rate: number }>;
}

export interface SalesOrderRecord extends BaseRecord {
  quotationId: string | null;
  customerId: string | null;
  number?: string;
  total?: number;
  items?: Array<{ productId: string; qty: number; rate: number }>;
}
