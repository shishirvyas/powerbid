"use client";

import * as React from "react";
import Link from "next/link";
import { Eye, FileText, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, EmptyState } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { InquiryStatusBadge } from "@/components/status-badges";
import { Typeahead, type TypeaheadOption } from "@/components/typeahead";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AttachmentsPanel, uploadEntityAttachments } from "@/components/attachments-panel";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Pagination } from "@/components/pagination";
import { TableSkeleton } from "@/components/table-skeleton";
import {
  FormField,
  getServerFieldErrors,
  summarizeFieldErrors,
  useFieldErrors,
} from "@/components/form-field";
import { useDebounced, useList, useResource } from "@/lib/hooks";
import { api, ApiClientError } from "@/lib/api-client";
import { formatDate } from "@/lib/calc";
import { cn } from "@/lib/utils";

type InquiryRow = {
  id: number;
  inquiryNo: string;
  dateOfInquiry: string | null;
  referenceNumber: string | null;
  createdAt: string;
  customerId: number | null;
  customerName: string | null;
  source: string;
  status: string;
  requirement: string | null;
};

type InquiryItem = {
  id?: number;
  productId: number;
  productName: string;
  unitName: string | null;
  qty: string;
  remarks: string | null;
};

type InquiryFull = InquiryRow & {
  expectedClosure: string | null;
  items: InquiryItem[];
};

type CustomerOption = { id: number; code: string; name: string };
type ProductOption = { id: number; sku: string | null; name: string; unitCode: string | null; unitName: string | null };

type FormState = {
  customerId: string;
  customerName: string;
  customerQuery: string;
  source: "walkin" | "phone" | "email" | "web" | "other";
  status: "new" | "in_progress" | "quoted" | "won" | "lost" | "closed";
  dateOfInquiry: string;
  referenceNumber: string;
  requirement: string;
  expectedClosure: string;
  items: { productId: string; productName: string; productQuery: string; unitName: string; qty: string; remarks: string }[];
};

const emptyItem = { productId: "", productName: "", productQuery: "", unitName: "", qty: "1", remarks: "" };
const emptyForm: FormState = {
  customerId: "",
  customerName: "",
  customerQuery: "",
  source: "walkin",
  status: "new",
  dateOfInquiry: new Date().toISOString().slice(0, 10),
  referenceNumber: "",
  requirement: "",
  expectedClosure: "",
  items: [{ ...emptyItem }],
};

const labelMap: Record<string, string> = {
  customerId: "Customer",
  source: "Source",
  status: "Status",
  dateOfInquiry: "Date of inquiry",
  referenceNumber: "Reference number",
  requirement: "Requirement",
  expectedClosure: "Expected closure",
  items: "Line items",
};

