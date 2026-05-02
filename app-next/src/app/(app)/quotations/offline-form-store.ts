'use client';

/**
 * Form-local Zustand store for the offline Quotation Entry form.
 *
 * Why a store (not useState):
 *   - Selectors let inputs subscribe to a single field, so editing one row
 *     does not re-render every other row in a 50-line item table.
 *   - Actions are stable references (no useCallback gymnastics).
 *   - Form state is decoupled from React tree lifecycle, so mounting an
 *     existing draft is a one-line `loadDraft()` call.
 *
 * This store is purely UI state. Persistence goes through the offline repo
 * (which writes to IndexedDB and the outbox). No fetch, no API calls here.
 */

import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import type { QuotationRecord } from '@/lib/offline';

export interface QuotationItemDraft {
  productId: string;
  description: string;
  qty: number;
  rate: number;
}

export interface QuotationDraft {
  id: string | null;          // local id; null until first save
  serverId: string | null;
  number: string;
  customerId: string;
  customerName: string;       // free-text fallback for fast entry
  notes: string;
  items: QuotationItemDraft[];
}

interface QuotationFormState extends QuotationDraft {
  dirty: boolean;
  setField: <K extends keyof QuotationDraft>(k: K, v: QuotationDraft[K]) => void;
  setItem: (idx: number, patch: Partial<QuotationItemDraft>) => void;
  addItem: () => void;
  removeItem: (idx: number) => void;
  reset: () => void;
  loadFrom: (record: QuotationRecord) => void;
  /** Build a clean payload for the repo. */
  toPayload: () => Partial<QuotationRecord>;
  total: () => number;
}

const EMPTY_ITEM: QuotationItemDraft = { productId: '', description: '', qty: 1, rate: 0 };

const INITIAL: QuotationDraft = {
  id: null,
  serverId: null,
  number: '',
  customerId: '',
  customerName: '',
  notes: '',
  items: [{ ...EMPTY_ITEM }],
};

export const useQuotationForm = create<QuotationFormState>((set, get) => ({
  ...INITIAL,
  dirty: false,

  setField: (k, v) =>
    set((s) => (s[k] === v ? s : { ...s, [k]: v, dirty: true })),

  setItem: (idx, patch) =>
    set((s) => {
      const cur = s.items[idx];
      if (!cur) return s;
      // Bail if nothing actually changed — prevents unrelated re-renders.
      const merged = { ...cur, ...patch };
      let changed = false;
      for (const k in merged) {
        if ((merged as any)[k] !== (cur as any)[k]) { changed = true; break; }
      }
      if (!changed) return s;
      const items = s.items.slice();
      items[idx] = merged;
      return { ...s, items, dirty: true };
    }),

  addItem: () =>
    set((s) => ({ ...s, items: [...s.items, { ...EMPTY_ITEM }], dirty: true })),

  removeItem: (idx) =>
    set((s) => {
      if (s.items.length <= 1) return s;
      const items = s.items.slice();
      items.splice(idx, 1);
      return { ...s, items, dirty: true };
    }),

  reset: () => set({ ...INITIAL, items: [{ ...EMPTY_ITEM }], dirty: false }),

  loadFrom: (r) =>
    set({
      id: r.id,
      serverId: r.serverId,
      number: r.number ?? '',
      customerId: r.customerId ?? '',
      customerName: '',
      notes: '',
      items: (r.items ?? []).map((i) => ({
        productId: i.productId,
        description: '',
        qty: i.qty,
        rate: i.rate,
      })) || [{ ...EMPTY_ITEM }],
      dirty: false,
    }),

  toPayload: () => {
    const s = get();
    return {
      number: s.number.trim() || undefined,
      customerId: s.customerId || null,
      inquiryId: null,
      total: s.items.reduce((a, i) => a + i.qty * i.rate, 0),
      items: s.items
        .filter((i) => i.productId || i.description)
        .map((i) => ({ productId: i.productId, qty: i.qty, rate: i.rate })),
    };
  },

  total: () => get().items.reduce((a, i) => a + i.qty * i.rate, 0),
}));

/** Selector helper that uses shallow equality — re-export for convenience. */
export { useShallow };
