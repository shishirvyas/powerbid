'use client';

/**
 * Small, unobtrusive toast that appears for a few seconds when the
 * online/offline state flips. The persistent state is already shown in
 * the status bar; this component only fires on transitions.
 *
 * Behavior:
 *   - First mount: silent. We don't yell "you're online!" at startup.
 *   - online → offline: shows "Working offline" until it flips back.
 *                       Stays visible because the user needs to know.
 *   - offline → online: shows "Back online · Syncing N changes" for 4s,
 *                       then "All synced" for 2s, then disappears.
 *
 * Position: bottom-right, above the status bar. Uses CSS transitions
 * (opacity + translate) — no animation library.
 */

import * as React from 'react';
import { CheckCircle2, CloudOff, RefreshCw } from 'lucide-react';
import { useSyncStatus } from '@/lib/offline';

type ToastState =
  | { kind: 'hidden' }
  | { kind: 'offline' }
  | { kind: 'reconnecting'; pending: number }
  | { kind: 'synced' };

export function OfflineToast() {
  const sync = useSyncStatus();
  const [toast, setToast] = React.useState<ToastState>({ kind: 'hidden' });
  const prevOnline = React.useRef<boolean | null>(null);
  const prevPending = React.useRef<number>(0);
  const hideTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    const wasOnline = prevOnline.current;
    const isOnline = sync.online;

    // First render: just record state, don't toast.
    if (wasOnline === null) {
      prevOnline.current = isOnline;
      prevPending.current = sync.pending;
      // If we boot up offline, surface that immediately.
      if (!isOnline) setToast({ kind: 'offline' });
      return;
    }

    // online → offline
    if (wasOnline && !isOnline) {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      setToast({ kind: 'offline' });
    }

    // offline → online
    if (!wasOnline && isOnline) {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      const pending = sync.pending;
      if (pending > 0) {
        setToast({ kind: 'reconnecting', pending });
      } else {
        setToast({ kind: 'synced' });
        hideTimer.current = setTimeout(() => setToast({ kind: 'hidden' }), 2000);
      }
    }

    prevOnline.current = isOnline;
  }, [sync.online, sync.pending]);

  // While reconnecting, watch pending count → 0 to flip to "synced".
  React.useEffect(() => {
    if (toast.kind !== 'reconnecting') return;
    if (sync.pending === 0) {
      setToast({ kind: 'synced' });
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => setToast({ kind: 'hidden' }), 2000);
    } else if (sync.pending !== toast.pending) {
      setToast({ kind: 'reconnecting', pending: sync.pending });
    }
  }, [sync.pending, toast]);

  React.useEffect(() => {
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  const visible = toast.kind !== 'hidden';
  return (
    <div
      role="status"
      aria-live="polite"
      className={[
        'pointer-events-none fixed right-3 bottom-8 z-50',
        'transition-all duration-200 ease-out',
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1',
      ].join(' ')}
    >
      {visible && <ToastBody state={toast} />}
    </div>
  );
}

function ToastBody({ state }: { state: ToastState }) {
  if (state.kind === 'offline') {
    return (
      <div className="flex items-center gap-2 rounded border border-border bg-background/95 backdrop-blur px-2.5 py-1.5 shadow-sm text-[12px]">
        <CloudOff className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
        <span>Working offline · changes will sync when you reconnect</span>
      </div>
    );
  }
  if (state.kind === 'reconnecting') {
    return (
      <div className="flex items-center gap-2 rounded border border-border bg-background/95 backdrop-blur px-2.5 py-1.5 shadow-sm text-[12px]">
        <RefreshCw className="h-3.5 w-3.5 animate-spin text-muted-foreground" aria-hidden="true" />
        <span>
          Back online · syncing {state.pending} change{state.pending === 1 ? '' : 's'}
        </span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 rounded border border-border bg-background/95 backdrop-blur px-2.5 py-1.5 shadow-sm text-[12px]">
      <CheckCircle2 className="h-3.5 w-3.5 text-[hsl(142_60%_38%)]" aria-hidden="true" />
      <span>All changes synced</span>
    </div>
  );
}
