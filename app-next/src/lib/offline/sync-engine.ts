/**
 * Background sync engine.
 *
 * Responsibilities (and ONLY these):
 *   1. Drain the outbox queue, oldest-first, one item at a time.
 *   2. POST/PATCH/DELETE the corresponding REST endpoint.
 *   3. On success: reconcile (set serverId), mark record `synced`, drop the queue item.
 *   4. On failure: increment `attempts`, schedule next retry with exponential backoff,
 *      mark record `error` with the last error message.
 *   5. React to `online`, `visibilitychange`, and an interval ticker so sync resumes
 *      automatically without user intervention.
 *
 * This module is the ONLY place in the app that calls `fetch` for these entities.
 * UI code must go through repos. Do not import `fetch` for inquiries / quotations /
 * sales orders anywhere else.
 *
 * Concurrency: a single in-flight drain loop. `kickSync()` is idempotent — calling
 * it 100 times only runs one loop. Items are processed serially to keep server-side
 * ordering predictable (e.g. create-before-update on the same record).
 */

import { db } from './db';
import { dueItems } from './outbox';
import type {
  BaseRecord,
  EntityName,
  OutboxItem,
  SyncStatus,
} from './types';

// ─── Config ─────────────────────────────────────────────────────────────────

/** Endpoint path per entity. Kebab-case to match existing /app/api routes. */
const ENDPOINTS: Record<EntityName, string> = {
  inquiries: '/api/inquiries',
  quotations: '/api/quotations',
  salesOrders: '/api/sales-orders',
};

const TICK_MS = 15_000;
const MAX_ATTEMPTS = 8;          // After this, we stop auto-retrying; manual retry needed.
const BASE_BACKOFF_MS = 1_000;   // 1s, 2s, 4s … capped at MAX_BACKOFF_MS
const MAX_BACKOFF_MS = 5 * 60_000; // 5 min

// ─── Listener registry (no extra store dependency) ──────────────────────────

export interface SyncSnapshot {
  online: boolean;
  running: boolean;
  pending: number;
  errors: number;
  lastSyncedAt: number | null;
  lastError: string | null;
}

type Listener = (s: SyncSnapshot) => void;
const listeners = new Set<Listener>();

const state: SyncSnapshot = {
  online: typeof navigator !== 'undefined' ? navigator.onLine : true,
  running: false,
  pending: 0,
  errors: 0,
  lastSyncedAt: null,
  lastError: null,
};

// Cached immutable snapshot for useSyncExternalStore consumers.
// React requires getSnapshot() to return a stable reference between updates.
let cachedSnapshot: SyncSnapshot = { ...state };

function emit() {
  cachedSnapshot = { ...state };
  for (const l of listeners) l(cachedSnapshot);
}

export function subscribeSync(fn: Listener): () => void {
  listeners.add(fn);
  fn(cachedSnapshot);
  return () => listeners.delete(fn);
}

export function getSyncSnapshot(): SyncSnapshot {
  return cachedSnapshot;
}

async function refreshCounters() {
  state.pending = await db.outbox.where('status').anyOf('pending', 'failed', 'in_flight').count();
  state.errors = await db.outbox.where('status').anyOf('failed', 'parked').count();
  emit();
}

// ─── Core: process a single outbox item ─────────────────────────────────────

/**
 * Send one queued mutation. Pure function over (item) → server response.
 * Throws on network/HTTP failure so the caller can apply backoff.
 */