export function InquiriesClient() {
  const [search, setSearch] = React.useState("");
  const q = useDebounced(search, 300);
  const [limit, setLimit] = React.useState(25);
  const [offset, setOffset] = React.useState(0);
  React.useEffect(() => {
    setOffset(0);
  }, [q, limit]);

  const { data, loading, error, refresh } = useList<InquiryRow>("/api/inquiries", { q, limit, offset });
  const { data: customers } = useList<CustomerOption>("/api/customers", { limit: 200 });
  const { data: products } = useList<ProductOption>("/api/products", { limit: 200 });

  const [open, setOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [viewingId, setViewingId] = React.useState<number | null>(null);
  const [confirmDel, setConfirmDel] = React.useState<InquiryRow | null>(null);

  return (
    <div className="space-y-6 animate-in fade-in-50">
      <PageHeader
        title="Inquiries"
        description="Capture customer requirements before quoting."
        actions={
          <Button
            onClick={() => {
              setEditingId(null);
              setOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> New inquiry
          </Button>
        }
      />

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by inquiry no, customer..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {!loading && data && data.rows.length === 0 ? (
        <EmptyState
          title={q ? "No inquiries match" : "No inquiries yet"}
          action={
            !q ? (
              <Button
                onClick={() => {
                  setEditingId(null);
                  setOpen(true);
                }}
              >
                <Plus className="h-4 w-4" /> New inquiry
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="space-y-3">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Inquiry</TableHead>
                <TableHead className="hidden md:table-cell">Date</TableHead>
                <TableHead className="hidden md:table-cell">Reference</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead className="hidden lg:table-cell">Source</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && !data ? (
                <TableSkeleton cols={7} rows={6} />
              ) : (
                data?.rows.map((r) => (
                  <TableRow key={r.id} className="transition-colors hover:bg-muted/40">
                    <TableCell className="font-mono text-xs">{r.inquiryNo}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm">{formatDate(r.dateOfInquiry || r.createdAt)}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm">{r.referenceNumber || "-"}</TableCell>
                    <TableCell className="font-medium">{r.customerName || "—"}</TableCell>
                    <TableCell className="hidden lg:table-cell text-sm capitalize">{r.source}</TableCell>
                    <TableCell><InquiryStatusBadge status={r.status} /></TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setViewingId(r.id)}
                          aria-label="View"
                          title="View inquiry"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          asChild
                          variant="ghost"
                          size="icon"
                          aria-label="Create quotation"
                          title="Create quotation from inquiry"
                        >
                          <Link href={`/quotations/new?fromInquiry=${r.id}`}>
                            <FileText className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditingId(r.id);
                            setOpen(true);
                          }}
                          aria-label="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setConfirmDel(r)} aria-label="Delete">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {data ? (
            <Pagination
              total={data.total}
              limit={limit}
              offset={offset}
              onPageChange={setOffset}
              onLimitChange={setLimit}
            />
          ) : null}
        </div>
      )}

      <InquiryFormDialog
        open={open}
        onOpenChange={setOpen}
        editingId={editingId}
        customers={customers?.rows ?? []}
        products={products?.rows ?? []}
        onSaved={() => {
          setOpen(false);
          refresh();
        }}
      />

      <InquiryViewDialog
        inquiryId={viewingId}
        onClose={() => setViewingId(null)}
      />

      <ConfirmDialog
        open={!!confirmDel}
        onOpenChange={(v) => !v && setConfirmDel(null)}
        title="Delete inquiry?"
        description={confirmDel ? `${confirmDel.inquiryNo} will be permanently removed.` : undefined}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={async () => {
          if (!confirmDel) return;
          try {
            await api(`/api/inquiries/${confirmDel.id}`, { method: "DELETE" });
            toast.success("Inquiry deleted");
            setConfirmDel(null);
            refresh();
          } catch (e) {
            toast.error(e instanceof ApiClientError ? e.message : "Delete failed");
          }
        }}
      />
    </div>
  );
}

function InquiryFormDialog({
  open,
  onOpenChange,
  editingId,
  customers,
  products,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editingId: number | null;
  customers: CustomerOption[];
  products: ProductOption[];
  onSaved: () => void;
}) {
  const [form, setForm] = React.useState<FormState>(emptyForm);
  const [pendingAttachments, setPendingAttachments] = React.useState<File[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [itemErrors, setItemErrors] = React.useState<Record<number, string>>({});
  const { errors, set: setErrors, reset: resetErrors, setOne } = useFieldErrors();
  const { data: full } = useResource<InquiryFull>(open && editingId ? `/api/inquiries/${editingId}` : null);

  React.useEffect(() => {
    if (!open) return;
    resetErrors();
    setItemErrors({});
    setPendingAttachments([]);
    if (editingId && full) {
      setForm({
        customerId: full.customerId ? String(full.customerId) : "",
        customerName: full.customerName ?? "",
        customerQuery: full.customerName ?? "",
        source: (full.source as FormState["source"]) ?? "walkin",
        status: (full.status as FormState["status"]) ?? "new",
        dateOfInquiry: full.dateOfInquiry ?? new Date().toISOString().slice(0, 10),
        referenceNumber: full.referenceNumber ?? "",
        requirement: full.requirement ?? "",
        expectedClosure: full.expectedClosure ?? "",
        items:
          full.items.length > 0
            ? full.items.map((it) => ({
                productId: String(it.productId),
                productName: it.productName,
                productQuery: it.productName,
                unitName: it.unitName ?? "",
                qty: it.qty ?? "1",
                remarks: it.remarks ?? "",
              }))
            : [{ ...emptyItem }],
      });
    } else if (!editingId) {
      setForm(emptyForm);
    }
  }, [open, editingId, full, resetErrors]);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key as string]) setOne(key as string, undefined);
  }

  function updateItem(idx: number, key: keyof typeof emptyItem, value: string) {
    setForm((f) => {
      const items = [...f.items];
      items[idx] = { ...items[idx], [key]: value };
      return { ...f, items };
    });
    if (itemErrors[idx]) setItemErrors((e) => ({ ...e, [idx]: "" }));
  }

  function selectCustomer(option: TypeaheadOption) {
    const picked = customers.find((c) => String(c.id) === option.value);
    if (!picked) return;
    setForm((f) => ({
      ...f,
      customerId: String(picked.id),
      customerName: picked.name,
      customerQuery: `${picked.code} - ${picked.name}`,
    }));
    if (errors.customerId) setOne("customerId", undefined);
  }

  function selectProduct(idx: number, option: TypeaheadOption) {
    const picked = products.find((p) => String(p.id) === option.value);
    if (!picked) return;
    setForm((f) => {
      const items = [...f.items];
      items[idx] = {
        ...items[idx],
        productId: String(picked.id),
        productName: picked.name,
        productQuery: `${picked.sku ?? "NO-SKU"} - ${picked.name}`,
        unitName: picked.unitCode || picked.unitName || "",
      };
      return { ...f, items };
    });
    if (itemErrors[idx]) setItemErrors((e) => ({ ...e, [idx]: "" }));
  }

  function addItem() {
    setForm((f) => ({ ...f, items: [...f.items, { ...emptyItem }] }));
  }
  function removeItem(idx: number) {
    setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));
  }

  function clientValidate(): { fieldErrors: Record<string, string>; itemErrs: Record<number, string> } {
    const fieldErrors: Record<string, string> = {};
    if (!form.customerId) fieldErrors.customerId = "Select a customer from master";
    if (!form.dateOfInquiry) fieldErrors.dateOfInquiry = "Date of inquiry is required";
    const itemErrs: Record<number, string> = {};
    form.items.forEach((it, idx) => {
      if (!it.productId) itemErrs[idx] = "Select a product from master";
      if (
        it.qty &&
        (Number.isNaN(Number(it.qty)) || Number(it.qty) <= 0 || !Number.isInteger(Number(it.qty)))
      ) {
        itemErrs[idx] = "Enter a whole number quantity";
      }
    });
    return { fieldErrors, itemErrs };
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const { fieldErrors, itemErrs } = clientValidate();
    if (Object.keys(fieldErrors).length || Object.keys(itemErrs).length) {
      setErrors(fieldErrors);
      setItemErrors(itemErrs);
      const allMsgs = [
        ...Object.entries(fieldErrors).map(([k, v]) => (labelMap[k] ?? k) + ": " + v),
        ...Object.entries(itemErrs).map(([i, v]) => `Item ${Number(i) + 1}: ${v}`),
      ];
      toast.error(allMsgs[0] ?? "Please fix errors");
      return;
    }
    const items = form.items.filter((it) => it.productId);
    setSaving(true);
    const payload = {
      customerId: Number(form.customerId),
      customerName: form.customerName || null,
      source: form.source,
      status: form.status,
      dateOfInquiry: form.dateOfInquiry,
      referenceNumber: form.referenceNumber || null,
      requirement: form.requirement || null,
      expectedClosure: form.expectedClosure || null,
      items: items.map((it) => ({
        productId: Number(it.productId),
        productName: it.productName,
        unitName: it.unitName || null,
        qty: it.qty || "1",
        remarks: it.remarks || null,
      })),
    };
    try {
      let entityId = editingId;
      if (editingId) {
        await api(`/api/inquiries/${editingId}`, { method: "PUT", json: payload });
        toast.success("Inquiry updated");
        entityId = editingId;
      } else {
        const created = await api<{ id: number }>("/api/inquiries", { method: "POST", json: payload });
        toast.success("Inquiry created");
        entityId = created.id;
      }
      if (entityId && pendingAttachments.length) {
        await uploadEntityAttachments("inquiries", entityId, pendingAttachments);
        setPendingAttachments([]);
        toast.success(`${pendingAttachments.length} attachment${pendingAttachments.length > 1 ? "s" : ""} uploaded`);
      }
      onSaved();
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingId ? "Edit inquiry" : "New inquiry"}</DialogTitle>
          <DialogDescription>
            Select customer and products from master data. Fields marked <span className="text-destructive">*</span> are required.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Customer" required error={errors.customerId}>
              <Typeahead
                value={form.customerId}
                inputValue={form.customerQuery}
                onInputValueChange={(value) =>
                  setForm((f) => ({ ...f, customerQuery: value, customerId: "", customerName: "" }))
                }
                onSelect={selectCustomer}
                options={customers.map((c) => ({
                  value: String(c.id),
                  label: `${c.code} - ${c.name}`,
                  secondary: c.code,
                }))}
                placeholder="Type customer name/code, then use arrow keys + Enter"
              />
            </FormField>
            <FormField label="Source">
              <Select
                value={form.source}
                onChange={(e) => updateField("source", e.target.value as FormState["source"])}
              >
                <option value="walkin">Walk-in</option>
                <option value="phone">Phone</option>
                <option value="email">Email</option>
                <option value="web">Web</option>
                <option value="other">Other</option>
              </Select>
            </FormField>
            <FormField label="Date of inquiry" required error={errors.dateOfInquiry}>
              <Input
                type="date"
                value={form.dateOfInquiry}
                onChange={(e) => updateField("dateOfInquiry", e.target.value)}
              />
            </FormField>
            <FormField label="Status">
              <Select
                value={form.status}
                onChange={(e) => updateField("status", e.target.value as FormState["status"])}
              >
                <option value="new">New</option>
                <option value="in_progress">In progress</option>
                <option value="quoted">Quoted</option>
                <option value="won">Won</option>
                <option value="lost">Lost</option>
                <option value="closed">Closed</option>
              </Select>
            </FormField>
            <FormField label="Reference number" error={errors.referenceNumber}>
              <Input
                value={form.referenceNumber}
                onChange={(e) => updateField("referenceNumber", e.target.value)}
                placeholder="Customer reference no"
              />
            </FormField>
            <FormField label="Expected closure" error={errors.expectedClosure}>
              <Input
                type="date"
                value={form.expectedClosure}
                onChange={(e) => updateField("expectedClosure", e.target.value)}
              />
            </FormField>
            <FormField label="Requirement / notes" className="sm:col-span-2" error={errors.requirement}>
              <Textarea
                value={form.requirement}
                onChange={(e) => updateField("requirement", e.target.value)}
                rows={3}
              />
            </FormField>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Line items</span>
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus className="h-3.5 w-3.5" /> Add item
              </Button>
            </div>
            <div className="space-y-2">
              {form.items.map((it, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "rounded-md border bg-muted/30 p-3",
                    itemErrors[idx] ? "border-destructive/60" : "",
                  )}
                >
                  <div className="grid gap-2 sm:grid-cols-12">
                    <div className="sm:col-span-5">
                      <Typeahead
                        value={it.productId}
                        inputValue={it.productQuery}
                        onInputValueChange={(value) => updateItem(idx, "productQuery", value)}
                        onSelect={(option) => selectProduct(idx, option)}
                        options={products.map((p) => ({
                          value: String(p.id),
                          label: `${p.sku ?? "NO-SKU"} - ${p.name}`,
                          secondary: p.unitCode || p.unitName || "",
                        }))}
                        placeholder="Type product, arrow keys, Enter"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <Input value={it.unitName} readOnly placeholder="Unit" />
                    </div>
                    <div className="sm:col-span-2">
                      <Input
                        type="number"
                        min="1"
                        step="1"
                        value={it.qty}
                        onChange={(e) => updateItem(idx, "qty", e.target.value)}
                        placeholder="Qty"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <Input
                        placeholder="Remarks"
                        value={it.remarks}
                        onChange={(e) => updateItem(idx, "remarks", e.target.value)}
                      />
                    </div>
                    <div className="sm:col-span-1 flex items-center justify-end">
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
                  {itemErrors[idx] ? (
                    <p className="mt-1 text-xs font-medium text-destructive">{itemErrors[idx]}</p>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Attachments</div>
            <AttachmentsPanel
              entityType="inquiries"
              entityId={editingId ?? undefined}
              pendingFiles={pendingAttachments}
              onPendingFilesChange={setPendingAttachments}
              emptyMessage="Add multiple inquiry files here. They will upload after the first successful save."
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : editingId ? "Save changes" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function InquiryViewDialog({
  inquiryId,
  onClose,
}: {
  inquiryId: number | null;
  onClose: () => void;
}) {
  const open = inquiryId !== null;
  const { data, loading, error } = useResource<InquiryFull>(open && inquiryId ? `/api/inquiries/${inquiryId}` : null);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{data?.inquiryNo ?? "Inquiry details"}</DialogTitle>
          <DialogDescription>
            {data ? `Captured ${formatDate(data.dateOfInquiry || data.createdAt)}` : "Loading inquiry…"}
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        {loading || !data ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : (
          <div className="space-y-4 text-sm">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Customer</div>
                <div className="font-medium">{data.customerName || "—"}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Expected closure</div>
                <div>{data.expectedClosure ? formatDate(data.expectedClosure) : "—"}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Source</div>
                <div className="capitalize">{data.source}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Status</div>
                <div className="flex items-center gap-2">
                  <InquiryStatusBadge status={data.status} />
                </div>
              </div>
            </div>

            {data.requirement ? (
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Requirement</div>
                <div className="whitespace-pre-wrap rounded-md border bg-muted/30 px-3 py-2 text-sm">
                  {data.requirement}
                </div>
              </div>
            ) : null}

            <div>
              <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Items ({data.items.length})</div>
              {data.items.length === 0 ? (
                <div className="text-sm text-muted-foreground">No line items.</div>
              ) : (
                <div className="overflow-hidden rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>Unit</TableHead>
                        <TableHead className="w-24 text-right">Qty</TableHead>
                        <TableHead className="hidden sm:table-cell">Remarks</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.items.map((it, idx) => (
                        <TableRow key={it.id ?? idx}>
                          <TableCell className="font-medium">{it.productName}</TableCell>
                          <TableCell>{it.unitName || "-"}</TableCell>
                          <TableCell className="text-right tabular-nums">{it.qty}</TableCell>
                          <TableCell className="hidden sm:table-cell text-muted-foreground">{it.remarks || "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
          {data ? (
            <Button asChild>
              <Link href={`/quotations/new?fromInquiry=${data.id}`} onClick={onClose}>
                <FileText className="h-4 w-4" /> Create quotation
              </Link>
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
