"use client";

import * as React from "react";
import { api, ApiClientError } from "@/lib/api-client";

export type ListEnvelope<T> = { rows: T[]; total: number; limit: number; offset: number };

export function useList<T>(path: string, query: Record<string, string | number> = {}) {
  const qs = new URLSearchParams(
    Object.entries(query).reduce<Record<string, string>>((a, [k, v]) => {
      if (v !== "" && v !== undefined && v !== null) a[k] = String(v);
      return a;
    }, {}),
  ).toString();
  const url = qs ? `${path}?${qs}` : path;

  const [data, setData] = React.useState<ListEnvelope<T> | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [tick, setTick] = React.useState(0);

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    api<ListEnvelope<T>>(url)
      .then((r) => {
        if (alive) {
          setData(r);
          setError(null);
        }
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof ApiClientError ? e.message : "Failed to load");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [url, tick]);

  return { data, loading, error, refresh: () => setTick((t) => t + 1) };
}

export function useResource<T>(path: string | null) {
  const [data, setData] = React.useState<T | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [tick, setTick] = React.useState(0);

  React.useEffect(() => {
    if (!path) {
      setData(null);
      return;
    }
    let alive = true;
    setLoading(true);
    api<T>(path)
      .then((r) => {
        if (alive) {
          setData(r);
          setError(null);
        }
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof ApiClientError ? e.message : "Failed to load");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [path, tick]);

  return { data, loading, error, refresh: () => setTick((t) => t + 1) };
}

export function useDebounced<T>(value: T, delay = 300): T {
  const [v, setV] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}
