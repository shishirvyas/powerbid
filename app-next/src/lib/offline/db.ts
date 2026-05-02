/**
 * Dexie schema for the local-first ERP store.
 *
 * Tables:
 *   - inquiries / quotations / salesOrders : domain entities (BaseRecord shape)
 *   - outbox : pending mutations queued for the sync engine
 *   - meta   : key/value bag (e.g. lastPulledAt)
 *
 * Indexes are chosen to support the queries we actually run:
 *   - syncStatus + lastModified : list sorting + status filters
 *   - serverId : reconciliation after pull
 *   - outbox.nextAttemptAt : drain "due" items efficiently
 */

import Dexie, { type Table } from 'dexie';
import type {
  InquiryRecord,
  QuotationRecord,
  SalesOrderRecord,
  OutboxItem,
} from './types';

export interface MetaRow {
  key: string;
  value: unknown;
}

export class PowerBidDB extends Dexie {
  inquiries!: Table<InquiryRecord, string>;
  quotations!: Table<QuotationRecord, string>;
  salesOrders!: Table<SalesOrderRecord, string>;
  outbox!: Table<OutboxItem, string>;
  meta!: Table<MetaRow, string>;

  constructor() {
    super('powerbid');
    this.version(1).stores({
      inquiries:   'id, serverId, syncStatus, lastModified, customerId',
      quotations:  'id, serverId, syncStatus, lastModified, customerId, inquiryId',
      salesOrders: 'id, serverId, syncStatus, lastModified, customerId, quotationId',
      outbox:      'id, entity, recordId, nextAttemptAt, createdAt, [entity+recordId]',
      meta:        'key',
    });

    // v2: extend outbox with `type`, `status`, `idempotencyKey`, `updatedAt`.
    // Existing rows are upgraded on open: type derived from entity+op,
    // status defaults to 'pending', idempotencyKey synthesized from id.
    this.version(2)
      .stores({
        inquiries:   'id, serverId, syncStatus, lastModified, customerId',
        quotations:  'id, serverId, syncStatus, lastModified, customerId, inquiryId',
        salesOrders: 'id, serverId, syncStatus, lastModified, customerId, quotationId',
        outbox:      'id, type, status, entity, recordId, nextAttemptAt, createdAt, [entity+recordId]',
        meta:        'key',
      })
      .upgrade(async (tx) => {
        await tx
          .table('outbox')
          .toCollection()
          .modify((row: Record<string, unknown>) => {
            const entity = String(row.entity ?? '');
            const op = String(row.op ?? 'create');
            const noun =
              entity === 'inquiries'   ? 'INQUIRY'
            : entity === 'quotations'  ? 'QUOTATION'
            : entity === 'salesOrders' ? 'SALES_ORDER'
            : 'UNKNOWN';
            row.type = `${op.toUpperCase()}_${noun}`;
            row.status = (row.attempts as number ?? 0) > 0 ? 'failed' : 'pending';
            row.idempotencyKey = row.idempotencyKey ?? row.id;
            row.updatedAt = row.updatedAt ?? row.createdAt ?? Date.now();
          });
      });
  }
}

/** Singleton DB. Do NOT instantiate elsewhere. */
export const db = new PowerBidDB();

/** Convenience map for generic repo code. Keep in sync with `EntityName`. */
export const entityTables = {
  inquiries:   () => db.inquiries,
  quotations:  () => db.quotations,
  salesOrders: () => db.salesOrders,
} as const;
