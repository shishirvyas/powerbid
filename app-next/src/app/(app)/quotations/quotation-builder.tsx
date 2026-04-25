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
import { cn } from "@/lib/utils";
import {
  RequiredStar,
  getServerFieldErrors,
  summarizeFieldErrors,
  useFieldErrors,
} from "@/components/form-field";

const labelMap: Record<string, string> = {
  customerId: "Customer",
  quotationDate: "Date",
  validityDays: "Validity",
  status: "Status",
  currency: "Currency",
  discountType: "Discount type",
  discountValue: "Discount value",
  freightAmount: "Freight",
  items: "Line items",
};

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
  const { errors, set: setErrors, setOne } = useFieldErrors();
  const [itemErrors, setItemErrors] = React.useState<Record<number, Record<string, string>>>({});

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
    if (itemErrors[idx]?.[key]) {
      setItemErrors((e) => {
        const copy = { ...e };
        const row = { ...(copy[idx] ?? {}) };
        delete row[key];
        if (Object.keys(row).length === 0) delete copy[idx];
        else copy[idx] = row;
        return copy;
      });
    }
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

  function clientValidate(): { fieldErrors: Record<string, string>; itemErrs: Record<number, Record<string, string>> } {
    const fieldErrors: Record<string, string> = {};
    if (!form.customerId) fieldErrors.customerId = "Pick a customer";
    if (!form.quotationDate) fieldErrors.quotationDate = "Date is required";
    if (!form.currency || form.currency.length !== 3) fieldErrors.currency = "3-letter currency code (e.g. INR)";
    const validity = Number(form.validityDays);
    if (Number.isNaN(validity) || validity < 0 || validity > 365) fieldErrors.validityDays = "0–365";

    const itemErrs: Record<number, Record<string, string>> = {};
    const nonEmpty = form.items.filter((it) => it.productName.trim() || it.productId);
    if (nonEmpty.length === 0) {
      fieldErrors.items = "Add at least one line item";
    }
    form.items.forEach((it, idx) => {
      const row: Record<string, string> = {};
      const isUsed = !!(it.productName.trim() || it.productId);
      if (isUsed && !it.productName.trim()) row.productName = "Required";
      const qty = Number(it.qty);
      if (isUsed && (Number.isNaN(qty) || qty <= 0)) row.qty = "> 0";
      const price = Number(it.unitPrice);
      if (isUsed && (Number.isNaN(price) || price < 0)) row.unitPrice = "≥ 0";
      const disc = Number(it.discountPercent);
      if (isUsed && (Number.isNaN(disc) || disc < 0 || disc > 100)) row.discountPercent = "0–100";
      const gst = Number(it.gstRate);
      if (isUsed && (Number.isNaN(gst) || gst < 0 || gst > 100)) row.gstRate = "0–100";
      if (Object.keys(row).length) itemErrs[idx] = row;
    });
    return { fieldErrors, itemErrs };
  }

  async function onSave(redirect: boolean) {
    const { fieldErrors, itemErrs } = clientValidate();
    if (Object.keys(fieldErrors).length || Object.keys(itemErrs).length) {
      setErrors(fieldErrors);
      setItemErrors(itemErrs);
      const summary = summarizeFieldErrors(fieldErrors, labelMap);
      const itemSummary = Object.keys(itemErrs).length
        ? `Item ${Number(Object.keys(itemErrs)[0]) + 1} has errors`
        : null;
      toast.error(summary ?? itemSummary ?? "Please fix the highlighted fields");
      return;
    }
    const items = form.items.filter((it) => it.productName.trim());
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
      const fe = getServerFieldErrors(err);
      if (Object.keys(fe).length) {
        // Server may return nested item paths like "items.0.qty" — pull those into itemErrors
        const flatField: Record<string, string> = {};
        const itemErrs: Record<number, Record<string, string>> = {};
        for (const [key, msg] of Object.entries(fe)) {
          if (!msg) continue;
          const m = key.match(/^items\.(\d+)\.(.+)$/);
          if (m) {
            const i = Number(m[1]);
            (itemErrs[i] ??= {})[m[2]!] = msg;
          } else {
            flatField[key] = msg;
          }
        }
        setErrors(flatField);
        setItemErrors(itemErrs);
        toast.error(
          summarizeFieldErrors(flatField, labelMap) ??
            (Object.keys(itemErrs).length ? `Item ${Number(Object.keys(itemErrs)[0]) + 1} has errors` : "Validation failed"),
        );
      } else {
        toast.error(err instanceof ApiClientError ? err.message : "Save failed");
      }
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
          <Field label="Customer" required error={errors.customerId}>
            <Select
              value={form.customerId ? String(form.customerId) : ""}
              onChange={(e) => {
                setForm((f) => ({ ...f, customerId: e.target.value ? Number(e.target.value) : null }));
                if (errors.customerId) setOne("customerId", undefined);
              }}
              aria-invalid={!!errors.customerId}
              className={errors.customerId ? "border-destructive focus-visible:ring-destructive" : undefined}
            >
              <option value="">— Select —</option>
              {customers?.rows.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Date" required error={errors.quotationDate}>
            <Input
              type="date"
              value={form.quotationDate}
              onChange={(e) => {
                setForm((f) => ({ ...f, quotationDate: e.target.value }));
                if (errors.quotationDate) setOne("quotationDate", undefined);
              }}
              aria-invalid={!!errors.quotationDate}
              className={errors.quotationDate ? "border-destructive focus-visible:ring-destructive" : undefined}
            />
          </Field>
          <Field label="Validity (days)" error={errors.validityDays}>
            <Input
              type="number"
              min={0}
              max={365}
              value={form.validityDays}
              onChange={(e) => {
                setForm((f) => ({ ...f, validityDays: Number(e.target.value) || 0 }));
                if (errors.validityDays) setOne("validityDays", undefined);
              }}
              aria-invalid={!!errors.validityDays}
              className={errors.validityDays ? "border-destructive focus-visible:ring-destructive" : undefined}
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
          <Field label="Currency" required error={errors.currency}>
            <Input
              value={form.currency}
              onChange={(e) => {
                setForm((f) => ({ ...f, currency: e.target.value.toUpperCase().slice(0, 3) }));
                if (errors.currency) setOne("currency", undefined);
              }}
              maxLength={3}
              aria-invalid={!!errors.currency}
              className={errors.currency ? "border-destructive focus-visible:ring-destructive" : undefined}
            />
          </Field>
        </CardContent>
      </Card>

      <Card className={errors.items ? "border-destructive/60" : undefined}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">Line items<RequiredStar /></CardTitle>
            {errors.items ? (
              <p className="mt-1 text-xs font-medium text-destructive">{errors.items}</p>
            ) : null}
          </div>
          <Button type="button" size="sm" variant="outline" onClick={addItem}>
            <Plus className="h-4 w-4" /> Add row
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {form.items.map((it, idx) => {
            const line = calc.lines[idx];
            const ie = itemErrors[idx] ?? {};
            const hasErr = Object.keys(ie).length > 0;
            return (
              <div
                key={idx}
                className={cn(
                  "grid gap-2 rounded-md border bg-muted/30 p-3 lg:grid-cols-12",
                  hasErr ? "border-destructive/60" : "",
                )}
              >
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
                  <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Name<RequiredStar />
                  </Label>
                  <Input
                    value={it.productName}
                    onChange={(e) => updateItem(idx, "productName", e.target.value)}
                    aria-invalid={!!ie.productName}
                    className={ie.productName ? "border-destructive focus-visible:ring-destructive" : undefined}
                  />
                  {ie.productName ? <p className="mt-0.5 text-[11px] font-medium text-destructive">{ie.productName}</p> : null}
                </div>
                <div className="lg:col-span-1">
                  <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Qty</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={it.qty}
                    onChange={(e) => updateItem(idx, "qty", e.target.value)}
                    aria-invalid={!!ie.qty}
                    className={ie.qty ? "border-destructive focus-visible:ring-destructive" : undefined}
                  />
                  {ie.qty ? <p className="mt-0.5 text-[11px] font-medium text-destructive">{ie.qty}</p> : null}
                </div>
                <div className="lg:col-span-2">
                  <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Unit price</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={it.unitPrice}
                    onChange={(e) => updateItem(idx, "unitPrice", e.target.value)}
                    aria-invalid={!!ie.unitPrice}
                    className={ie.unitPrice ? "border-destructive focus-visible:ring-destructive" : undefined}
                  />
                  {ie.unitPrice ? <p className="mt-0.5 text-[11px] font-medium text-destructive">{ie.unitPrice}</p> : null}
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
                    aria-invalid={!!ie.discountPercent}
                    className={ie.discountPercent ? "border-destructive focus-visible:ring-destructive" : undefined}
                  />
                  {ie.discountPercent ? <p className="mt-0.5 text-[11px] font-medium text-destructive">{ie.discountPercent}</p> : null}
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
                    aria-invalid={!!ie.gstRate}
                    className={ie.gstRate ? "border-destructive focus-visible:ring-destructive" : undefined}
                  />
                  {ie.gstRate ? <p className="mt-0.5 text-[11px] font-medium text-destructive">{ie.gstRate}</p> : null}
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
  required,
  error,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  required?: boolean;
  error?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
        {required ? <RequiredStar /> : null}
      </Label>
      {children}
      {error ? <p className="text-xs font-medium text-destructive">{error}</p> : null}
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
