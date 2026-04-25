"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useList, useResource } from "@/lib/hooks";
import { api, ApiClientError } from "@/lib/api-client";
import { calcQuotation, formatCurrency } from "@/lib/calc";

type CustomerOption = { id: number; code: string; name: string };
type ProductOption = {
  id: number;
  sku: string;
  name: string;
  basePrice: string;
  unitName: string | null;
  gstRate: string | null;
};

export type QuotationBuilderInitial = {
  id?: number;
  quotationDate: string;
  validityDays: number;
  customerId: number | null;
  contactPersonId: number | null;
  status: "draft" | "sent" | "won" | "lost" | "expired" | "cancelled";
  currency: string;
  discountType: "percent" | "amount";
  discountValue: number;
  freightAmount: number;
  termsConditions: string;
  paymentTerms: string;
  deliverySchedule: string;
  notes: string;
  items: BuilderItem[];
};

type BuilderItem = {
  productId: string;
  productName: string;
  unitName: string;
  qty: string;
  unitPrice: string;
  discountPercent: string;
  gstRate: string;
};

const today = () => new Date().toISOString().slice(0, 10);

export const blankInitial: QuotationBuilderInitial = {
  quotationDate: today(),
  validityDays: 15,
  customerId: null,
  contactPersonId: null,
  status: "draft",
  currency: "INR",
  discountType: "percent",
  discountValue: 0,
  freightAmount: 0,
  termsConditions: "",
  paymentTerms: "",
  deliverySchedule: "",
  notes: "",
  items: [
    {
      productId: "",
      productName: "",
      unitName: "",
      qty: "1",
      unitPrice: "0",
      discountPercent: "0",
      gstRate: "18",
    },
  ],
};

