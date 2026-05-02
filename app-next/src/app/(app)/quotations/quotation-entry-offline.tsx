'use client';

/**
 * Offline-first Quotation Entry form.
 *
 * Behavior contract:
 *   - Submit writes ONLY to IndexedDB via `quotationsRepo` and returns instantly.
 *   - The sync engine (started in the app shell) drains the outbox in the
 *     background. This component never calls `fetch`.
 *   - The status badge reflects the row's `syncStatus` from Dexie via
 *     `useLiveQuery`, so it updates the moment the engine flips it.
 *
 * Re-render strategy:
 *   - Each input subscribes via a narrow Zustand selector → typing in one
 *     line item does NOT re-render the others.
 *   - The header total uses `getState()` inside an event-driven recompute
 *     to avoid subscribing to the whole `items` array in the parent.
 *
 * Keyboard:
 *   - Enter: move to the next field (Shift+Enter: previous).
 *   - Ctrl+S / Cmd+S: save. No mouse needed.
 *   - Esc: reset form.
 */

import * as React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useShallow } from 'zustand/react/shallow';
import { quotationsRepo, kickSync, db } from '@/lib/offline';
import type { QuotationRecord, SyncStatus } from '@/lib/offline';
import { SyncStatusInline } from '@/components/offline/sync-status-badge';
import { useFormKeys, focusFirstField } from '@/lib/hooks/use-keyboard';
import { useQuotationForm } from './offline-form-store';

const fmt = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });

// ─── Memoized line row ──────────────────────────────────────────────────────

const LineRow = React.memo(function LineRow({ idx }: { idx: number }) {
  // One subscription per field → only this row's row re-renders.
  const item = useQuotationForm((s) => s.items[idx]);
  const setItem = useQuotationForm((s) => s.setItem);
  const removeItem = useQuotationForm((s) => s.removeItem);
  if (!item) return null;

  // Focus traversal is handled at the form root by useFormKeys; rows just render.
  const lineTotal = item.qty * item.rate;

  return (
    <tr className="border-b border-border/50 hover:bg-muted/30">
      <td className="px-1 py-0.5 text-xs text-muted-foreground tabular-nums w-8">{idx + 1}</td>
      <td className="px-1 py-0.5">
        <input
          data-field="true"
          value={item.productId}
          onChange={(e) => setItem(idx, { productId: e.target.value })}
          className="w-full h-7 px-1.5 bg-transparent border-0 outline-none focus:bg-background focus:ring-1 focus:ring-ring rounded text-sm"
          placeholder="SKU"
        />
      </td>
      <td className="px-1 py-0.5">
        <input
          data-field="true"
          value={item.description}
          onChange={(e) => setItem(idx, { description: e.target.value })}
          className="w-full h-7 px-1.5 bg-transparent border-0 outline-none focus:bg-background focus:ring-1 focus:ring-ring rounded text-sm"
          placeholder="Description"
        />
      </td>
      <td className="px-1 py-0.5 w-20">
        <input
          data-field="true"
          type="number"
          inputMode="decimal"
          step="any"
          value={item.qty}
          onChange={(e) => setItem(idx, { qty: Number(e.target.value) || 0 })}
          className="w-full h-7 px-1.5 bg-transparent border-0 outline-none focus:bg-background focus:ring-1 focus:ring-ring rounded text-sm text-right tabular-nums"
        />
      </td>
      <td className="px-1 py-0.5 w-24">
        <input
          data-field="true"
          type="number"
          inputMode="decimal"
          step="any"
          value={item.rate}
          onChange={(e) => setItem(idx, { rate: Number(e.target.value) || 0 })}
          className="w-full h-7 px-1.5 bg-transparent border-0 outline-none focus:bg-background focus:ring-1 focus:ring-ring rounded text-sm text-right tabular-nums"
        />
      </td>
      <td className="px-1 py-0.5 w-28 text-right text-sm tabular-nums">{fmt.format(lineTotal)}</td>
      <td className="px-1 py-0.5 w-6 text-center">
        <button
          type="button"
          tabIndex={-1}
          onClick={() => removeItem(idx)}
          className="text-muted-foreground hover:text-red-600 text-xs"
          aria-label="Remove line"
        >
          ×
        </button>
      </td>
    </tr>
  );
});

// ─── Footer total — subscribes only to the items length + values ───────────

function FooterTotal() {
  // Selector returns a primitive → component re-renders only when total changes.
  const total = useQuotationForm((s) =>
    s.items.reduce((a, i) => a + i.qty * i.rate, 0),
  );
  return <span className="tabular-nums">{fmt.format(total)}</span>;
}

// ─── Main form ──────────────────────────────────────────────────────────────

