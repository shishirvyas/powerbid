'use client';

/**
 * Bottom status bar. Always visible. Conveys system state at a glance:
 *   ● Online / ○ Offline
 *   Pending sync count + last synced timestamp
 *   Last error (if any)
 *   Version
 *
 * Designed to be unobtrusive (24px, 11px font). Hovering the sync segment
 * shows the full timestamp in a native title tooltip.
 */

import * as React from 'react';
import { useSyncStatus } from '@/lib/offline';

function relativeTime(ts: number | null): string {
  if (!ts) return 'never';
  const diff = Date.now() - ts;
  if (diff < 5_000) return 'just now';
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(ts).toLocaleDateString();
}

export function StatusBar() {
  const sync = useSyncStatus();

  // Re-render once a minute so "just now" -> "1m ago" without a manual refresh.
  const [, force] = React.useReducer((x: number) => x + 1, 0);
  React.useEffect(() => {
    const t = setInterval(force, 30_000);
    return () => clearInterval(t);
  }, []);

  const dotClass = !sync.online
    ? 'wb-statusbar__dot--off'
    : sync.errors > 0
      ? 'wb-statusbar__dot--error'
      : sync.pending > 0
        ? 'wb-statusbar__dot--warn'
        : 'wb-statusbar__dot--ok';

  const stateLabel = !sync.online
    ? 'Offline'
    : sync.running
      ? 'Syncing…'
      : sync.errors > 0
        ? `${sync.errors} error${sync.errors === 1 ? '' : 's'}`
        : sync.pending > 0
          ? `${sync.pending} pending`
          : 'All synced';

  return (
    <footer className="wb-statusbar" role="status" aria-live="polite">
      <span className="inline-flex items-center gap-1.5">
        <span className={`wb-statusbar__dot ${dotClass}`} aria-hidden="true" />
        <span>{stateLabel}</span>
      </span>

      <span className="wb-statusbar__sep" aria-hidden="true" />

      <span
        title={
          sync.lastSyncedAt ? new Date(sync.lastSyncedAt).toLocaleString() : 'Not synced yet'
        }
      >
        Last sync: {relativeTime(sync.lastSyncedAt)}
      </span>

      {sync.lastError && (
        <>
          <span className="wb-statusbar__sep" aria-hidden="true" />
          <span className="truncate text-[hsl(0_65%_50%)]" title={sync.lastError}>
            {sync.lastError}
          </span>
        </>
      )}

      <span className="wb-statusbar__spacer flex-1" />

      <span className="opacity-70">PowerBid v0.1</span>
    </footer>
  );
}
