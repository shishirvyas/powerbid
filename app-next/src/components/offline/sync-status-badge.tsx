'use client';

/**
 * Sync status system.
 *
 * Three exports:
 *   - <SyncStatusBadge>   minimal pill, used in tables and inline.
 *   - <SyncStatusInline>  badge + retry button + error tooltip, for forms.
 *   - <SyncRetryButton>   standalone retry control.
 *
 * Color comes from CSS variables in globals.css (`--sync-{state}-{fg,bg,dot}`)
 * via the `.sync-badge` / `.sync-retry-btn` component classes, so dark mode
 * is automatic and themes can override without JS.
 *
 * Accessibility:
 *   - Each badge has aria-label + native title tooltip with the full message.
 *   - Retry is a real <button type="button"> with aria-label.
 *   - Pulse animation respects `prefers-reduced-motion`.
 *
 * No `fetch` here — retry calls the offline `retryItem` action which re-queues
 * the outbox row; the sync engine performs the actual transmission.
 */

import * as React from 'react';
import { RotateCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SyncStatus, EntityName } from '@/lib/offline';
import { db, retryItem, useSyncStatus } from '@/lib/offline';

const LABELS: Record<SyncStatus, string> = {
  draft: 'Draft',
  pending: 'Syncing',
  synced: 'Synced',
  error: 'Error',
};

// ─── Core badge ─────────────────────────────────────────────────────────────

export interface SyncStatusBadgeProps {
  status: SyncStatus;
  /** Error message — surfaced via the title tooltip when status === 'error'. */
  error?: string | null;
  /** `lg` reads better in form headers; default works for table rows. */
  size?: 'sm' | 'lg';
  /** Hide the textual label; show only the dot + tooltip (ultra-dense tables). */
  iconOnly?: boolean;
  className?: string;
}

export const SyncStatusBadge = React.memo(function SyncStatusBadge({
  status,
  error,
  size = 'sm',
  iconOnly = false,
  className,
}: SyncStatusBadgeProps) {
  const { online } = useSyncStatus();
  // When offline, "pending" rows can't progress — show them as Draft so the
  // user isn't misled into thinking sync is hanging.
  const effective: SyncStatus = !online && status === 'pending' ? 'draft' : status;

  const label = LABELS[effective];
  const tooltip =
    effective === 'error' && error
      ? `Sync error: ${error}`
      : effective === 'draft' && !online
        ? 'Offline — will sync when online'
        : effective === 'draft'
          ? 'Saved locally only'
          : effective === 'pending'
            ? 'Sync in progress…'
            : 'Synced with server';

  return (
    <span
      role="status"
      aria-label={tooltip}
      title={tooltip}
      className={cn(
        'sync-badge',
        `sync-badge--${effective}`,
        size === 'lg' && 'sync-badge--lg',
        className,
      )}
    >
      <span className="sync-badge__dot" aria-hidden />
      {!iconOnly && <span>{label}</span>}
    </span>
  );
});

// ─── Retry button ───────────────────────────────────────────────────────────

export interface SyncRetryButtonProps {
  outboxId: string;
  className?: string;
  /** `compact` renders icon-only; `text` (default) shows "Retry". */
  variant?: 'compact' | 'text';
  onRetry?: () => void;
}

export function SyncRetryButton({
  outboxId,
  className,
  variant = 'text',
  onRetry,
}: SyncRetryButtonProps) {
  const [busy, setBusy] = React.useState(false);
  const handle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setBusy(true);
    try {
      await retryItem(outboxId);
      onRetry?.();
    } finally {
      setBusy(false);
    }
  };
  return (
    <button
      type="button"
      onClick={handle}
      disabled={busy}
      aria-label="Retry sync"
      title="Retry sync"
      className={cn('sync-retry-btn', className)}
    >
      <RotateCw size={11} className={busy ? 'animate-spin' : undefined} aria-hidden />
      {variant === 'text' && <span>{busy ? 'Retrying' : 'Retry'}</span>}
    </button>
  );
}

// ─── Form-view inline status (badge + retry + tooltip) ─────────────────────

export interface SyncStatusInlineProps {
  /** Entity name + local record id used to look up the outbox row for retry. */
  entity?: EntityName;
  recordId?: string;
  status: SyncStatus;
  error?: string | null;
  className?: string;
}

export function SyncStatusInline({
  entity,
  recordId,
  status,
  error,
  className,
}: SyncStatusInlineProps) {
  const [outboxId, setOutboxId] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    if (status !== 'error' || !entity || !recordId) {
      setOutboxId(null);
      return;
    }
    db.outbox
      .where('[entity+recordId]')
      .equals([entity, recordId])
      .first()
      .then((row) => {
        if (alive) setOutboxId(row?.id ?? null);
      })
      .catch(() => {
        if (alive) setOutboxId(null);
      });
    return () => {
      alive = false;
    };
  }, [entity, recordId, status]);

  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      <SyncStatusBadge status={status} error={error} size="lg" />
      {status === 'error' && outboxId && <SyncRetryButton outboxId={outboxId} />}
    </span>
  );
}