export function QuotationEntryForm({ recordId }: { recordId?: string }) {
  // Live binding to the persisted row (source of truth for status badge).
  const live = useLiveQuery<QuotationRecord | undefined>(
    () => (recordId ? db.quotations.get(recordId) : undefined),
    [recordId],
  );

  const [savedAt, setSavedAt] = React.useState<number | null>(null);
  const [activeId, setActiveId] = React.useState<string | null>(recordId ?? null);
  const formRef = React.useRef<HTMLFormElement>(null);

  // Hydrate the form when an existing record loads.
  React.useEffect(() => {
    if (live) useQuotationForm.getState().loadFrom(live);
    else if (!recordId) useQuotationForm.getState().reset();
  }, [live, recordId]);

  // Header fields — narrow selectors, shallow equality.
  const { number, customerName, notes } = useQuotationForm(
    useShallow((s) => ({
      number: s.number,
      customerName: s.customerName,
      notes: s.notes,
    })),
  );
  const setField = useQuotationForm((s) => s.setField);
  const addItem = useQuotationForm((s) => s.addItem);
  const itemCount = useQuotationForm((s) => s.items.length);

  // Status: read live row → no flicker, in sync with sync-engine writes.
  const status: SyncStatus = live?.syncStatus ?? 'draft';
  const syncError = live?.syncError ?? null;

  // ── Save: local-only. No await on network, no spinner. ────────────────────
  const save = React.useCallback(async () => {
    const state = useQuotationForm.getState();
    const payload = state.toPayload();

    if (activeId) {
      await quotationsRepo.update(activeId, payload);
    } else {
      const created = await quotationsRepo.create(payload);
      setActiveId(created.id);
      // Persist id into the form so subsequent edits are updates.
      useQuotationForm.setState({ id: created.id, dirty: false });
    }
    useQuotationForm.setState({ dirty: false });
    setSavedAt(Date.now());
    // Fire-and-forget: don't await. Sync engine handles the rest.
    void kickSync();
  }, [activeId]);

  // ── Keyboard: Enter/Shift+Enter advance, Ctrl+S save, Esc reset ─────────
  useFormKeys(formRef, {
    onSave: () => void save(),
    onCancel: () => {
      useQuotationForm.getState().reset();
      setActiveId(null);
      focusFirstField(formRef.current);
    },
  });

  return (
    <form
      ref={formRef}
      data-form-root
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
      className="flex flex-col h-full text-sm"
    >
      {/* ── Header bar ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-3 py-2 border-b border-border bg-muted/20">
        <h2 className="text-sm font-semibold tracking-tight">Quotation Entry</h2>
        <SyncStatusInline
          entity="quotations"
          recordId={activeId ?? undefined}
          status={status}
          error={syncError}
        />
        {savedAt && (
          <span className="text-[11px] text-muted-foreground">
            Saved {new Date(savedAt).toLocaleTimeString()}
          </span>
        )}
        <div className="ml-auto text-[11px] text-muted-foreground">
          <kbd className="px-1 py-0.5 rounded bg-background border">Ctrl</kbd>+
          <kbd className="px-1 py-0.5 rounded bg-background border">S</kbd> save
          <span className="mx-2">·</span>
          <kbd className="px-1 py-0.5 rounded bg-background border">Enter</kbd> next
          <span className="mx-2">·</span>
          <kbd className="px-1 py-0.5 rounded bg-background border">Esc</kbd> reset
        </div>
      </div>

      {/* ── Header fields (dense grid, no card padding) ─────────────── */}
      <div className="grid grid-cols-12 gap-2 px-3 py-2 border-b border-border">
        <label className="col-span-2 flex flex-col gap-0.5">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">No.</span>
          <input
            data-field="true"
            value={number}
            onChange={(e) => setField('number', e.target.value)}
            className="h-7 px-2 rounded border border-input bg-background outline-none focus:ring-1 focus:ring-ring"
            placeholder="Auto"
          />
        </label>
        <label className="col-span-5 flex flex-col gap-0.5">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Customer</span>
          <input
            data-field="true"
            value={customerName}
            onChange={(e) => setField('customerName', e.target.value)}
            className="h-7 px-2 rounded border border-input bg-background outline-none focus:ring-1 focus:ring-ring"
            placeholder="Customer name"
            autoFocus
          />
        </label>
        <label className="col-span-5 flex flex-col gap-0.5">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Notes</span>
          <input
            data-field="true"
            value={notes}
            onChange={(e) => setField('notes', e.target.value)}
            className="h-7 px-2 rounded border border-input bg-background outline-none focus:ring-1 focus:ring-ring"
          />
        </label>
      </div>

      {/* ── Items table ─────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 bg-muted/40 text-[10px] uppercase tracking-wide text-muted-foreground">
            <tr className="border-b border-border">
              <th className="px-1 py-1 text-left w-8">#</th>
              <th className="px-1 py-1 text-left w-32">SKU</th>
              <th className="px-1 py-1 text-left">Description</th>
              <th className="px-1 py-1 text-right w-20">Qty</th>
              <th className="px-1 py-1 text-right w-24">Rate</th>
              <th className="px-1 py-1 text-right w-28">Amount</th>
              <th className="w-6" />
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: itemCount }).map((_, i) => (
              <LineRow key={i} idx={i} />
            ))}
          </tbody>
        </table>
        <button
          type="button"
          onClick={addItem}
          className="mx-3 my-1 text-xs text-muted-foreground hover:text-foreground"
        >
          + Add line (Enter past last row also works)
        </button>
      </div>

      {/* ── Footer / status bar ─────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 py-1.5 border-t border-border bg-muted/20 text-xs">
        <div className="text-muted-foreground">
          {itemCount} line{itemCount === 1 ? '' : 's'}
        </div>
        <div className="flex items-center gap-4">
          <span className="text-muted-foreground">Total:</span>
          <span className="font-semibold text-base">
            <FooterTotal />
          </span>
          <button
            type="submit"
            className="h-7 px-3 rounded bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90"
          >
            Save (Ctrl+S)
          </button>
        </div>
      </div>
    </form>
  );
}
