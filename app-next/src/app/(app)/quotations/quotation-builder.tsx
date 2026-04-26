"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AttachmentsPanel, uploadEntityAttachments } from "@/components/attachments-panel";
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
import { parseQtyBreakup, stringifyQtyBreakup, sumQtyBreakup } from "@/lib/quotation-format";
import {
  DEFAULT_COMMERCIAL_TERMS,
  DEFAULT_INTRO_PARAGRAPH,
  DEFAULT_SUBJECT,
} from "@/lib/quotation-templates";
import {
  RequiredStar,
  getServerFieldErrors,
  summarizeFieldErrors,
  useFieldErrors,
} from "@/components/form-field";

const labelMap: Record<string, string> = {
  customerId: "Customer",
  referenceNo: "Ref number",
  quotationDate: "Date",
  subject: "Subject",
  projectName: "Project name",
  customerAttention: "Kind attention",
  validityDays: "Validity",
  status: "Status",
  currency: "Currency",
  discountType: "Discount type",
  discountValue: "Discount value",
  freightAmount: "Freight",
  items: "Line items",
  productName: "Product name",
  unitName: "Unit",
  qty: "Qty",
  qtyBreakup: "Qty breakup",
  unitPrice: "Unit price",
  discountPercent: "Discount %",
  gstRate: "GST %",
};

type SectionKey = "basic" | "items" | "commercial" | "attachments" | "signature";
type SignatureMode = "upload" | "draw" | "typed";

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
  referenceNo: string;
  quotationDate: string;
  subject: string;
  projectName: string;
  customerAttention: string;
  introText: string;
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
  signatureMode: SignatureMode;
  signatureData: string;
  signatureName: string;
  signatureDesignation: string;
  signatureMobile: string;
  signatureEmail: string;
  items: BuilderItem[];
};

type BuilderItem = {
  productId: string;
  productName: string;
  unitName: string;
  qtyBreakup: string;
  qty: string;
  unitPrice: string;
  discountPercent: string;
  gstRate: string;
};

const today = () => new Date().toISOString().slice(0, 10);

export const blankInitial: QuotationBuilderInitial = {
  referenceNo: "",
  quotationDate: today(),
  subject: DEFAULT_SUBJECT,
  projectName: "",
  customerAttention: "",
  introText: DEFAULT_INTRO_PARAGRAPH,
  validityDays: 15,
  customerId: null,
  contactPersonId: null,
  status: "draft",
  currency: "INR",
  discountType: "percent",
  discountValue: 0,
  freightAmount: 0,
  termsConditions: DEFAULT_COMMERCIAL_TERMS,
  paymentTerms: "",
  deliverySchedule: "",
  notes: "",
  signatureMode: "typed",
  signatureData: "",
  signatureName: "",
  signatureDesignation: "",
  signatureMobile: "",
  signatureEmail: "",
  items: [
    {
      productId: "",
      productName: "",
      unitName: "",
      qtyBreakup: "",
      qty: "1",
      unitPrice: "0",
      discountPercent: "0",
      gstRate: "18",
    },
  ],
};

const sectionMeta: Array<{ key: SectionKey; label: string }> = [
  { key: "basic", label: "Basic info" },
  { key: "items", label: "Items" },
  { key: "commercial", label: "Commercial terms" },
  { key: "attachments", label: "Attachments" },
  { key: "signature", label: "Signature & send" },
];

function fieldSection(key: string): SectionKey {
  if (key === "items" || key.startsWith("items.")) return "items";
  if (["paymentTerms", "deliverySchedule", "termsConditions", "notes"].includes(key)) return "commercial";
  if (["signatureMode", "signatureData", "signatureName", "signatureDesignation", "signatureMobile", "signatureEmail"].includes(key)) return "signature";
  if (key.startsWith("attachments")) return "attachments";
  return "basic";
}