async function sendOne(item: OutboxItem): Promise<unknown> {
  const base = ENDPOINTS[item.entity];
  const payload = item.payload as (BaseRecord & Record<string, unknown>) | { id: string; serverId: string | null };
  const serverId = (payload as BaseRecord).serverId ?? null;

  let url: string;
  let method: 'POST' | 'PATCH' | 'DELETE';
  let body: string | undefined;

  switch (item.op) {
    case 'create':
      url = base;
      method = 'POST';
      body = JSON.stringify(stripLocalFields(payload as BaseRecord));
      break;
    case 'update':
      // If we have no serverId yet, an earlier create is still pending —
      // skip until the create lands. This is rare thanks to coalescing
      // but can happen across page reloads.
      if (!serverId) throw new RetryableError('awaiting-create');
      url = `${base}/${encodeURIComponent(serverId)}`;
      method = 'PATCH';
      body = JSON.stringify(stripLocalFields(payload as BaseRecord));
      break;
    case 'delete':
      if (!serverId) {
        // Never created server-side — coalescing should have dropped this,
        // but if we got here, treat as a no-op success.
        return null;
      }
      url = `${base}/${encodeURIComponent(serverId)}`;
      method = 'DELETE';
      break;
  }

  const res = await fetch(url, {
    method,
    headers: {
      // Idempotency-Key lets the server dedupe retries: if a request times
      // out but actually succeeded, the next attempt with the same key
      // returns the original result instead of creating a duplicate.
      'Idempotency-Key': item.idempotencyKey,
      'X-Action-Type': item.type,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body,
    credentials: 'same-origin',
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    // 4xx (except 408/429) is a permanent client error — don't retry forever.
    if (res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429) {
      throw new PermanentError(`HTTP ${res.status}: ${text || res.statusText}`);
    }
    throw new RetryableError(`HTTP ${res.status}: ${text || res.statusText}`);
  }

  if (method === 'DELETE') return null;
  return res.status === 204 ? null : res.json();
}

/** Remove client-only lifecycle fields before shipping a payload. */
function stripLocalFields<T extends BaseRecord>(row: T): Omit<T, 'isSynced' | 'syncStatus' | 'syncError' | 'lastModified'> {
  const { isSynced: _a, syncStatus: _b, syncError: _c, lastModified: _d, ...rest } = row;
  return rest;
}

class RetryableError extends Error {}
class PermanentError extends Error {}

// ─── Drain loop ─────────────────────────────────────────────────────────────

let inFlight: Promise<void> | null = null;

export function kickSync(): Promise<void> {
  if (inFlight) return inFlight;
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    state.online = false;
    emit();
    return Promise.resolve();
  }
  inFlight = drain().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function drain(): Promise<void> {
  state.running = true;
  state.online = typeof navigator === 'undefined' ? true : navigator.onLine;
  emit();

  try {
    const items = await dueItems();
    for (const item of items) {
      // Re-check online before each call — the user may have gone offline mid-loop.
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        state.online = false;
        break;
      }
      await processItem(item);
    }
  } finally {
    state.running = false;
    await refreshCounters();
    emit();
  }
}

async function processItem(item: OutboxItem): Promise<void> {
  const table = (db as unknown as Record<string, import('dexie').Table<BaseRecord, string>>)[item.entity];

  // Mark in-flight so a concurrent kickSync() won't re-pick this item.
  await db.outbox.update(item.id, { status: 'in_flight', updatedAt: Date.now() });
  await table.update(item.recordId, { syncStatus: 'pending' as SyncStatus, syncError: null }).catch(() => {});

  try {
    const server = await sendOne(item);

    await db.transaction('rw', table, db.outbox, async () => {
      if (item.op === 'delete') {
        // Row already deleted locally; nothing to update.
      } else if (server && typeof server === 'object') {
        const s = server as { id?: string | number };
        const newServerId = s.id != null ? String(s.id) : null;
        await table.update(item.recordId, {
          serverId: newServerId,
          isSynced: true,
          syncStatus: 'synced' as SyncStatus,
          syncError: null,
        });
      } else {
        await table.update(item.recordId, {
          isSynced: true,
          syncStatus: 'synced' as SyncStatus,
          syncError: null,
        });
      }
      // Idempotent terminal step: dropping the queue row is what makes the
      // operation "committed" from the queue's perspective.
      await db.outbox.delete(item.id);
    });

    state.lastSyncedAt = Date.now();
    state.lastError = null;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const permanent = err instanceof PermanentError;
    const attempts = item.attempts + 1;
    const giveUp = permanent || attempts >= MAX_ATTEMPTS;
    const now = Date.now();

    if (giveUp) {
      // Park: keep the row but schedule far in the future so the auto-loop
      // ignores it. UI surfaces a manual retry which calls `retryItem(id)`.
      await db.outbox.update(item.id, {
        status: 'parked',
        attempts,
        nextAttemptAt: Number.MAX_SAFE_INTEGER,
        updatedAt: now,
        lastError: message,
      });
    } else {
      const backoff = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** (attempts - 1));
      await db.outbox.update(item.id, {
        status: 'failed',
        attempts,
        nextAttemptAt: now + backoff,
        updatedAt: now,
        lastError: message,
      });
    }

    await table.update(item.recordId, {
      syncStatus: 'error' as SyncStatus,
      syncError: message,
    }).catch(() => {});

    state.lastError = message;
  }
}

