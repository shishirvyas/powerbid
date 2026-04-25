"use client";

import * as React from "react";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, EmptyState } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { InquiryStatusBadge, PriorityBadge } from "@/components/status-badges";
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
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useDebounced, useList, useResource } from "@/lib/hooks";
import { api, ApiClientError } from "@/lib/api-client";
import { formatDate } from "@/lib/calc";

type InquiryRow = {
  id: number;
  inquiryNo: string;
  inquiryDate: string;
  customerId: number | null;
  customerName: string | null;
  source: string;
  priority: string;
  status: string;
  requirement: string | null;
};

type InquiryItem = {
  id?: number;
  productId: number | null;
  productName: string;
  qty: string;
  remarks: string | null;
};

type InquiryFull = InquiryRow & {
  expectedClosure: string | null;
  items: InquiryItem[];
};

type CustomerOption = { id: number; code: string; name: string };
type ProductOption = { id: number; sku: string; name: string };

type FormState = {
  customerId: string;
  customerName: string;
  source: "walkin" | "phone" | "email" | "web" | "other";
  priority: "low" | "medium" | "high" | "urgent";
  status: "new" | "in_progress" | "quoted" | "won" | "lost" | "closed";
  requirement: string;
  expectedClosure: string;
  items: { productId: string; productName: string; qty: string; remarks: string }[];
};

const emptyItem = { productId: "", productName: "", qty: "1", remarks: "" };
const emptyForm: FormState = {
  customerId: "",
  customerName: "",
  source: "walkin",
  priority: "medium",
  status: "new",
  requirement: "",
  expectedClosure: "",
  items: [{ ...emptyItem }],
};

