"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Download, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Typeahead, type TypeaheadOption } from "@/components/typeahead";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RichTextEditor } from "@/components/rich-text-editor";
import { useDebounced, useList, useResource } from "@/lib/hooks";
import { api, ApiClientError } from "@/lib/api-client";
import { calcPurchaseOrder, formatCurrency } from "@/lib/calc";
import { cn } from "@/lib/utils";
import {
  RequiredStar,
  getServerFieldErrors,
  summarizeFieldErrors,
  useFieldErrors,
} from "@/components/form-field";

const labelMap: Record<string, string> = {
  supplierId: "Supplier",
  expectedDate: "Expected Date",
  items: "Line items",
  productName: "Product name",
  qty: "Qty",
  unitPrice: "Unit price",
  discountPercent: "Discount %",
  gstSlabId: "GST slab",
};

type SupplierOption = { id: number; code: string; companyName: string };
type ProductOption = {
  id: number;
  sku: string | null;
  name: string;
  hsmCode: string | null;
  unitId: number | null;
  unitCode: string | null;
  unitName: string | null;
};
type GstSlabOption = { id: number; name: string; rate: string; isActive: boolean };
type BomOption = { id: number; bomCode: string; version: string; soId: number | null };
type SalesOrderOption = { id: number; soNumber: string; customerName: string | null };

export type POBuilderInitial = {
  id?: number;
  supplierId: number | null;
  soId: number | null;
  bomId: number | null;
  expectedDate: string;
  status: "draft" | "pending_approval" | "approved" | "sent" | "partial_received" | "closed" | "cancelled";
  currency: string;
  discountType: "percent" | "amount";
  discountValue: number;
  freightAmount: number;
  remarks: string;
  termsConditions: string;
  paymentTerms: string;
  items: BuilderItem[];
};

type BuilderItem = {
  productId: string;
  productQuery: string;
  productName: string;
  unitName: string;
  qty: string;
  unitPrice: string;
  discountPercent: string;
  gstSlabId: string;
  gstSlabQuery?: string;
  gstRate: string;
};

const today = () => new Date().toISOString().slice(0, 10);

export const blankInitial: POBuilderInitial = {
  supplierId: null,
  soId: null,
  bomId: null,
  expectedDate: today(),
  status: "draft",
  currency: "INR",
  discountType: "percent",
  discountValue: 0,
  freightAmount: 0,
  remarks: "",
  termsConditions: "1. All disputes are subject to local jurisdiction.\n2. Goods once sold will not be taken back.",
  paymentTerms: "Net 30 days",
  items: [
    {
      productId: "",
      productQuery: "",
      productName: "",
      unitName: "",
      qty: "1",
      unitPrice: "0",
      discountPercent: "0",
      gstSlabId: "",
      gstSlabQuery: "",
      gstRate: "0",
    },
  ],
};

function Field({ label, required, error, children, className }: any) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-sm font-semibold text-foreground/90">
        {label}
        {required ? <RequiredStar /> : null}
      </Label>
      {children}
      {error ? <p className="text-xs font-medium text-destructive">{error}</p> : null}
    </div>
  );
}

