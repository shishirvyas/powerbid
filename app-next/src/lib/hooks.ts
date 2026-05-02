"use client";

import * as React from "react";
import { api, ApiClientError } from "@/lib/api-client";

export type ListEnvelope<T> = { rows: T[]; total: number; limit: number; offset: number };

// ---------------------------------------------------------------------------
// Module-level SWR cache — survives across component mounts/unmounts
// ---------------------------------------------------------------------------
const CACHE_TTL_MS = 30_000; // 30 s stale window
type CacheEntry<T> = { data: T; ts: number };
const _cache = new Map<string, CacheEntry<unknown>>();
const _inflight = new Map<string, Promise<unknown>>();

function getCached<T>(key: string): T | null {
  const e = _cache.get(key) as CacheEntry<T> | undefined;
  if (!e) return null;
  if (Date.now() - e.ts > CACHE_TTL_MS) return null; // expired
  return e.data;
}

function setCached<T>(key: string, data: T) {
  _cache.set(key, { data, ts: Date.now() });
}

function fetchDeduped<T>(url: string): Promise<T> {
  const existing = _inflight.get(url) as Promise<T> | undefined;
  if (existing) return existing;
  const p = api<T>(url).finally(() => _inflight.delete(url));
  _inflight.set(url, p as Promise<unknown>);
  return p;
}

export function useList<T>(path: string, query: Record<string, string | number> = {}) {
  const qs = new URLSearchParams(
    Object.entries(query).reduce<Record<string, string>>((a, [k, v]) => {
      if (v !== "" && v !== undefined && v !== null) a[k] = String(v);
      return a;
    }, {}),
  ).toString();
  const url = qs ? `${path}?${qs}` : path;

  // Seed from cache — instant first render if data exists
  const cached = getCached<ListEnvelope<T>>(url);
  const [data, setData] = React.useState<ListEnvelope<T> | null>(cached);
  const [error, setError] = React.useState<string | null>(null);
  // Start loading=false if we have cached data (show stale immediately)
  const [loading, setLoading] = React.useState(!cached);
  const [tick, setTick] = React.useState(0);

  React.useEffect(() => {
    let alive = true;
    const fresh = getCached<ListEnvelope<T>>(url);
    if (fresh) {
      setData(fresh);
      setLoading(false);
    } else {
      setLoading(true);
    }
    fetchDeduped<ListEnvelope<T>>(url)
      .then((r) => {
        if (alive) {
          setCached(url, r);
          setData(r);
          setError(null);
          setLoading(false);
        }
      })
      .catch((e: unknown) => {
        if (alive) {
          setError(e instanceof ApiClientError ? e.message : "Failed to load");
          setLoading(false);
        }
      });
    return () => {
      alive = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, tick]);

  const refresh = React.useCallback(() => {
    _cache.delete(url);
    setTick((t) => t + 1);
  }, [url]);

  const mutate = React.useCallback(
    (updater: (prev: ListEnvelope<T> | null) => ListEnvelope<T> | null) => {
      setData((prev) => {
        const next = updater(prev);
        if (next) setCached(url, next);
        return next;
      });
    },
    [url],
  );

  return { data, loading, error, refresh, mutate, setData };
}

export function useResource<T>(path: string | null) {
  const cached = path ? getCached<T>(path) : null;
  const [data, setData] = React.useState<T | null>(cached);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(!cached && !!path);
  const [tick, setTick] = React.useState(0);

  React.useEffect(() => {
    if (!path) {
      setData(null);
      setLoading(false);
      return;
    }
    let alive = true;
    const fresh = getCached<T>(path);
    if (fresh) {
      setData(fresh);
      setLoading(false);
    } else {
      setLoading(true);
    }
    fetchDeduped<T>(path)
      .then((r) => {
        if (alive) {
          setCached(path, r);
          setData(r);
          setError(null);
          setLoading(false);
        }
      })
      .catch((e: unknown) => {
        if (alive) {
          setError(e instanceof ApiClientError ? e.message : "Failed to load");
          setLoading(false);
        }
      });
    return () => {
      alive = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, tick]);

  return {
    data,
    loading,
    error,
    refresh: React.useCallback(() => {
      if (path) _cache.delete(path);
      setTick((t) => t + 1);
    }, [path]),
  };
}

/**
 * Invalidate all cached entries whose URL starts with the given prefix.
 * Call after successful mutations: e.g. invalidateCache('/api/boms')
 */
export function invalidateCache(prefix: string) {
  for (const key of Array.from(_cache.keys())) {
    if (key.startsWith(prefix)) _cache.delete(key);
  }
}

export function useDebounced<T>(value: T, delay = 300): T {
  const [v, setV] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}
