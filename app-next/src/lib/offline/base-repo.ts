/**
 * Generic CRUD helper for offline-first entities.
 *
 * Every write is wrapped in a single Dexie rw-transaction that touches the
 * entity table AND the outbox table. This is the only safe way to keep
 * local state and the sync queue consistent.
 *
 * Components should NEVER import `fetch` for these entities — they import
 * a repo and call create/update/remove. The sync engine is responsible
 * for transmitting changes.
 */

import { nanoid } from 'nanoid';
import { db, entityTables } from './db';
import { enqueueInTx } from './outbox';
import type { BaseRecord, EntityName } from './types';

export interface Repo<T extends BaseRecord> {
  list(): Promise<T[]>;
  get(id: string): Promise<T | undefined>;
  create(input: Partial<Omit<T, keyof BaseRecord>> & Partial<Pick<T, 'id'>>): Promise<T>;
  update(id: string, patch: Partial<Omit<T, keyof BaseRecord>>): Promise<T | undefined>;
  remove(id: string): Promise<void>;
}

/**
 * Build a repo for an entity. The generic `T` is the *domain* shape —
 * the repo automatically attaches and maintains the BaseRecord fields
 * (id, serverId, isSynced, lastModified, syncStatus).
 */
export function createRepo<T extends BaseRecord>(entity: EntityName): Repo<T> {
  const table = () => entityTables[entity]() as unknown as import('dexie').Table<T, string>;

  return {
    list() {
      return table().orderBy('lastModified').reverse().toArray();
    },

    get(id) {
      return table().get(id);
    },

    async create(input) {
      const now = Date.now();
      const row = {
        ...(input as object),
        id: input.id ?? nanoid(),
        serverId: null,
        isSynced: false,
        lastModified: now,
        syncStatus: 'draft',
        syncError: null,
      } as T;

      await db.transaction('rw', table(), db.outbox, async () => {
        await table().put(row);
        await enqueueInTx({
          entity,
          op: 'create',
          recordId: row.id,
          payload: row,
        });
        // Flip to 'pending' once it's actually on the queue.
        row.syncStatus = 'pending';
        await table().put(row);
      });

      return { ...row, syncStatus: 'pending' };
    },

    async update(id, patch) {
      let next: T | undefined;
      await db.transaction('rw', table(), db.outbox, async () => {
        const cur = await table().get(id);
        if (!cur) return;
        next = {
          ...cur,
          ...(patch as object),
          // Always overwrite the lifecycle fields — callers cannot bypass them.
          id: cur.id,
          serverId: cur.serverId,
          isSynced: false,
          lastModified: Date.now(),
          syncStatus: 'pending',
          syncError: null,
        } as T;
        await table().put(next);
        await enqueueInTx({
          entity,
          op: 'update',
          recordId: id,
          payload: next,
        });
      });
      return next;
    },

    async remove(id) {
      await db.transaction('rw', table(), db.outbox, async () => {
        const cur = await table().get(id);
        if (!cur) return;
        await table().delete(id);
        await enqueueInTx({
          entity,
          op: 'delete',
          recordId: id,
          payload: { id, serverId: cur.serverId },
        });
      });
    },
  };
}
