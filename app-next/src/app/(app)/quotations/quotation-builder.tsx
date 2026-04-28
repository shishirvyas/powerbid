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
import { Typeahead, type TypeaheadOption } from "@/components/typeahead";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RichTextEditor } from "@/components/rich-text-editor";
import { useList, useResource } from "@/lib/hooks";
import { api, ApiClientError } from "@/lib/api-client";
import { calcQuotation, formatCurrency } from "@/lib/calc";
import { SIGNATURE_PRESETS } from "@/lib/branding";
import { cn } from "@/lib/utils";
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
  subjectTemplateId: "Subject template",
  projectName: "Project name",
  customerAttention: "Kind attention",
  validityDays: "Validity",
  items: "Line items",
  productName: "Product name",
  unitName: "Unit",
  qty: "Qty",
  unitPrice: "Unit price",
  gstSlabId: "GST slab",
};

type SectionKey = "basic" | "items" | "commercial" | "attachments" | "signature";
type SignatureMode = "upload" | "draw" | "typed" | "blank";

type CustomerOption = { id: number; code: string; name: string };
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
type SubjectTemplateOption = {
  id: number;
  name: string;
  subjectText: string;
  introParagraph: string | null;
  isDefault: boolean;
  isActive: boolean;
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
  inquiryId: number | null;
  subjectTemplateId: number | null;
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
  productQuery: string;
  productName: string;
  unitName: string;
  qty: string;
  unitPrice: string;
  gstSlabId: string;
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
  inquiryId: null,
  subjectTemplateId: null,
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
      productQuery: "",
      productName: "",
      unitName: "",
      qty: "1",
      unitPrice: "0",
      gstSlabId: "",
      gstRate: "0",
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
  const [customerQuery, setCustomerQuery] = React.useState("");
  const [pendingAttachments, setPendingAttachments] = React.useState<File[]>([]);
  const [saving, setSaving] = React.useState(false);
  const { errors, set: setErrors, setOne } = useFieldErrors();
  const [itemErrors, setItemErrors] = React.useState<Record<number, Record<string, string>>>({});

  const { data: customers } = useList<CustomerOption>("/api/customers", { limit: 200 });
  const { data: products } = useList<ProductOption>("/api/products", { limit: 200 });
  const { data: masters } = useResource<{ gstSlabs: GstSlabOption[] }>("/api/masters");
  const { data: subjectTemplates } = useList<SubjectTemplateOption>("/api/masters/subject-templates", { limit: 200 });

  React.useEffect(() => {
    if (!customers?.rows || !form.customerId) return;
    const picked = customers.rows.find((c) => c.id === form.customerId);
    if (picked) setCustomerQuery(`${picked.code} - ${picked.name}`);
  }, [customers, form.customerId]);

  React.useEffect(() => {
    if (!subjectTemplates?.rows || form.subjectTemplateId || mode !== "create") return;
    const def = subjectTemplates.rows.find((t) => t.isDefault && t.isActive);
    if (!def) return;
    setForm((f) => ({
      ...f,
      subjectTemplateId: def.id,
      subject: def.subjectText || f.subject,
      introText: def.introParagraph || f.introText,
    }));
  }, [subjectTemplates, form.subjectTemplateId, mode]);

  const calc = React.useMemo(() => {
    return calcQuotation({
      items: form.items.map((it) => ({
        productId: Number(it.productId || 0),
        productName: it.productName || "—",
        unitName: it.unitName || null,
        qty: Number(it.qty) || 0,
        unitPrice: Number(it.unitPrice) || 0,
        gstRate: Number(it.gstRate) || 0,
        gstSlabId: it.gstSlabId ? Number(it.gstSlabId) : null,
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

  function selectCustomer(option: TypeaheadOption) {
    const id = Number(option.value);
    setForm((f) => ({ ...f, customerId: id }));
    setCustomerQuery(option.label);
    if (errors.customerId) setOne("customerId", undefined);
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

  function onSelectTemplate(templateId: string) {
    const id = templateId ? Number(templateId) : null;
    if (!id || !subjectTemplates?.rows) {
      setForm((f) => ({ ...f, subjectTemplateId: null }));
      return;
    }
    const selected = subjectTemplates.rows.find((t) => t.id === id);
    if (!selected) return;
    setForm((f) => ({
      ...f,
      subjectTemplateId: id,
      subject: selected.subjectText || f.subject,
      introText: selected.introParagraph || f.introText,
    }));
  }

  function addItem() {
    setForm((f) => ({
      ...f,
      items: [
        ...f.items,
        {
          productId: "",
          productQuery: "",
          productName: "",
          unitName: "",
          qty: "1",
          unitPrice: "0",
          gstSlabId: "",
          gstRate: "0",
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
      if (isUsed && !it.productId) row.productName = "Select product";
      const qty = Number(it.qty);
      if (isUsed && (Number.isNaN(qty) || qty <= 0 || !Number.isInteger(qty))) row.qty = "Whole number > 0";
      const price = Number(it.unitPrice);
      if (isUsed && (Number.isNaN(price) || price < 0)) row.unitPrice = "≥ 0";
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
    const items = form.items.filter((it) => it.productId);
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
      inquiryId: form.inquiryId,
      subjectTemplateId: form.subjectTemplateId,
      status: "draft" as const,
      currency: "INR",
      discountType: "percent" as const,
      discountValue: 0,
      freightAmount: 0,
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
        productId: Number(it.productId),
        productName: it.productName,
        unitName: it.unitName || null,
        qty: Number(it.qty) || 0,
        unitPrice: Number(it.unitPrice) || 0,
        gstSlabId: it.gstSlabId ? Number(it.gstSlabId) : null,
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
            <Typeahead
              value={form.customerId ? String(form.customerId) : ""}
              inputValue={customerQuery}
              onInputValueChange={(value) => {
                setCustomerQuery(value);
                setForm((f) => ({ ...f, customerId: null }));
              }}
              onSelect={selectCustomer}
              options={(customers?.rows ?? []).map((c) => ({
                value: String(c.id),
                label: `${c.code} - ${c.name}`,
                secondary: c.code,
              }))}
              placeholder="Type customer name/code, arrow keys, Enter"
            />
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
          <Field label="Subject template" error={errors.subjectTemplateId}>
            <Select
              value={form.subjectTemplateId ? String(form.subjectTemplateId) : ""}
              onChange={(e) => onSelectTemplate(e.target.value)}
            >
              <option value="">— Select template —</option>
              {subjectTemplates?.rows.filter((t) => t.isActive).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}{t.isDefault ? " (Default)" : ""}
                </option>
              ))}
            </Select>
            <p className="text-xs text-muted-foreground">Default template is auto-applied, you can change it here.</p>
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
            <RichTextEditor
              value={form.introText}
              onChange={(html) => setForm((f) => ({ ...f, introText: html }))}
              placeholder="Cover-letter introduction shown on the first page…"
              minHeight={120}
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
                <div className="lg:col-span-4">
                  <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Product</Label>
                  <Typeahead
                    value={it.productId}
                    inputValue={it.productQuery}
                    onInputValueChange={(value) => updateItem(idx, "productQuery", value)}
                    onSelect={(option) => selectProduct(idx, option)}
                    options={(products?.rows ?? []).map((p) => ({
                      value: String(p.id),
                      label: `${p.sku ?? "NO-SKU"} - ${p.name}`,
                      secondary: p.unitCode || p.unitName || "",
                    }))}
                    placeholder="Type product, arrow keys, Enter"
                  />
                </div>
                <div className="lg:col-span-2">
                  <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Unit</Label>
                  <Input value={it.unitName} readOnly placeholder="Unit" />
                </div>
                <div className="lg:col-span-1">
                  <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Qty</Label>
                  <Input
                    type="number"
                    min="1"
                    step="1"
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
                <div className="lg:col-span-2">
                  <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">GST slab</Label>
                  <Select
                    value={it.gstSlabId}
                    onChange={(e) => {
                      const slabId = e.target.value;
                      const slab = masters?.gstSlabs.find((g) => String(g.id) === slabId);
                      setForm((f) => {
                        const items = [...f.items];
                        const nextRate = slab ? String(parseFloat(String(slab.rate))) : "0";
                        items[idx] = { ...items[idx], gstSlabId: slabId, gstRate: nextRate };
                        return { ...f, items };
                      });
                    }}
                  >
                    <option value="">— Select GST slab —</option>
                    {(masters?.gstSlabs ?? []).filter((g) => g.isActive).map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name} ({g.rate}%)
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="lg:col-span-1 flex items-end justify-between gap-2">
                  <div className="text-right text-sm tabular-nums">
                    <div className="text-[10px] uppercase text-muted-foreground">Total</div>
                    <div>{formatCurrency(line?.lineTotal ?? 0, "INR")}</div>
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

      <div className="grid gap-6 lg:grid-cols-1">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Totals</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2 text-sm">
              <Row label="Subtotal" value={formatCurrency(calc.subtotal, "INR")} />
              <Row label="Taxable" value={formatCurrency(calc.taxableAmount, "INR")} />
              <Row label="GST" value={formatCurrency(calc.gstAmount, "INR")} />
              <div className="my-2 h-px bg-border" />
              <Row
                label="Grand total"
                value={formatCurrency(calc.grandTotal, "INR")}
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
            <RichTextEditor
              value={form.paymentTerms}
              onChange={(html) => setForm((f) => ({ ...f, paymentTerms: html }))}
              placeholder="e.g. 30% advance, balance against PI…"
              minHeight={100}
            />
          </Field>
          <Field label="Delivery schedule">
            <RichTextEditor
              value={form.deliverySchedule}
              onChange={(html) => setForm((f) => ({ ...f, deliverySchedule: html }))}
              placeholder="e.g. 4-6 weeks from receipt of confirmed PO…"
              minHeight={100}
            />
          </Field>
          <Field label="Terms &amp; conditions" className="lg:col-span-2">
            <RichTextEditor
              value={form.termsConditions}
              onChange={(html) => setForm((f) => ({ ...f, termsConditions: html }))}
              placeholder="Commercial terms, scope, validity, warranty…"
              minHeight={180}
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
            <RichTextEditor
              value={form.notes}
              onChange={(html) => setForm((f) => ({ ...f, notes: html }))}
              placeholder="Internal-only notes (not printed on PDF)…"
              minHeight={100}
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
            <Field label="Use saved signatory" className="lg:col-span-2">
              <Select
                value=""
                onChange={(e) => {
                  const preset = SIGNATURE_PRESETS.find((p) => p.id === e.target.value);
                  if (!preset) return;
                  setForm((f) => ({
                    ...f,
                    signatureName: preset.name,
                    signatureDesignation: preset.designation,
                    signatureMobile: preset.mobile,
                    signatureEmail: preset.email,
                  }));
                  // reset selector so picking the same preset twice still applies
                  e.target.value = "";
                }}
              >
                <option value="">— Select to fill name / designation / mobile / email —</option>
                {SIGNATURE_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">
                Manage these presets in <code>app-next/src/lib/branding.ts</code> &rarr; <code>SIGNATURE_PRESETS</code>.
              </p>
            </Field>
            <Field label="Signature mode" className="lg:col-span-2">
              <Select
                value={form.signatureMode}
                onChange={(e) =>
                  setForm((f) => ({ ...f, signatureMode: e.target.value as SignatureMode }))
                }
              >
                <option value="blank">Mode 0 - Blank</option>
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
    inquiryId: number | null;
    subjectTemplateId: number | null;
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
      qty: string;
      unitPrice: string;
      gstSlabId: number | null;
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
    inquiryId: data.inquiryId ?? null,
    subjectTemplateId: data.subjectTemplateId ?? null,
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
      productQuery: it.productName,
      productName: it.productName,
      unitName: it.unitName ?? "",
      qty: it.qty ?? "1",
      unitPrice: it.unitPrice ?? "0",
      gstSlabId: it.gstSlabId ? String(it.gstSlabId) : "",
      gstRate: it.gstRate ?? "18",
    })),
  };
  if (initial.items.length === 0) initial.items = blankInitial.items;
  return <QuotationBuilder mode="edit" initial={initial} />;
}