function scrollToSection(section: SectionKey) {
  if (typeof document === "undefined") return;
  document.getElementById(`quotation-section-${section}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function QuotationBuilder({ initial, mode }: { initial: QuotationBuilderInitial; mode: "create" | "edit" }) {
  const router = useRouter();
  const [form, setForm] = React.useState<QuotationBuilderInitial>(initial);
  const [pendingAttachments, setPendingAttachments] = React.useState<File[]>([]);
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
        qtyBreakup: it.qtyBreakup || null,
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

  const validationSummary = React.useMemo(() => {
    const rows: Array<{ key: string; message: string; section: SectionKey }> = [];
    for (const [key, message] of Object.entries(errors)) {
      if (!message) continue;
      rows.push({ key, message, section: fieldSection(key) });
    }
    for (const [index, fields] of Object.entries(itemErrors)) {
      const labels = Object.entries(fields).map(([key, message]) => `${labelMap[key] ?? key}: ${message}`);
      if (labels.length) {
        rows.push({
          key: `items.${index}`,
          message: `Item ${Number(index) + 1}: ${labels.join(", ")}`,
          section: "items",
        });
      }
    }
    return rows;
  }, [errors, itemErrors]);

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
      if (key === "qtyBreakup") {
        const map = parseQtyBreakup(value);
        const totalQty = sumQtyBreakup(map);
        if (totalQty > 0) items[idx].qty = String(totalQty);
        items[idx].qtyBreakup = stringifyQtyBreakup(map);
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
          qtyBreakup: "",
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
      const firstSection = Object.keys(fieldErrors)[0]
        ? fieldSection(Object.keys(fieldErrors)[0]!)
        : Object.keys(itemErrs).length
          ? "items"
          : "basic";
      setTimeout(() => scrollToSection(firstSection), 0);
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
      referenceNo: form.referenceNo || null,
      quotationDate: form.quotationDate,
      subject: form.subject || null,
      projectName: form.projectName || null,
      customerAttention: form.customerAttention || null,
      introText: form.introText || null,
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
      signatureMode: form.signatureMode || null,
      signatureData: form.signatureData || null,
      signatureName: form.signatureName || null,
      signatureDesignation: form.signatureDesignation || null,
      signatureMobile: form.signatureMobile || null,
      signatureEmail: form.signatureEmail || null,
      items: items.map((it) => ({
        productId: it.productId ? Number(it.productId) : null,
        productName: it.productName,
        unitName: it.unitName || null,
        qtyBreakup: it.qtyBreakup || null,
        qty: Number(it.qty) || 0,
        unitPrice: Number(it.unitPrice) || 0,
        discountPercent: Number(it.discountPercent) || 0,
        gstRate: Number(it.gstRate) || 0,
      })),
    };
    try {
      let entityId = initial.id;
      if (mode === "edit" && initial.id) {
        await api(`/api/quotations/${initial.id}`, { method: "PUT", json: payload });
        toast.success("Quotation updated");
        entityId = initial.id;
      } else {
        const created = await api<{ id: number }>("/api/quotations", { method: "POST", json: payload });
        toast.success("Quotation created");
        entityId = created.id;
      }
      if (entityId && pendingAttachments.length) {
        await uploadEntityAttachments("quotations", entityId, pendingAttachments);
        setPendingAttachments([]);
        toast.success(`${pendingAttachments.length} attachment${pendingAttachments.length > 1 ? "s" : ""} uploaded`);
      }
      if (redirect && entityId) {
        router.push(`/quotations/${entityId}`);
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
        const firstSection = Object.keys(flatField)[0]
          ? fieldSection(Object.keys(flatField)[0]!)
          : Object.keys(itemErrs).length
            ? "items"
            : "basic";
        setTimeout(() => scrollToSection(firstSection), 0);
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
        description="Prepare quotation basics, schedule, and commercial terms in LAN format."
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

      <div className="flex flex-wrap gap-2 rounded-md border bg-muted/30 p-2">
        {sectionMeta.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => scrollToSection(key)}
            className="rounded bg-background px-3 py-1.5 text-sm font-medium shadow-sm transition-colors hover:bg-accent"
          >
            {label}
          </button>
        ))}
      </div>

      {validationSummary.length ? (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-base text-destructive">Validation summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {validationSummary.map((entry) => (
              <button
                key={entry.key}
                type="button"
                onClick={() => scrollToSection(entry.section)}
                className="block text-left text-sm text-destructive underline-offset-2 hover:underline"
              >
                {entry.message}
              </button>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <section id="quotation-section-basic" className="scroll-mt-24">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Basic information</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Ref number" error={errors.referenceNo}>
            <Input
              value={form.referenceNo}
              onChange={(e) => setForm((f) => ({ ...f, referenceNo: e.target.value }))}
              placeholder="Auto if left blank"
            />
          </Field>
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
          <Field label="Subject" className="lg:col-span-2" error={errors.subject}>
            <Input
              value={form.subject}
              onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
              placeholder="Quotation for [Project / Supply Scope]"
            />
          </Field>
          <Field label="Project name" className="lg:col-span-2" error={errors.projectName}>
            <Input
              value={form.projectName}
              onChange={(e) => setForm((f) => ({ ...f, projectName: e.target.value }))}
              placeholder="Project / package / section"
            />
          </Field>
          <Field label="Kind attention" className="lg:col-span-2" error={errors.customerAttention}>
            <Input
              value={form.customerAttention}
              onChange={(e) => setForm((f) => ({ ...f, customerAttention: e.target.value }))}
              placeholder="Person name"
            />
          </Field>
          <Field label="Intro paragraph" className="lg:col-span-4">
            <Textarea
              rows={3}
              value={form.introText}
              onChange={(e) => setForm((f) => ({ ...f, introText: e.target.value }))}
            />
          </Field>
        </CardContent>
      </Card>
      </section>

      <section id="quotation-section-items" className="scroll-mt-24 space-y-6">
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
                <div className="lg:col-span-3">
                  <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Qty breakup</Label>
                  <Input
                    value={it.qtyBreakup}
                    onChange={(e) => updateItem(idx, "qtyBreakup", e.target.value)}
                    placeholder='Govindpur:10; Hazaribagh:5'
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
      </section>

      <section id="quotation-section-commercial" className="scroll-mt-24">
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
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-2"
              onClick={() => setForm((f) => ({ ...f, termsConditions: DEFAULT_COMMERCIAL_TERMS }))}
            >
              Load default LAN clauses
            </Button>
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
      </section>

      <section id="quotation-section-attachments" className="scroll-mt-24">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Attachments</CardTitle>
          </CardHeader>
          <CardContent>
            <AttachmentsPanel
              entityType="quotations"
              entityId={initial.id}
              pendingFiles={pendingAttachments}
              onPendingFilesChange={setPendingAttachments}
              emptyMessage="Add multiple files here. For a new quotation they will upload right after the first successful save."
            />
          </CardContent>
        </Card>
      </section>

      <section id="quotation-section-signature" className="scroll-mt-24">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Signature &amp; send</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-2">
            <Field label="Signature mode" className="lg:col-span-2">
              <Select
                value={form.signatureMode}
                onChange={(e) =>
                  setForm((f) => ({ ...f, signatureMode: e.target.value as SignatureMode }))
                }
              >
                <option value="upload">Mode A - Uploaded image</option>
                <option value="draw">Mode B - Draw signature</option>
                <option value="typed">Mode C - Typed signature</option>
              </Select>
            </Field>

            {form.signatureMode === "upload" ? (
              <Field label="Upload signature image" className="lg:col-span-2">
                <Input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () => {
                      const dataUrl = typeof reader.result === "string" ? reader.result : "";
                      setForm((f) => ({ ...f, signatureData: dataUrl }));
                    };
                    reader.readAsDataURL(file);
                  }}
                />
              </Field>
            ) : null}

            {form.signatureMode === "draw" ? (
              <Field label="Draw signature" className="lg:col-span-2">
                <DrawSignatureCanvas
                  value={form.signatureData}
                  onChange={(data) => setForm((f) => ({ ...f, signatureData: data }))}
                />
              </Field>
            ) : null}

            {form.signatureMode === "typed" ? (
              <>
                <Field label="Typed signature text" className="lg:col-span-2">
                  <Input
                    value={form.signatureData}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, signatureData: e.target.value }))
                    }
                    placeholder="Type signatory name"
                  />
                </Field>
                <div className="lg:col-span-2 rounded-md border bg-muted/20 p-4">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Preview</div>
                  <div className="mt-2 text-3xl" style={{ fontFamily: "cursive" }}>
                    {form.signatureData || "Signature"}
                  </div>
                </div>
              </>
            ) : null}

            {form.signatureMode !== "typed" && form.signatureData ? (
              <div className="lg:col-span-2 rounded-md border bg-muted/20 p-4">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Preview</div>
                <img src={form.signatureData} alt="Signature preview" className="mt-2 max-h-24 object-contain" />
              </div>
            ) : null}

            <Field label="Signatory name">
              <Input
                value={form.signatureName}
                onChange={(e) => setForm((f) => ({ ...f, signatureName: e.target.value }))}
                placeholder="Authorized name"
              />
            </Field>
            <Field label="Designation">
              <Input
                value={form.signatureDesignation}
                onChange={(e) => setForm((f) => ({ ...f, signatureDesignation: e.target.value }))}
                placeholder="GM - Sales & Marketing"
              />
            </Field>
            <Field label="Mobile">
              <Input
                value={form.signatureMobile}
                onChange={(e) => setForm((f) => ({ ...f, signatureMobile: e.target.value }))}
                placeholder="+91 ..."
              />
            </Field>
            <Field label="Email">
              <Input
                type="email"
                value={form.signatureEmail}
                onChange={(e) => setForm((f) => ({ ...f, signatureEmail: e.target.value }))}
                placeholder="signatory@company.com"
              />
            </Field>
          </CardContent>
        </Card>
      </section>

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

function DrawSignatureCanvas({
  value,
  onChange,
}: {
  value: string;
  onChange: (dataUrl: string) => void;
}) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const drawingRef = React.useRef(false);

  React.useEffect(() => {
    if (!value || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height);
      ctx.drawImage(img, 0, 0, canvasRef.current!.width, canvasRef.current!.height);
    };
    img.src = value;
  }, [value]);

  function pointerPos(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { x, y } = pointerPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 2;
    drawingRef.current = true;
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { x, y } = pointerPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function onPointerUp() {
    drawingRef.current = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    onChange(canvas.toDataURL("image/png"));
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    onChange("");
  }

  return (
    <div className="space-y-2">
      <canvas
        ref={canvasRef}
        width={640}
        height={180}
        className="w-full rounded-md border bg-white"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      />
      <Button type="button" size="sm" variant="outline" onClick={clearCanvas}>
        Clear signature
      </Button>
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
    referenceNo: string | null;
    quotationDate: string;
    subject: string | null;
    projectName: string | null;
    customerAttention: string | null;
    introText: string | null;
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
    signatureMode: SignatureMode | null;
    signatureData: string | null;
    signatureName: string | null;
    signatureDesignation: string | null;
    signatureMobile: string | null;
    signatureEmail: string | null;
    items: {
      productId: number | null;
      productName: string;
      unitName: string | null;
      qtyBreakup: string | null;
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
    referenceNo: data.referenceNo ?? "",
    quotationDate: (data.quotationDate ?? today()).slice(0, 10),
    subject: data.subject ?? DEFAULT_SUBJECT,
    projectName: data.projectName ?? "",
    customerAttention: data.customerAttention ?? "",
    introText: data.introText ?? DEFAULT_INTRO_PARAGRAPH,
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
    signatureMode: data.signatureMode ?? "typed",
    signatureData: data.signatureData ?? "",
    signatureName: data.signatureName ?? "",
    signatureDesignation: data.signatureDesignation ?? "",
    signatureMobile: data.signatureMobile ?? "",
    signatureEmail: data.signatureEmail ?? "",
    items: (data.items.length > 0 ? data.items : []).map((it) => ({
      productId: it.productId ? String(it.productId) : "",
      productName: it.productName,
      unitName: it.unitName ?? "",
      qtyBreakup: it.qtyBreakup ?? "",
      qty: it.qty ?? "1",
      unitPrice: it.unitPrice ?? "0",
      discountPercent: it.discountPercent ?? "0",
      gstRate: it.gstRate ?? "18",
    })),
  };
  if (initial.items.length === 0) initial.items = blankInitial.items;
  return <QuotationBuilder mode="edit" initial={initial} />;
}
