import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { quotationsApi } from "../../lib/quotations";
import { api } from "../../lib/api";
import type { QuotationDraftInput, QuotationItemInput } from "@powerbid/shared";

interface CustomerLite { id: number; name: string; gstin: string | null }
interface ProductLite {
  id: number;
  name: string;
  sku: string;
  basePrice: number;
  gstRate: number; // joined from gst slab
  unitName: string | null;
}

const blankItem = (): QuotationItemInput => ({
  productId: null,
  productName: "",
  description: null,
  unitName: null,
  qty: 1,
  unitPrice: 0,
  discountPercent: 0,
  gstRate: 18,
  sortOrder: 0,
});

export function QuotationFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id && id !== "new");
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [customerId, setCustomerId] = useState<number | "">("");
  const [validityDays, setValidityDays] = useState(15);
  const [discountType, setDiscountType] = useState<"percent" | "amount">("percent");
  const [discountValue, setDiscountValue] = useState(0);
  const [freightAmount, setFreightAmount] = useState(0);
  const [terms, setTerms] = useState("");
  const [notes, setNotes] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [deliverySchedule, setDeliverySchedule] = useState("");
  const [contactPersonId, setContactPersonId] = useState<number | "">("");
  const [items, setItems] = useState<QuotationItemInput[]>([blankItem()]);

  const customersQuery = useQuery({
    queryKey: ["customers"],
    queryFn: () => api<{ items: CustomerLite[] }>("/api/masters/customers"),
  });
  const productsQuery = useQuery({
    queryKey: ["products"],
    queryFn: () => api<{ items: ProductLite[] }>("/api/masters/products"),
  });

  // Hydrate when editing.
  const editQuery = useQuery({
    queryKey: ["quotation", id],
    queryFn: () => quotationsApi.get(Number(id)),
    enabled: isEdit,
  });
  useEffect(() => {
    if (!editQuery.data) return;
    const { quotation, items } = editQuery.data;
    setCustomerId(quotation.customerId);
    setValidityDays(quotation.validityDays);
    setDiscountType(quotation.discountType);
    setDiscountValue(quotation.discountValue);
    setFreightAmount(quotation.freightAmount);
    setTerms(quotation.termsConditions ?? "");
    setNotes(quotation.notes ?? "");
    setPaymentTerms(quotation.paymentTerms ?? "");
    setDeliverySchedule(quotation.deliverySchedule ?? "");
    setContactPersonId(quotation.contactPersonId ?? "");
    setItems(
      items.map((it) => ({
        productId: it.productId,
        productName: it.productName,
        description: it.description,
        unitName: it.unitName,
        qty: it.qty,
        unitPrice: it.unitPrice,
        discountPercent: it.discountPercent,
        gstRate: it.gstRate,
        sortOrder: it.sortOrder,
      })),
    );
  }, [editQuery.data]);

  // ---- live totals (mirror of server formula) ----
  const totals = useMemo(() => {
    const round2 = (n: number) => Math.round(n * 100) / 100;
    const computed = items.map((it) => {
      const sub = round2((Number(it.qty) || 0) * (Number(it.unitPrice) || 0) * (1 - (Number(it.discountPercent) || 0) / 100));
      const gst = round2((sub * (Number(it.gstRate) || 0)) / 100);
      return { sub, gst };
    });
    const subtotal = round2(computed.reduce((s, c) => s + c.sub, 0));
    const rawDisc =
      discountType === "percent"
        ? (subtotal * Math.max(0, Math.min(100, discountValue))) / 100
        : Math.max(0, discountValue);
    const discountAmount = round2(Math.min(rawDisc, subtotal));
    const taxableAmount = round2(subtotal - discountAmount);
    const ratio = subtotal > 0 ? taxableAmount / subtotal : 0;
    const gstAmount = round2(computed.reduce((s, c) => s + c.gst, 0) * ratio);
    const grandTotal = round2(taxableAmount + gstAmount + Math.max(0, freightAmount || 0));
    return { subtotal, discountAmount, taxableAmount, gstAmount, freightAmount, grandTotal };
  }, [items, discountType, discountValue, freightAmount]);

  const updateItem = (i: number, patch: Partial<QuotationItemInput>) => {
    setItems((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  };
  const removeItem = (i: number) =>
    setItems((rows) => (rows.length > 1 ? rows.filter((_, idx) => idx !== i) : rows));
  const addRow = () => setItems((rows) => [...rows, { ...blankItem(), sortOrder: rows.length }]);

  const fillFromProduct = (i: number, productId: number) => {
    const p = productsQuery.data?.items.find((x) => x.id === productId);
    if (!p) return;
    updateItem(i, {
      productId: p.id,
      productName: p.name,
      unitName: p.unitName,
      unitPrice: p.basePrice,
      gstRate: p.gstRate ?? 18,
    });
  };

  const buildPayload = (): QuotationDraftInput | null => {
    if (!customerId) return null;
    return {
      customerId: Number(customerId),
      validityDays,
      discountType,
      discountValue,
      freightAmount,
      termsConditions: terms || null,
      notes: notes || null,
      paymentTerms: paymentTerms || null,
      deliverySchedule: deliverySchedule || null,
      contactPersonId: contactPersonId === "" ? null : Number(contactPersonId),
      items: items.map((it, idx) => ({ ...it, sortOrder: idx })),
    };
  };

  const saveMutation = useMutation({
    mutationFn: async (finalize: boolean) => {
      const payload = buildPayload();
      if (!payload) throw new Error("Pick a customer first");
      const saved = isEdit
        ? await quotationsApi.updateDraft(Number(id), payload)
        : await quotationsApi.createDraft(payload);
      if (finalize) await quotationsApi.finalize(saved.id);
      return saved.id;
    },
    onSuccess: (savedId) => {
      qc.invalidateQueries({ queryKey: ["quotations"] });
      navigate(`/quotations/${savedId}`);
    },
  });

  const fmt = (n: number) =>
    n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      {/* Main form */}
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            {isEdit ? "Edit quotation" : "New quotation"}
          </h1>
          <p className="text-sm text-slate-500">Save as draft anytime; finalize when ready.</p>
        </div>

        <section className="grid grid-cols-1 gap-3 rounded-lg bg-white p-4 ring-1 ring-slate-200 sm:grid-cols-3">
          <Field label="Customer">
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value ? Number(e.target.value) : "")}
              className="form-select"
            >
              <option value="">Select customer…</option>
              {customersQuery.data?.items.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Validity (days)">
            <input
              type="number" min={1} max={365}
              value={validityDays}
              onChange={(e) => setValidityDays(Number(e.target.value))}
              className="form-input"
            />
          </Field>
        </section>

        <section className="rounded-lg bg-white ring-1 ring-slate-200">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-900">Items</h2>
            <button onClick={addRow} className="text-xs font-medium text-blue-700 hover:underline">
              + Add row
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2 w-8">#</th>
                  <th className="px-3 py-2">Product</th>
                  <th className="px-3 py-2 w-24 text-right">Qty</th>
                  <th className="px-3 py-2 w-28 text-right">Rate</th>
                  <th className="px-3 py-2 w-20 text-right">Disc %</th>
                  <th className="px-3 py-2 w-20 text-right">GST %</th>
                  <th className="px-3 py-2 w-32 text-right">Line Total</th>
                  <th className="px-3 py-2 w-8" />
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => {
                  const sub = (Number(it.qty) || 0) * (Number(it.unitPrice) || 0) * (1 - (Number(it.discountPercent) || 0) / 100);
                  const gst = (sub * (Number(it.gstRate) || 0)) / 100;
                  const lineTotal = sub + gst;
                  return (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="px-3 py-2 text-slate-400">{i + 1}</td>
                      <td className="px-3 py-2">
                        <select
                          value={it.productId ?? ""}
                          onChange={(e) => {
                            const v = e.target.value ? Number(e.target.value) : null;
                            if (v) fillFromProduct(i, v);
                            else updateItem(i, { productId: null });
                          }}
                          className="form-select w-full"
                        >
                          <option value="">— pick product —</option>
                          {productsQuery.data?.items.map((p) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                        {!it.productId && (
                          <input
                            placeholder="Or type custom item name"
                            value={it.productName}
                            onChange={(e) => updateItem(i, { productName: e.target.value })}
                            className="form-input mt-1 w-full"
                          />
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input type="number" step="0.01" value={it.qty}
                          onChange={(e) => updateItem(i, { qty: Number(e.target.value) })}
                          className="form-input text-right" />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input type="number" step="0.01" value={it.unitPrice}
                          onChange={(e) => updateItem(i, { unitPrice: Number(e.target.value) })}
                          className="form-input text-right" />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input type="number" step="0.01" value={it.discountPercent}
                          onChange={(e) => updateItem(i, { discountPercent: Number(e.target.value) })}
                          className="form-input text-right" />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input type="number" step="0.01" value={it.gstRate}
                          onChange={(e) => updateItem(i, { gstRate: Number(e.target.value) })}
                          className="form-input text-right" />
                      </td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums">
                        ₹ {fmt(lineTotal)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button onClick={() => removeItem(i)} className="text-slate-400 hover:text-red-600">×</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-3 rounded-lg bg-white p-4 ring-1 ring-slate-200 sm:grid-cols-3">
          <Field label="Header discount">
            <div className="flex gap-2">
              <select value={discountType}
                onChange={(e) => setDiscountType(e.target.value as "percent" | "amount")}
                className="form-select w-28">
                <option value="percent">%</option>
                <option value="amount">₹</option>
              </select>
              <input type="number" step="0.01" value={discountValue}
                onChange={(e) => setDiscountValue(Number(e.target.value))}
                className="form-input flex-1" />
            </div>
          </Field>
          <Field label="Freight">
            <input type="number" step="0.01" value={freightAmount}
              onChange={(e) => setFreightAmount(Number(e.target.value))}
              className="form-input" />
          </Field>
        </section>

        <section className="grid gap-3 rounded-lg bg-white p-4 ring-1 ring-slate-200 sm:grid-cols-2">
          <Field label="Payment Terms">
            <textarea rows={3} value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)}
              placeholder="e.g. 50% advance, 50% before dispatch"
              className="form-input resize-y" />
          </Field>
          <Field label="Delivery Schedule">
            <textarea rows={3} value={deliverySchedule} onChange={(e) => setDeliverySchedule(e.target.value)}
              placeholder="e.g. 4-6 weeks ex-works after PO"
              className="form-input resize-y" />
          </Field>
          <Field label="Terms & Conditions">
            <textarea rows={4} value={terms} onChange={(e) => setTerms(e.target.value)}
              className="form-input resize-y" />
          </Field>
          <Field label="Notes">
            <textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)}
              className="form-input resize-y" />
          </Field>
        </section>
      </div>

      {/* Sticky totals */}
      <aside className="space-y-3 lg:sticky lg:top-4 self-start">
        <div className="rounded-lg bg-white p-4 ring-1 ring-slate-200">
          <h3 className="text-sm font-semibold text-slate-900">Totals</h3>
          <div className="mt-3 space-y-2 text-sm">
            <Row label="Subtotal" value={`₹ ${fmt(totals.subtotal)}`} />
            <Row label="Discount" value={`- ₹ ${fmt(totals.discountAmount)}`} />
            <Row label="Taxable" value={`₹ ${fmt(totals.taxableAmount)}`} />
            <Row label="GST" value={`₹ ${fmt(totals.gstAmount)}`} />
            <Row label="Freight" value={`₹ ${fmt(totals.freightAmount)}`} />
            <div className="my-2 border-t border-slate-100" />
            <div className="flex items-center justify-between rounded-md bg-blue-700 px-3 py-2 text-white">
              <span className="text-xs uppercase tracking-wider">Grand Total</span>
              <span className="text-base font-bold tabular-nums">₹ {fmt(totals.grandTotal)}</span>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <button
            disabled={saveMutation.isPending}
            onClick={() => saveMutation.mutate(false)}
            className="h-10 w-full rounded-md bg-white text-sm font-medium text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-50"
          >
            {saveMutation.isPending ? "Saving…" : "Save draft"}
          </button>
          <button
            disabled={saveMutation.isPending}
            onClick={() => saveMutation.mutate(true)}
            className="h-10 w-full rounded-md bg-blue-700 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
          >
            Save & finalize
          </button>
          {saveMutation.isError && (
            <p className="text-xs text-red-600">{(saveMutation.error as Error).message}</p>
          )}
        </div>
      </aside>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}