function Row({ label, value, strong }: any) {
  return (
    <div className={cn("flex justify-between", strong ? "text-base font-bold text-foreground" : "text-muted-foreground")}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export function PurchaseOrderBuilder({ initial, mode }: { initial: POBuilderInitial; mode: "create" | "edit" }) {
  const router = useRouter();
  const [form, setForm] = React.useState<POBuilderInitial>(initial);
  const [supplierQuery, setSupplierQuery] = React.useState("");
  const [productLookupQuery, setProductLookupQuery] = React.useState("");
  const [soLookupQuery, setSoLookupQuery] = React.useState("");
  const [bomImporting, setBomImporting] = React.useState(false);
  const supplierLookupQ = useDebounced(supplierQuery, 250);
  const productLookupQ = useDebounced(productLookupQuery, 250);
  const soLookupQ = useDebounced(soLookupQuery, 250);
  const [saving, setSaving] = React.useState(false);
  const { errors, set: setErrors, setOne } = useFieldErrors();
  const [itemErrors, setItemErrors] = React.useState<Record<number, Record<string, string>>>({});

  const { data: suppliers } = useList<SupplierOption>("/api/suppliers", { q: supplierLookupQ, limit: 100 });
  const { data: products } = useList<ProductOption>("/api/products", { q: productLookupQ, limit: 100 });
  const { data: masters } = useResource<{ gstSlabs: GstSlabOption[] }>("/api/masters");
  const { data: salesOrders } = useList<SalesOrderOption>("/api/sales-orders", { q: soLookupQ, limit: 50 });
  const { data: bomsData } = useList<BomOption>("/api/boms", { limit: 200 });

  // Filter BOMs by selected SO
  const bomOptions = React.useMemo(
    () => (bomsData?.rows || []).filter((b) => !form.soId || b.soId === form.soId),
    [bomsData, form.soId],
  );

  React.useEffect(() => {
    if (!suppliers?.rows || !form.supplierId) return;
    const picked = suppliers.rows.find((s) => s.id === form.supplierId);
    if (picked) setSupplierQuery(`${picked.code} - ${picked.companyName}`);
  }, [suppliers, form.supplierId]);

  const calc = React.useMemo(() => {
    return calcPurchaseOrder({
      items: form.items.map((it) => ({
        productId: Number(it.productId || 0),
        productName: it.productName || "—",
        unitName: it.unitName || null,
        qty: Number(it.qty) || 0,
        unitPrice: Number(it.unitPrice) || 0,
        discountPercent: Number(it.discountPercent) || 0,
        gstRate: Number(it.gstRate) || 0,
        gstSlabId: it.gstSlabId ? Number(it.gstSlabId) : null,
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

  function selectSupplier(option: TypeaheadOption) {
    const id = Number(option.value);
    setForm((f) => ({ ...f, supplierId: id }));
    setSupplierQuery(option.label);
    if (errors.supplierId) setOne("supplierId", undefined);
  }

  function selectProduct(idx: number, option: TypeaheadOption) {
    if (!products?.rows) return;
    const picked = products.rows.find((p) => String(p.id) === option.value);
    if (!picked) return;
    setForm((f) => {
      const items = [...f.items];
      items[idx] = {
        ...items[idx],
        productId: String(picked.id),
        productQuery: `${picked.sku ?? "NO-SKU"} - ${picked.name}`,
        productName: picked.name,
        unitName: picked.unitCode || picked.unitName || "",
      };
      return { ...f, items };
    });
  }

  function clientValidate(): { fieldErrors: Record<string, string>; itemErrs: Record<number, Record<string, string>> } {
    const fieldErrors: Record<string, string> = {};
    if (!form.supplierId) fieldErrors.supplierId = "Pick a supplier";
    if (!form.expectedDate) fieldErrors.expectedDate = "Expected date is required";

    const itemErrs: Record<number, Record<string, string>> = {};
    const nonEmpty = form.items.filter((it) => it.productName.trim() || it.productId);
    if (nonEmpty.length === 0) {
      fieldErrors.items = "Add at least one line item";
    }
    form.items.forEach((it, idx) => {
      const row: Record<string, string> = {};
      const isUsed = !!(it.productName.trim() || it.productId);
      if (isUsed && !it.productId) row.productName = "Select product";
      const qty = Number(it.qty);
      if (isUsed && (Number.isNaN(qty) || qty <= 0)) row.qty = "Must be greater than 0";
      const price = Number(it.unitPrice);
      if (isUsed && (Number.isNaN(price) || price < 0)) row.unitPrice = "≥ 0";
      const gst = Number(it.gstRate);
      if (isUsed && (Number.isNaN(gst) || gst < 0 || gst > 100)) row.gstRate = "0–100";
      if (Object.keys(row).length) itemErrs[idx] = row;
    });
    return { fieldErrors, itemErrs };
  }

  async function importFromBom() {
    if (!form.bomId) return toast.error("Select a BOM to import from");
    setBomImporting(true);
    try {
      const bom = await api<any>(`/api/boms/${form.bomId}`);
      const supplierItems: BuilderItem[] = (bom.items || [])
        .filter((it: any) => it.supplierProductId)
        .map((it: any) => ({
          productId: "",
          productQuery: `${it.supplierProductCode || ""} - ${it.supplierProductName || ""}`,
          productName: it.supplierProductName || "",
          unitName: "",
          qty: String(Math.ceil(it.qtyPerUnit)),
          unitPrice: it.standardPrice ? String(it.standardPrice) : "0",
          discountPercent: "0",
          gstSlabId: "",
          gstSlabQuery: "",
          gstRate: "0",
        }));
      if (supplierItems.length === 0) return toast.error("No supplier products in this BOM");
      setForm((f) => ({ ...f, items: supplierItems }));
      toast.success(`Imported ${supplierItems.length} items from BOM`);
    } catch {
      toast.error("Failed to load BOM");
    } finally {
      setBomImporting(false);
    }
  }

  async function onSave() {
    const { fieldErrors, itemErrs } = clientValidate();
    if (Object.keys(fieldErrors).length || Object.keys(itemErrs).length) {
      setErrors(fieldErrors);
      setItemErrors(itemErrs);
      toast.error("Please fix validation errors");
      return;
    }
    const items = form.items.filter((it) => it.productId);
    setSaving(true);
    const payload = {
      supplierId: form.supplierId,
      soId: form.soId ?? null,
      bomId: form.bomId ?? null,
      expectedDate: form.expectedDate,
      status: form.status,
      currency: "INR",
      discountType: form.discountType,
      discountValue: Number(form.discountValue) || 0,
      freightAmount: Number(form.freightAmount) || 0,
      remarks: form.remarks || null,
      termsConditions: form.termsConditions || null,
      paymentTerms: form.paymentTerms || null,
      items: items.map((it) => ({
        productId: Number(it.productId),
        productName: it.productName,
        unitName: it.unitName || null,
        qty: Number(it.qty) || 0,
        unitPrice: Number(it.unitPrice) || 0,
        discountPercent: Number(it.discountPercent) || 0,
        gstSlabId: it.gstSlabId ? Number(it.gstSlabId) : null,
        gstRate: Number(it.gstRate) || 0,
      })),
    };
    try {
      let entityId = initial.id;
      if (mode === "edit" && initial.id) {
        await api(`/api/purchase-orders/${initial.id}`, { method: "PUT", json: payload });
        toast.success("PO updated");
      } else {
        const created = await api<{ id: number }>("/api/purchase-orders", { method: "POST", json: payload });
        toast.success("PO created");
        entityId = created.id;
      }
      if (entityId) router.push(`/purchase-orders`);
    } catch (err) {
      const fe = getServerFieldErrors(err);
      if (Object.keys(fe).length) {
        setErrors(fe);
        toast.error(summarizeFieldErrors(fe, labelMap) ?? "Validation failed");
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
        title={mode === "edit" ? "Edit Purchase Order" : "New Purchase Order"}
        description="Draft a PO to send to your supplier."
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/purchase-orders">
                <ArrowLeft className="h-4 w-4" /> Back
              </Link>
            </Button>
            <Button onClick={onSave} disabled={saving}>
              {saving ? "Saving..." : mode === "edit" ? "Save changes" : "Create PO"}
            </Button>
          </div>
        }
      />

      <Card>
        <CardHeader><CardTitle className="text-base">Basic information</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Supplier" required error={errors.supplierId}>
            <Typeahead
              value={form.supplierId ? String(form.supplierId) : ""}
              inputValue={supplierQuery}
              onInputValueChange={(v) => { setSupplierQuery(v); setForm(f => ({...f, supplierId: null})) }}
              onSelect={selectSupplier}
              options={(suppliers?.rows ?? []).map(s => ({
                value: String(s.id),
                label: `${s.code} - ${s.companyName}`,
              }))}
              placeholder="Search supplier..."
            />
          </Field>
          <Field label="Expected Date" required error={errors.expectedDate}>
            <Input type="date" value={form.expectedDate} onChange={e => setForm(f => ({...f, expectedDate: e.target.value}))} />
          </Field>
          <Field label="Status" error={errors.status}>
            <Select value={form.status} onChange={e => setForm(f => ({...f, status: e.target.value as any}))}>
              <option value="draft">Draft</option>
              <option value="pending_approval">Pending Approval</option>
              <option value="closed">Closed</option>
              <option value="cancelled">Cancelled</option>
            </Select>
          </Field>
          <Field label="Linked Sales Order (optional)">
            <Typeahead
              value={form.soId ? String(form.soId) : ""}
              inputValue={form.soId ? (salesOrders?.rows.find(s => s.id === form.soId)?.soNumber ?? String(form.soId)) : ""}
              onInputValueChange={(v) => { setSoLookupQuery(v); setForm(f => ({...f, soId: null, bomId: null})); }}
              onSelect={(opt) => setForm(f => ({...f, soId: Number(opt.value), bomId: null}))}
              options={(salesOrders?.rows ?? []).map(s => ({ value: String(s.id), label: `${s.soNumber}${s.customerName ? " — " + s.customerName : ""}` }))}
              placeholder="Search SO…"
            />
          </Field>
          <Field label="Linked BOM (optional)">
            <div className="flex gap-2">
              <div className="flex-1">
                <Select value={form.bomId ? String(form.bomId) : ""} onChange={e => setForm(f => ({...f, bomId: e.target.value ? Number(e.target.value) : null}))}>
                  <option value="">— none —</option>
                  {bomOptions.map(b => <option key={b.id} value={String(b.id)}>{b.bomCode} v{b.version}</option>)}
                </Select>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={importFromBom} disabled={bomImporting || !form.bomId} title="Import supplier items from BOM">
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row justify-between">
          <div className="flex-1">
            <CardTitle className="text-base">Line items</CardTitle>
            {errors.items ? (
              <p className="mt-1 text-xs font-medium text-destructive">{errors.items}</p>
            ) : null}
          </div>
          <Button size="sm" variant="outline" onClick={() => setForm(f => ({...f, items: [...f.items, blankInitial.items[0]!]}))}>
            <Plus className="h-4 w-4" /> Add row
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {form.items.map((it, idx) => {
            const line = calc.lines[idx];
            return (
              <div key={idx} className="grid gap-2 rounded-md border bg-muted/30 p-3 lg:grid-cols-12">
                <div className="lg:col-span-3">
                  <Label className="text-[10px] uppercase text-muted-foreground">Product <span className="text-destructive">*</span></Label>
                  <Typeahead
                    value={it.productId}
                    inputValue={it.productQuery}
                    onInputValueChange={(v) => {
                      setProductLookupQuery(v);
                      updateItem(idx, "productQuery", v);
                    }}
                    onSelect={(opt) => selectProduct(idx, opt)}
                    options={(products?.rows ?? []).map(p => ({
                      value: String(p.id),
                      label: `${p.sku || ""} - ${p.name}`
                    }))}
                    placeholder="Search product..."
                  />
                  {itemErrors[idx]?.productName ? (
                    <p className="mt-0.5 text-xs font-medium text-destructive">{itemErrors[idx].productName}</p>
                  ) : null}
                </div>
                <div className="lg:col-span-1">
                  <Label className="text-[10px] uppercase text-muted-foreground">Qty <span className="text-destructive">*</span></Label>
                  <Input type="number" min="1" step="1" value={it.qty} onChange={e => updateItem(idx, "qty", e.target.value)} />
                  {itemErrors[idx]?.qty ? (
                    <p className="mt-0.5 text-xs font-medium text-destructive">{itemErrors[idx].qty}</p>
                  ) : null}
                </div>
                <div className="lg:col-span-2">
                  <Label className="text-[10px] uppercase text-muted-foreground">Unit price <span className="text-destructive">*</span></Label>
                  <Input type="number" min="0" value={it.unitPrice} onChange={e => updateItem(idx, "unitPrice", e.target.value)} />
                  {itemErrors[idx]?.unitPrice ? (
                    <p className="mt-0.5 text-xs font-medium text-destructive">{itemErrors[idx].unitPrice}</p>
                  ) : null}
                </div>
                <div className="lg:col-span-1">
                  <Label className="text-[10px] uppercase text-muted-foreground">Disc %</Label>
                  <Input type="number" min="0" max="100" value={it.discountPercent} onChange={e => updateItem(idx, "discountPercent", e.target.value)} />
                </div>
                <div className="lg:col-span-2">
                  <Label className="text-[10px] uppercase text-muted-foreground">GST slab</Label>
                  <Typeahead
                    value={it.gstSlabId}
                    inputValue={it.gstSlabQuery || ""}
                    onInputValueChange={(v) => {
                      setForm((f) => {
                        const items = [...f.items];
                        items[idx] = { ...items[idx], gstSlabId: "", gstRate: "0", gstSlabQuery: v };
                        return { ...f, items };
                      });
                    }}
                    onSelect={(opt) => {
                      const slab = masters?.gstSlabs.find((g) => String(g.id) === opt.value);
                      setForm((f) => {
                        const items = [...f.items];
                        items[idx] = {
                          ...items[idx],
                          gstSlabId: opt.value,
                          gstRate: slab ? String(slab.rate) : "0",
                          gstSlabQuery: opt.label,
                        };
                        return { ...f, items };
                      });
                    }}
                    options={(masters?.gstSlabs ?? [])
                      .filter((g) => g.isActive)
                      .map((g) => ({ value: String(g.id), label: `${g.name} (${g.rate}%)` }))}
                    placeholder="Search GST slab..."
                  />
                </div>
                <div className="lg:col-span-2 flex items-end justify-between gap-2">
                  <div className="text-right text-sm tabular-nums">
                    <div className="text-[10px] uppercase text-muted-foreground">Total</div>
                    <div>{formatCurrency(line?.lineTotal ?? 0, "INR")}</div>
                  </div>
                  <Button type="button" variant="ghost" size="icon" onClick={() => setForm(f => ({...f, items: f.items.filter((_, i) => i !== idx)}))} disabled={form.items.length <= 1}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Commercial Terms</CardTitle></CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-2">
          <Field label="Payment terms">
             <RichTextEditor value={form.paymentTerms} onChange={v => setForm(f => ({...f, paymentTerms: v}))} minHeight={100} />
          </Field>
          <Field label="Terms & Conditions">
             <RichTextEditor value={form.termsConditions} onChange={v => setForm(f => ({...f, termsConditions: v}))} minHeight={100} />
          </Field>
          <Field label="Internal Remarks" className="lg:col-span-2">
             <RichTextEditor value={form.remarks} onChange={v => setForm(f => ({...f, remarks: v}))} minHeight={100} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Totals</CardTitle></CardHeader>
        <CardContent>
          <dl className="space-y-2 text-sm">
            <Row label="Subtotal" value={formatCurrency(calc.subtotal, "INR")} />
            <Row label="Taxable" value={formatCurrency(calc.taxableAmount, "INR")} />
            <Row label="GST" value={formatCurrency(calc.gstAmount, "INR")} />
            <div className="my-2 h-px bg-border" />
            <Row label="Grand total" value={formatCurrency(calc.grandTotal, "INR")} strong />
          </dl>
        </CardContent>
      </Card>

    </div>
  );
}