export function QuotationBuilder({ initial, mode }: { initial: QuotationBuilderInitial; mode: "create" | "edit" }) {
  const router = useRouter();
  const [form, setForm] = React.useState<QuotationBuilderInitial>(initial);
  const [saving, setSaving] = React.useState(false);

  const { data: customers } = useList<CustomerOption>("/api/customers", { limit: 200 });
  const { data: products } = useList<ProductOption>("/api/products", { limit: 200 });

  const calc = React.useMemo(() => {
    return calcQuotation({
      items: form.items.map((it) => ({
        productId: it.productId ? Number(it.productId) : null,
        productName: it.productName || "—",
        unitName: it.unitName || null,
        qty: Number(it.qty) || 0,
        unitPrice: Number(it.unitPrice) || 0,
        discountPercent: Number(it.discountPercent) || 0,
        gstRate: Number(it.gstRate) || 0,
      })),
      discountType: form.discountType,
      discountValue: Number(form.discountValue) || 0,
      freightAmount: Number(form.freightAmount) || 0,
    });
  }, [form]);

  function updateItem(idx: number, key: keyof BuilderItem, value: string) {
    setForm((f) => {
      const items = [...f.items];
      items[idx] = { ...items[idx], [key]: value };
      if (key === "productId" && value && products) {
        const p = products.rows.find((x) => String(x.id) === value);
        if (p) {
          items[idx].productName = p.name;
          items[idx].unitPrice = p.basePrice ?? "0";
          items[idx].unitName = p.unitName ?? "";
          items[idx].gstRate = p.gstRate ?? items[idx].gstRate;
        }
      }
      return { ...f, items };
    });
  }
  function addItem() {
    setForm((f) => ({
      ...f,
      items: [
        ...f.items,
        {
          productId: "",
          productName: "",
          unitName: "",
          qty: "1",
          unitPrice: "0",
          discountPercent: "0",
          gstRate: "18",
        },
      ],
    }));
  }
  function removeItem(idx: number) {
    setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));
  }

  async function onSave(redirect: boolean) {
    if (!form.customerId) {
      toast.error("Pick a customer");
      return;
    }
    const items = form.items.filter((it) => it.productName.trim());
    if (items.length === 0) {
      toast.error("Add at least one line item");
      return;
    }
    setSaving(true);
    const payload = {
      quotationDate: form.quotationDate,
      validityDays: Number(form.validityDays) || 0,
      customerId: form.customerId,
      contactPersonId: form.contactPersonId,
      status: form.status,
      currency: form.currency,
      discountType: form.discountType,
      discountValue: Number(form.discountValue) || 0,
      freightAmount: Number(form.freightAmount) || 0,
      termsConditions: form.termsConditions || null,
      paymentTerms: form.paymentTerms || null,
      deliverySchedule: form.deliverySchedule || null,
      notes: form.notes || null,
      items: items.map((it) => ({
        productId: it.productId ? Number(it.productId) : null,
        productName: it.productName,
        unitName: it.unitName || null,
        qty: Number(it.qty) || 0,
        unitPrice: Number(it.unitPrice) || 0,
        discountPercent: Number(it.discountPercent) || 0,
        gstRate: Number(it.gstRate) || 0,
      })),
    };
    try {
      if (mode === "edit" && initial.id) {
        await api(`/api/quotations/${initial.id}`, { method: "PUT", json: payload });
        toast.success("Quotation updated");
        if (redirect) router.push(`/quotations/${initial.id}`);
      } else {
        const created = await api<{ id: number }>("/api/quotations", { method: "POST", json: payload });
        toast.success("Quotation created");
        if (redirect) router.push(`/quotations/${created.id}`);
      }
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in-50">
      <PageHeader
        title={mode === "edit" ? "Edit quotation" : "New quotation"}
        description="Build line items, totals are computed live."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/quotations">
                <ArrowLeft className="h-4 w-4" /> Back
              </Link>
            </Button>
            <Button onClick={() => onSave(true)} disabled={saving}>
              {saving ? "Saving..." : mode === "edit" ? "Save & view" : "Create & view"}
            </Button>
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Header</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Customer *">
            <Select
              value={form.customerId ? String(form.customerId) : ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, customerId: e.target.value ? Number(e.target.value) : null }))
              }
            >
              <option value="">— Select —</option>
              {customers?.rows.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Date">
            <Input
              type="date"
              value={form.quotationDate}
              onChange={(e) => setForm((f) => ({ ...f, quotationDate: e.target.value }))}
            />
          </Field>
          <Field label="Validity (days)">
            <Input
              type="number"
              min={0}
              max={365}
              value={form.validityDays}
              onChange={(e) => setForm((f) => ({ ...f, validityDays: Number(e.target.value) || 0 }))}
            />
          </Field>
          <Field label="Status">
            <Select
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as QuotationBuilderInitial["status"] }))}
            >
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="won">Won</option>
              <option value="lost">Lost</option>
              <option value="expired">Expired</option>
              <option value="cancelled">Cancelled</option>
            </Select>
          </Field>
          <Field label="Currency">
            <Input
              value={form.currency}
              onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value.toUpperCase().slice(0, 3) }))}
              maxLength={3}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Line items</CardTitle>
          <Button type="button" size="sm" variant="outline" onClick={addItem}>
            <Plus className="h-4 w-4" /> Add row
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {form.items.map((it, idx) => {
            const line = calc.lines[idx];
            return (
              <div key={idx} className="grid gap-2 rounded-md border bg-muted/30 p-3 lg:grid-cols-12">
                <div className="lg:col-span-3">
                  <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Product</Label>
                  <Select
                    value={it.productId}
                    onChange={(e) => updateItem(idx, "productId", e.target.value)}
                  >
                    <option value="">— Free text —</option>
                    {products?.rows.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.sku} — {p.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="lg:col-span-3">
                  <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Name *</Label>
                  <Input
                    value={it.productName}
                    onChange={(e) => updateItem(idx, "productName", e.target.value)}
                  />
                </div>
                <div className="lg:col-span-1">
                  <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Qty</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={it.qty}
                    onChange={(e) => updateItem(idx, "qty", e.target.value)}
                  />
                </div>
                <div className="lg:col-span-2">
                  <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Unit price</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={it.unitPrice}
                    onChange={(e) => updateItem(idx, "unitPrice", e.target.value)}
                  />
                </div>
                <div className="lg:col-span-1">
                  <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Disc %</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={it.discountPercent}
                    onChange={(e) => updateItem(idx, "discountPercent", e.target.value)}
                  />
                </div>
                <div className="lg:col-span-1">
                  <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">GST %</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={it.gstRate}
                    onChange={(e) => updateItem(idx, "gstRate", e.target.value)}
                  />
                </div>
                <div className="lg:col-span-1 flex items-end justify-between gap-2">
                  <div className="text-right text-sm tabular-nums">
                    <div className="text-[10px] uppercase text-muted-foreground">Total</div>
                    <div>{formatCurrency(line?.lineTotal ?? 0, form.currency)}</div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeItem(idx)}
                    disabled={form.items.length <= 1}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Discount &amp; freight</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Discount type">
              <Select
                value={form.discountType}
                onChange={(e) =>
                  setForm((f) => ({ ...f, discountType: e.target.value as "percent" | "amount" }))
                }
              >
                <option value="percent">Percent</option>
                <option value="amount">Amount</option>
              </Select>
            </Field>
            <Field label="Discount value">
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.discountValue}
                onChange={(e) => setForm((f) => ({ ...f, discountValue: Number(e.target.value) || 0 }))}
              />
            </Field>
            <Field label="Freight" className="sm:col-span-2">
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.freightAmount}
                onChange={(e) => setForm((f) => ({ ...f, freightAmount: Number(e.target.value) || 0 }))}
              />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Totals</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2 text-sm">
              <Row label="Subtotal" value={formatCurrency(calc.subtotal, form.currency)} />
              <Row label="Discount" value={`− ${formatCurrency(calc.discountAmount, form.currency)}`} />
              <Row label="Taxable" value={formatCurrency(calc.taxableAmount, form.currency)} />
              <Row label="GST" value={formatCurrency(calc.gstAmount, form.currency)} />
              <Row label="Freight" value={formatCurrency(calc.freightAmount, form.currency)} />
              <div className="my-2 h-px bg-border" />
              <Row
                label="Grand total"
                value={formatCurrency(calc.grandTotal, form.currency)}
                strong
              />
            </dl>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Terms &amp; notes</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-2">
          <Field label="Payment terms">
            <Textarea
              rows={2}
              value={form.paymentTerms}
              onChange={(e) => setForm((f) => ({ ...f, paymentTerms: e.target.value }))}
            />
          </Field>
          <Field label="Delivery schedule">
            <Textarea
              rows={2}
              value={form.deliverySchedule}
              onChange={(e) => setForm((f) => ({ ...f, deliverySchedule: e.target.value }))}
            />
          </Field>
          <Field label="Terms &amp; conditions" className="lg:col-span-2">
            <Textarea
              rows={3}
              value={form.termsConditions}
              onChange={(e) => setForm((f) => ({ ...f, termsConditions: e.target.value }))}
            />
          </Field>
          <Field label="Internal notes" className="lg:col-span-2">
            <Textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </Field>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button asChild variant="outline">
          <Link href="/quotations">Cancel</Link>
        </Button>
        <Button onClick={() => onSave(true)} disabled={saving}>
          {saving ? "Saving..." : mode === "edit" ? "Save & view" : "Create & view"}
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${strong ? "text-base font-semibold" : ""}`}>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

export function QuotationBuilderForId({ id }: { id: number }) {
  const { data, loading, error } = useResource<{
    id: number;
    quotationDate: string;
    validityDays: number;
    customerId: number;
    contactPersonId: number | null;
    status: string;
    currency: string;
    discountType: string;
    discountValue: string;
    freightAmount: string;
    termsConditions: string | null;
    paymentTerms: string | null;
    deliverySchedule: string | null;
    notes: string | null;
    items: {
      productId: number | null;
      productName: string;
      unitName: string | null;
      qty: string;
      unitPrice: string;
      discountPercent: string;
      gstRate: string;
    }[];
  }>(`/api/quotations/${id}`);

  if (error) {
    return <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>;
  }
  if (loading || !data) {
    return <div className="text-sm text-muted-foreground">Loading...</div>;
  }
  const initial: QuotationBuilderInitial = {
    id: data.id,
    quotationDate: (data.quotationDate ?? today()).slice(0, 10),
    validityDays: data.validityDays ?? 15,
    customerId: data.customerId,
    contactPersonId: data.contactPersonId ?? null,
    status: (data.status as QuotationBuilderInitial["status"]) ?? "draft",
    currency: data.currency ?? "INR",
    discountType: (data.discountType as "percent" | "amount") ?? "percent",
    discountValue: Number(data.discountValue) || 0,
    freightAmount: Number(data.freightAmount) || 0,
    termsConditions: data.termsConditions ?? "",
    paymentTerms: data.paymentTerms ?? "",
    deliverySchedule: data.deliverySchedule ?? "",
    notes: data.notes ?? "",
    items: (data.items.length > 0 ? data.items : []).map((it) => ({
      productId: it.productId ? String(it.productId) : "",
      productName: it.productName,
      unitName: it.unitName ?? "",
      qty: it.qty ?? "1",
      unitPrice: it.unitPrice ?? "0",
      discountPercent: it.discountPercent ?? "0",
      gstRate: it.gstRate ?? "18",
    })),
  };
  if (initial.items.length === 0) initial.items = blankInitial.items;
  return <QuotationBuilder mode="edit" initial={initial} />;
}
