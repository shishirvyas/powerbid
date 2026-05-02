/**
 * Outbox queue.
 *
 * Contract:
 *   - The UI never calls the network. It only calls repo methods, which
 *     write to a domain table AND enqueue an OutboxItem in a single
 *     Dexie transaction. Atomicity guarantees we never have a "ghost"
 *     local row without a corresponding queued mutation, or vice-versa.
 *   - The sync engine is the sole consumer of this queue.
 *   - Coalescing: consecutive `update`s on the same record are folded
 *     into the latest pending item to avoid a stampede after bulk edits.
 *     `create` followed by `update` keeps the op as `create` with the
 *     newest payload. `delete` collapses any prior pending ops for the
 *     same record (if it was never created server-side, both are dropped).
 */

import { nanoid } from 'nanoid';
import { db } from './db';
import type { EntityName, OutboxActionType, OutboxItem, OutboxOp } from './types';

export interface EnqueueArgs {
  entity: EntityName;
  op: OutboxOp;
  recordId: string;
  payload: unknown;
}

/** Map (entity, op) -> ACTION_NOUN string. */
function actionType(entity: EntityName, op: OutboxOp): OutboxActionType {
  const noun =
    entity === 'inquiries'   ? 'INQUIRY'
  : entity === 'quotations'  ? 'QUOTATION'
  : 'SALES_ORDER';
  return `${op.toUpperCase()}_${noun}` as OutboxActionType;
}

/**
 * Enqueue a mutation. MUST be called from inside an existing Dexie
 * transaction that also writes the domain row, so the two operations
 * commit atomically. Use `db.transaction('rw', table, db.outbox, ...)`.
 */
export async function enqueueInTx(args: EnqueueArgs): Promise<void> {
  const now = Date.now();
  const existing = await db.outbox
    .where('[entity+recordId]')
    .equals([args.entity, args.recordId])
    .toArray();

  // Coalescing rules.
  if (args.op === 'delete') {
    const hadPendingCreate = existing.some((i) => i.op === 'create');
    if (existing.length) {
      await db.outbox.bulkDelete(existing.map((i) => i.id));
    }
    if (hadPendingCreate) {
      // Record never reached the server — nothing to delete remotely.
      return;
    }
    await db.outbox.put({
      id: nanoid(),
      type: actionType(args.entity, 'delete'),
      entity: args.entity,
      op: 'delete',
      recordId: args.recordId,
      payload: args.payload,
      idempotencyKey: nanoid(),
      status: 'pending',
      attempts: 0,
      nextAttemptAt: now,
      createdAt: now,
      updatedAt: now,
      lastError: null,
    });
    return;
  }

  if (args.op === 'update') {
    const pending = existing.find((i) => i.op === 'create' || i.op === 'update');
    if (pending) {
      // Fold into the existing pending op. Keep the original idempotencyKey
      // so a partially-delivered request and the folded retry are still
      // deduped server-side.
      await db.outbox.update(pending.id, {
        payload: args.payload,
        status: 'pending',
        attempts: 0,
        nextAttemptAt: now,
        updatedAt: now,
        lastError: null,
      });
      return;
    }
  }

  await db.outbox.put({
    id: nanoid(),
    type: actionType(args.entity, args.op),
    entity: args.entity,
    op: args.op,
    recordId: args.recordId,
    payload: args.payload,
    idempotencyKey: nanoid(),
    status: 'pending',
    attempts: 0,
    nextAttemptAt: now,
    createdAt: now,
    updatedAt: now,
    lastError: null,
  });
}

/** Items currently due for a sync attempt, oldest first. Excludes parked items. */
export function dueItems(now: number = Date.now()): Promise<OutboxItem[]> {
  return db.outbox
    .where('nextAttemptAt')
    .belowOrEqual(now)
    .filter((i) => i.status !== 'parked' && i.status !== 'in_flight')
    .sortBy('createdAt');
}

export function pendingCount(): Promise<number> {
  return db.outbox.where('status').anyOf('pending', 'failed', 'in_flight').count();
}

export function errorCount(): Promise<number> {
  return db.outbox.where('status').anyOf('failed', 'parked').count();
}