// ─── Manual controls ────────────────────────────────────────────────────────

/** Re-queue a parked / errored item for immediate retry. */
export async function retryItem(outboxId: string): Promise<void> {
  await db.outbox.update(outboxId, {
    status: 'pending',
    attempts: 0,
    nextAttemptAt: Date.now(),
    updatedAt: Date.now(),
    lastError: null,
  });
  void kickSync();
}

/** Re-queue every parked/errored item. */
export async function retryAll(): Promise<void> {
  const errored = await db.outbox.where('status').anyOf('failed', 'parked').toArray();
  const now = Date.now();
  await db.transaction('rw', db.outbox, async () => {
    for (const i of errored) {
      await db.outbox.update(i.id, {
        status: 'pending',
        attempts: 0,
        nextAttemptAt: now,
        updatedAt: now,
        lastError: null,
      });
    }
  });
  void kickSync();
}

// ─── Reachability probe ─────────────────────────────────────────────────────
//
// `navigator.onLine` is a coarse signal. It returns `true` for captive-portal
// Wi-Fi, VPN-disconnected states, and DNS-blackholed connections. We treat
// it as a hint only and confirm with a HEAD against our own backend before
// flipping `state.online` to `true`. The probe is ~200 bytes and runs at
// most once every PROBE_MIN_INTERVAL_MS.

const PROBE_URL = '/api/health';
const PROBE_TIMEOUT_MS = 4_000;
const PROBE_MIN_INTERVAL_MS = 5_000;
let lastProbeAt = 0;
let lastProbeResult = true;

async function probeReachable(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return false;
  const now = Date.now();
  if (now - lastProbeAt < PROBE_MIN_INTERVAL_MS) return lastProbeResult;
  lastProbeAt = now;

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
  try {
    const res = await fetch(PROBE_URL, {
      method: 'HEAD',
      cache: 'no-store',
      signal: ctrl.signal,
      credentials: 'same-origin',
    });
    lastProbeResult = res.ok || res.status === 401 || res.status === 405;
    return lastProbeResult;
  } catch {
    lastProbeResult = false;
    return false;
  } finally {
    clearTimeout(t);
  }
}

// ─── Lifecycle ──────────────────────────────────────────────────────────────

let started = false;
let timer: ReturnType<typeof setInterval> | null = null;

export function startSyncEngine(): () => void {
  if (started || typeof window === 'undefined') return () => undefined;
  started = true;

  const onOnline = async () => {
    // Browser thinks we're back online — verify before promising the user
    // anything. If the probe fails, leave state.online=false; the next
    // tick will retry.
    const reachable = await probeReachable();
    state.online = reachable;
    emit();
    if (reachable) void kickSync();
  };
  const onOffline = () => {
    state.online = false;
    lastProbeResult = false;
    emit();
  };
  const onVisibility = () => {
    if (!document.hidden) {
      // Tab became visible — re-probe and drain. Common case: laptop wakes
      // from sleep with stale `navigator.onLine === true`.
      void probeReachable().then((reachable) => {
        if (state.online !== reachable) {
          state.online = reachable;
          emit();
        }
        if (reachable) void kickSync();
      });
    }
  };

  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);
  document.addEventListener('visibilitychange', onVisibility);
  timer = setInterval(async () => {
    // Periodic probe + drain. Probe is throttled internally (5s minimum
    // gap) so this is cheap even if other code paths probe in parallel.
    const reachable = await probeReachable();
    if (state.online !== reachable) {
      state.online = reachable;
      emit();
    }
    if (reachable) void kickSync();
  }, TICK_MS);

  // Initial drain on boot.
  void refreshCounters().then(() => kickSync());

  return () => {
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
    document.removeEventListener('visibilitychange', onVisibility);
    if (timer) clearInterval(timer);
    started = false;
  };
}