export function InquiriesClient() {
  const [search, setSearch] = React.useState("");
  const q = useDebounced(search, 300);
  const { data, loading, error, refresh } = useList<InquiryRow>("/api/inquiries", { q, limit: 100 });

  const { data: customers } = useList<CustomerOption>("/api/customers", { limit: 200 });
  const { data: products } = useList<ProductOption>("/api/products", { limit: 200 });

  const [open, setOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<number | null>(null);
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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Inquiry</TableHead>
              <TableHead className="hidden md:table-cell">Date</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead className="hidden lg:table-cell">Source</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && !data ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                  Loading...
                </TableCell>
              </TableRow>
            ) : (
              data?.rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.inquiryNo}</TableCell>
                  <TableCell className="hidden md:table-cell text-sm">{formatDate(r.inquiryDate)}</TableCell>
                  <TableCell className="font-medium">{r.customerName || "—"}</TableCell>
                  <TableCell className="hidden lg:table-cell text-sm capitalize">{r.source}</TableCell>
                  <TableCell><PriorityBadge priority={r.priority} /></TableCell>
                  <TableCell><InquiryStatusBadge status={r.status} /></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditingId(r.id);
                          setOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setConfirmDel(r)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
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
  const [saving, setSaving] = React.useState(false);
  const { data: full } = useResource<InquiryFull>(open && editingId ? `/api/inquiries/${editingId}` : null);

  React.useEffect(() => {
    if (!open) return;
    if (editingId && full) {
      setForm({
        customerId: full.customerId ? String(full.customerId) : "",
        customerName: full.customerName ?? "",
        source: (full.source as FormState["source"]) ?? "walkin",
        priority: (full.priority as FormState["priority"]) ?? "medium",
        status: (full.status as FormState["status"]) ?? "new",
        requirement: full.requirement ?? "",
        expectedClosure: full.expectedClosure ?? "",
        items:
          full.items.length > 0
            ? full.items.map((it) => ({
                productId: it.productId ? String(it.productId) : "",
                productName: it.productName,
                qty: it.qty ?? "1",
                remarks: it.remarks ?? "",
              }))
            : [{ ...emptyItem }],
      });
    } else if (!editingId) {
      setForm(emptyForm);
    }
  }, [open, editingId, full]);

  function updateItem(idx: number, key: keyof typeof emptyItem, value: string) {
    setForm((f) => {
      const items = [...f.items];
      items[idx] = { ...items[idx], [key]: value };
      // auto-fill product name when product chosen
      if (key === "productId" && value) {
        const p = products.find((x) => String(x.id) === value);
        if (p) items[idx].productName = p.name;
      }
      return { ...f, items };
    });
  }

  function addItem() {
    setForm((f) => ({ ...f, items: [...f.items, { ...emptyItem }] }));
  }
  function removeItem(idx: number) {
    setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.customerId && !form.customerName.trim()) {
      toast.error("Pick a customer or enter a customer name");
      return;
    }
    const items = form.items.filter((it) => it.productName.trim());
    setSaving(true);
    const payload = {
      customerId: form.customerId ? Number(form.customerId) : null,
      customerName: form.customerName || null,
      source: form.source,
      priority: form.priority,
      status: form.status,
      requirement: form.requirement || null,
      expectedClosure: form.expectedClosure || null,
      items: items.map((it) => ({
        productId: it.productId ? Number(it.productId) : null,
        productName: it.productName,
        qty: it.qty || "1",
        remarks: it.remarks || null,
      })),
    };
    try {
      if (editingId) {
        await api(`/api/inquiries/${editingId}`, { method: "PUT", json: payload });
        toast.success("Inquiry updated");
      } else {
        await api("/api/inquiries", { method: "POST", json: payload });
        toast.success("Inquiry created");
      }
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{editingId ? "Edit inquiry" : "New inquiry"}</DialogTitle>
          <DialogDescription>Capture customer ask. Items are optional.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Customer">
              <Select
                value={form.customerId}
                onChange={(e) => setForm((f) => ({ ...f, customerId: e.target.value }))}
              >
                <option value="">— Free text below —</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Customer name (if not in list)">
              <Input
                value={form.customerName}
                onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))}
                placeholder="Walk-in / new prospect"
              />
            </Field>
            <Field label="Source">
              <Select
                value={form.source}
                onChange={(e) => setForm((f) => ({ ...f, source: e.target.value as FormState["source"] }))}
              >
                <option value="walkin">Walk-in</option>
                <option value="phone">Phone</option>
                <option value="email">Email</option>
                <option value="web">Web</option>
                <option value="other">Other</option>
              </Select>
            </Field>
            <Field label="Priority">
              <Select
                value={form.priority}
                onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as FormState["priority"] }))}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </Select>
            </Field>
            <Field label="Status">
              <Select
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as FormState["status"] }))}
              >
                <option value="new">New</option>
                <option value="in_progress">In progress</option>
                <option value="quoted">Quoted</option>
                <option value="won">Won</option>
                <option value="lost">Lost</option>
                <option value="closed">Closed</option>
              </Select>
            </Field>
            <Field label="Expected closure">
              <Input
                type="date"
                value={form.expectedClosure}
                onChange={(e) => setForm((f) => ({ ...f, expectedClosure: e.target.value }))}
              />
            </Field>
            <Field label="Requirement / notes" className="sm:col-span-2">
              <Textarea
                value={form.requirement}
                onChange={(e) => setForm((f) => ({ ...f, requirement: e.target.value }))}
                rows={3}
              />
            </Field>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Line items
              </Label>
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus className="h-3.5 w-3.5" /> Add item
              </Button>
            </div>
            <div className="space-y-2">
              {form.items.map((it, idx) => (
                <div key={idx} className="grid gap-2 rounded-md border bg-muted/30 p-3 sm:grid-cols-12">
                  <div className="sm:col-span-4">
                    <Select
                      value={it.productId}
                      onChange={(e) => updateItem(idx, "productId", e.target.value)}
                    >
                      <option value="">— Free text —</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.sku} — {p.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="sm:col-span-4">
                    <Input
                      placeholder="Product name *"
                      value={it.productName}
                      onChange={(e) => updateItem(idx, "productName", e.target.value)}
                    />
                  </div>
                  <div className="sm:col-span-1">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
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
              ))}
            </div>
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
