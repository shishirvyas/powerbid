'use client';

/**
 * React hook + provider for the sync engine. Mount <SyncProvider/> once
 * inside the app shell. Components can call useSyncStatus() to render
 * indicators, or import kickSync()/retryAll() from sync-engine directly.
 */

import { useEffect, useSyncExternalStore } from 'react';
import {
  getSyncSnapshot,
  startSyncEngine,
  subscribeSync,
  type SyncSnapshot,
} from './sync-engine';

export function useSyncStatus(): SyncSnapshot {
  return useSyncExternalStore(
    (cb) => subscribeSync(cb),
    () => getSyncSnapshot(),
    () => getSyncSnapshot(),
  );
}

export function SyncProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => startSyncEngine(), []);
  return <>{children}</>;
}
