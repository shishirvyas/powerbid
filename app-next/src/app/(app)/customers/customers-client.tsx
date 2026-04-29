"use client";

import * as React from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Check, Loader2, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  FormField,
  getServerFieldErrors,
  summarizeFieldErrors,
  useFieldErrors,
} from "@/components/form-field";
import { EmptyState, PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiClientError } from "@/lib/api-client";
import { useDebounced, useList, useResource } from "@/lib/hooks";

type Customer = {
  id: number;
  code: string;
  name: string;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  gstin: string | null;
  pan: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  country: string;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
};

type DetailTab = "profile" | "address" | "notes";

type QuickEditDraft = {
  name: string;
  contactPerson: string;
  phone: string;
  city: string;
  isActive: boolean;
};

const empty: Partial<Customer> = {
  code: "",
  name: "",
  contactPerson: "",
  email: "",
  phone: "",
  gstin: "",
  pan: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  pincode: "",
  country: "IN",
  notes: "",
  isActive: true,
};

const labelMap: Record<string, string> = {
  code: "Code",
  name: "Name",
  email: "Email",
  contactPerson: "Contact person",
  phone: "Phone",
  gstin: "GSTIN",
  pan: "PAN",
  addressLine1: "Address line 1",
  addressLine2: "Address line 2",
  city: "City",
  state: "State",
  pincode: "Pincode",
  country: "Country",
  notes: "Notes",
};

function toQuickDraft(c: Customer): QuickEditDraft {
  return {
    name: c.name,
    contactPerson: c.contactPerson ?? "",
    phone: c.phone ?? "",
    city: c.city ?? "",
    isActive: c.isActive,
  };
}

function customerPayload(c: Customer, quick: QuickEditDraft): Partial<Customer> {
  return {
    code: c.code,
    name: quick.name,
    contactPerson: quick.contactPerson || null,
    email: c.email || null,
    phone: quick.phone || null,
    gstin: c.gstin || null,
    pan: c.pan || null,
    addressLine1: c.addressLine1 || null,
    addressLine2: c.addressLine2 || null,
    city: quick.city || null,
    state: c.state || null,
    pincode: c.pincode || null,
    country: c.country || "IN",
    notes: c.notes || null,
    isActive: quick.isActive,
  };
}

export function CustomersClient() {
  const [search, setSearch] = React.useState("");
  const q = useDebounced(search, 220);
  const [limit, setLimit] = React.useState(100);
  const [offset, setOffset] = React.useState(0);

  React.useEffect(() => {
    setOffset(0);
  }, [q, limit]);

  const { data, loading, error, refresh, mutate } = useList<Customer>("/api/customers", {
    q,
    limit,
    offset,
  });

  const rows = data?.rows ?? [];
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Customer | null>(null);
  const [confirmDel, setConfirmDel] = React.useState<Customer | null>(null);
  const [selectedId, setSelectedId] = React.useState<number | null>(null);
  const [detailTab, setDetailTab] = React.useState<DetailTab>("profile");
  const [quickEditId, setQuickEditId] = React.useState<number | null>(null);
  const [quickDraft, setQuickDraft] = React.useState<QuickEditDraft | null>(null);
  const [quickSaving, setQuickSaving] = React.useState(false);

  const selectedRow = React.useMemo(
    () => rows.find((row) => row.id === selectedId) ?? null,
    [rows, selectedId],
  );

  const {
    data: selectedDetail,
    loading: detailLoading,
    error: detailError,
    refresh: refreshDetail,
  } = useResource<Customer>(selectedId ? `/api/customers/${selectedId}` : null);

  React.useEffect(() => {
    if (!rows.length) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !rows.some((r) => r.id === selectedId)) {
      setSelectedId(rows[0]?.id ?? null);
    }
  }, [rows, selectedId]);

  const detail = selectedDetail ?? selectedRow;

  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 46,
    overscan: 10,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();

  const openCreate = React.useCallback(() => {
    setEditing(null);
    setDialogOpen(true);
  }, []);

  const openEdit = React.useCallback((c: Customer) => {
    setSelectedId(c.id);
    setEditing(c);
    setDialogOpen(true);
  }, []);

  const startQuickEdit = React.useCallback((c: Customer) => {
    setQuickEditId(c.id);
    setQuickDraft(toQuickDraft(c));
  }, []);

  const cancelQuickEdit = React.useCallback(() => {
    setQuickEditId(null);
    setQuickDraft(null);
  }, []);

  const saveQuickEdit = React.useCallback(
    async (c: Customer) => {
      if (!quickDraft) return;
      const trimmedName = quickDraft.name.trim();
      if (!trimmedName) {
        toast.error("Name is required");
        return;
      }

      const prev = data ?? null;
      const optimistic: Customer = {
        ...c,
        name: trimmedName,
        contactPerson: quickDraft.contactPerson || null,
        phone: quickDraft.phone || null,
        city: quickDraft.city || null,
        isActive: quickDraft.isActive,
      };

      mutate((curr) =>
        curr
          ? {
              ...curr,
              rows: curr.rows.map((r) => (r.id === c.id ? optimistic : r)),
            }
          : curr,
      );

      setQuickSaving(true);
      try {
        await api(`/api/customers/${c.id}`, {
          method: "PUT",
          json: customerPayload(c, { ...quickDraft, name: trimmedName }),
        });
        toast.success("Customer updated");
        cancelQuickEdit();
        refreshDetail();
      } catch (err) {
        mutate(() => prev);
        toast.error(err instanceof ApiClientError ? err.message : "Quick update failed");
      } finally {
        setQuickSaving(false);
      }
    },
    [cancelQuickEdit, data, mutate, quickDraft, refreshDetail],
  );

  const deleteCustomer = React.useCallback(async () => {
    if (!confirmDel) return;
    const prev = data ?? null;
    const deletingId = confirmDel.id;

    mutate((curr) => {
      if (!curr) return curr;
      const nextRows = curr.rows.filter((r) => r.id !== deletingId);
      return {
        ...curr,
        rows: nextRows,
        total: Math.max(0, curr.total - 1),
      };
    });

    if (selectedId === deletingId) {
      setSelectedId(rows.find((r) => r.id !== deletingId)?.id ?? null);
    }

    try {
      await api(`/api/customers/${deletingId}`, { method: "DELETE" });
      toast.success("Customer deleted");
      setConfirmDel(null);
    } catch (e) {
      mutate(() => prev);
      toast.error(e instanceof ApiClientError ? e.message : "Delete failed");
    }
  }, [confirmDel, data, mutate, rows, selectedId]);

  return (
    <div className="space-y-6 animate-in fade-in-50">
      <PageHeader
        title="Customers"
        description="Companies and contacts you quote to."
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> New customer
          </Button>
        }
      />

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name, code, email..."
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

      {!loading && data && rows.length === 0 ? (
        <EmptyState
          title={q ? "No customers match your search" : "No customers yet"}
          description={q ? undefined : "Create your first customer to get started."}
          action={!q ? <Button onClick={openCreate}>New customer</Button> : null}
        />
      ) : (
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1.35fr)_minmax(22rem,0.9fr)]">
          <div className="space-y-3">
            <div className="rounded-md border">
              <div className="grid h-9 grid-cols-[7rem_minmax(12rem,1fr)_minmax(10rem,0.9fr)_minmax(9rem,0.8fr)_minmax(8rem,0.8fr)_7rem_8rem] items-center gap-2 border-b bg-muted/30 px-2 text-xs font-medium text-muted-foreground">
                <div>Code</div>
                <div>Name</div>
                <div>Contact</div>
                <div>Phone</div>
                <div>City</div>
                <div>Status</div>
                <div className="text-right">Actions</div>
              </div>

              <div ref={scrollRef} className="h-[56vh] overflow-auto">
                {loading && !data ? (
                  <div className="p-4 text-sm text-muted-foreground">Loading customers...</div>
                ) : (
                  <div className="relative" style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>
                    {virtualRows.map((v) => {
                      const c = rows[v.index];
                      if (!c) return null;
                      return (
                        <CustomerVirtualRow
                          key={c.id}
                          customer={c}
                          top={v.start}
                          selected={c.id === selectedId}
                          quickEditing={c.id === quickEditId}
                          quickDraft={quickDraft}
                          quickSaving={quickSaving}
                          onSelect={() => {
                            setSelectedId(c.id);
                            setDetailTab("profile");
                          }}
                          onStartQuickEdit={() => startQuickEdit(c)}
                          onOpenEdit={() => openEdit(c)}
                          onDelete={() => setConfirmDel(c)}
                          onCancelQuickEdit={cancelQuickEdit}
                          onSaveQuickEdit={() => saveQuickEdit(c)}
                          onQuickDraftChange={(next) =>
                            setQuickDraft((prev) => (prev ? { ...prev, ...next } : prev))
                          }
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

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

          <CustomerDetailPanel
            detail={detail}
            detailError={detailError}
            detailLoading={detailLoading}
            detailTab={detailTab}
            selectedId={selectedId}
            onEdit={openEdit}
            onTabChange={setDetailTab}
          />
        </div>
      )}

      <CustomerFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        onSaved={() => {
          setDialogOpen(false);
          refresh();
        }}
      />

      <ConfirmDialog
        open={!!confirmDel}
        onOpenChange={(v) => !v && setConfirmDel(null)}
        title="Delete customer?"
        description={confirmDel ? `"${confirmDel.name}" will be permanently removed.` : undefined}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={deleteCustomer}
      />
    </div>
  );
}

type CustomerVirtualRowProps = {
  customer: Customer;
  top: number;
  selected: boolean;
  quickEditing: boolean;
  quickDraft: QuickEditDraft | null;
  quickSaving: boolean;
  onSelect: () => void;
  onStartQuickEdit: () => void;
  onOpenEdit: () => void;
  onDelete: () => void;
  onCancelQuickEdit: () => void;
  onSaveQuickEdit: () => void;
  onQuickDraftChange: (next: Partial<QuickEditDraft>) => void;
};

const CustomerVirtualRow = React.memo(function CustomerVirtualRow({
  customer,
  top,
  selected,
  quickEditing,
  quickDraft,
  quickSaving,
  onSelect,
  onStartQuickEdit,
  onOpenEdit,
  onDelete,
  onCancelQuickEdit,
  onSaveQuickEdit,
  onQuickDraftChange,
}: CustomerVirtualRowProps) {
  return (
    <div
      className={[
        "group absolute left-0 right-0 grid h-[46px] cursor-pointer grid-cols-[7rem_minmax(12rem,1fr)_minmax(10rem,0.9fr)_minmax(9rem,0.8fr)_minmax(8rem,0.8fr)_7rem_8rem] items-center gap-2 border-b px-2 text-sm",
        selected ? "bg-primary/5" : "hover:bg-muted/40",
      ].join(" ")}
      style={{ transform: `translateY(${top}px)` }}
      onClick={onSelect}
    >
      <div className="truncate font-mono text-xs">{customer.code}</div>
      <div className="truncate font-medium">
        {quickEditing ? (
          <Input
            value={quickDraft?.name ?? ""}
            onChange={(e) => onQuickDraftChange({ name: e.target.value })}
            onClick={(e) => e.stopPropagation()}
            className="h-8"
          />
        ) : (
          customer.name
        )}
      </div>
      <div className="truncate">
        {quickEditing ? (
          <Input
            value={quickDraft?.contactPerson ?? ""}
            onChange={(e) => onQuickDraftChange({ contactPerson: e.target.value })}
            onClick={(e) => e.stopPropagation()}
            className="h-8"
          />
        ) : (
          customer.contactPerson || "-"
        )}
      </div>
      <div className="truncate">
        {quickEditing ? (
          <Input
            value={quickDraft?.phone ?? ""}
            onChange={(e) => onQuickDraftChange({ phone: e.target.value })}
            onClick={(e) => e.stopPropagation()}
            className="h-8"
          />
        ) : (
          customer.phone || "-"
        )}
      </div>
      <div className="truncate">
        {quickEditing ? (
          <Input
            value={quickDraft?.city ?? ""}
            onChange={(e) => onQuickDraftChange({ city: e.target.value })}
            onClick={(e) => e.stopPropagation()}
            className="h-8"
          />
        ) : (
          customer.city || "-"
        )}
      </div>
      <div>
        {quickEditing ? (
          <Select
            value={quickDraft?.isActive ? "1" : "0"}
            onChange={(e) => onQuickDraftChange({ isActive: e.target.value === "1" })}
            onClick={(e) => e.stopPropagation()}
            className="h-8"
          >
            <option value="1">Active</option>
            <option value="0">Inactive</option>
          </Select>
        ) : (
          <Badge variant={customer.isActive ? "success" : "muted"}>
            {customer.isActive ? "Active" : "Inactive"}
          </Badge>
        )}
      </div>
      <div className="text-right" onClick={(e) => e.stopPropagation()}>
        <div
          className={[
            "flex justify-end gap-1 transition-opacity",
            quickEditing ? "opacity-100" : "opacity-0 group-hover:opacity-100",
          ].join(" ")}
        >
          {quickEditing ? (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={onSaveQuickEdit}
                disabled={quickSaving}
                aria-label="Save quick edit"
              >
                {quickSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4 text-emerald-600" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={onCancelQuickEdit}
                disabled={quickSaving}
                aria-label="Cancel quick edit"
              >
                <X className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="icon" onClick={onStartQuickEdit} aria-label="Quick edit">
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={onOpenEdit} aria-label="Edit in dialog">
                <Pencil className="h-4 w-4 text-muted-foreground" />
              </Button>
              <Button variant="ghost" size="icon" onClick={onDelete} aria-label="Delete">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
});

type CustomerDetailPanelProps = {
  selectedId: number | null;
  detail: Customer | null;
  detailLoading: boolean;
  detailError: string | null;
  detailTab: DetailTab;
  onTabChange: (tab: DetailTab) => void;
  onEdit: (c: Customer) => void;
};

const CustomerDetailPanel = React.memo(function CustomerDetailPanel({
  selectedId,
  detail,
  detailLoading,
  detailError,
  detailTab,
  onTabChange,
  onEdit,
}: CustomerDetailPanelProps) {
  return (
    <aside className="rounded-lg border bg-card p-3 md:p-4 xl:sticky xl:top-16 xl:h-fit">
      {!selectedId ? (
        <div className="text-sm text-muted-foreground">Select a customer to view details.</div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm text-muted-foreground">Customer details</div>
              <div className="text-lg font-semibold leading-tight">{detail?.name ?? "Loading..."}</div>
              <div className="text-xs text-muted-foreground">{detail?.code ?? ""}</div>
            </div>
            <div className="flex items-center gap-2">
              {detail?.isActive !== undefined ? (
                <Badge variant={detail.isActive ? "success" : "muted"}>
                  {detail.isActive ? "Active" : "Inactive"}
                </Badge>
              ) : null}
              {detail ? (
                <Button size="sm" variant="outline" onClick={() => onEdit(detail)}>
                  <Pencil className="h-4 w-4" /> Edit
                </Button>
              ) : null}
            </div>
          </div>

          <div className="flex rounded-md border bg-muted/30 p-1">
            {([
              ["profile", "Profile"],
              ["address", "Address"],
              ["notes", "Notes"],
            ] as Array<[DetailTab, string]>).map(([key, label]) => (
              <Button
                key={key}
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onTabChange(key)}
                className={["h-8 flex-1 rounded-sm", detailTab === key ? "bg-background shadow-sm" : ""].join(
                  " ",
                )}
              >
                {label}
              </Button>
            ))}
          </div>

          {detailLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading details...
            </div>
          ) : detailError ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {detailError}
            </div>
          ) : detail ? (
            <div className="space-y-2 text-sm">
              {detailTab === "profile" ? (
                <>
                  <DetailRow label="Contact" value={detail.contactPerson || "-"} />
                  <DetailRow label="Email" value={detail.email || "-"} />
                  <DetailRow label="Phone" value={detail.phone || "-"} />
                  <DetailRow label="GSTIN" value={detail.gstin || "-"} />
                  <DetailRow label="PAN" value={detail.pan || "-"} />
                </>
              ) : null}
              {detailTab === "address" ? (
                <>
                  <DetailRow label="Line 1" value={detail.addressLine1 || "-"} />
                  <DetailRow label="Line 2" value={detail.addressLine2 || "-"} />
                  <DetailRow label="City" value={detail.city || "-"} />
                  <DetailRow label="State" value={detail.state || "-"} />
                  <DetailRow label="Pincode" value={detail.pincode || "-"} />
                  <DetailRow label="Country" value={detail.country || "-"} />
                </>
              ) : null}
              {detailTab === "notes" ? (
                <div className="rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground">
                  {detail.notes?.trim() || "No notes added."}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">No customer selected.</div>
          )}
        </div>
      )}
    </aside>
  );
});

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[7rem_minmax(0,1fr)] items-start gap-2 rounded-md border bg-muted/10 px-2 py-1.5">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="break-words text-sm">{value}</span>
    </div>
  );
}

function CustomerFormDialog({
  open,
  onOpenChange,
  editing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Customer | null;
  onSaved: () => void;
}) {
  const [form, setForm] = React.useState<Partial<Customer>>(empty);
  const [saving, setSaving] = React.useState(false);
  const { errors, set: setErrors, reset: resetErrors, setOne } = useFieldErrors();

  React.useEffect(() => {
    if (open) {
      resetErrors();
      setForm(
        editing
          ? {
              ...editing,
              contactPerson: editing.contactPerson ?? "",
              email: editing.email ?? "",
              phone: editing.phone ?? "",
              gstin: editing.gstin ?? "",
              pan: editing.pan ?? "",
              addressLine1: editing.addressLine1 ?? "",
              addressLine2: editing.addressLine2 ?? "",
              city: editing.city ?? "",
              state: editing.state ?? "",
              pincode: editing.pincode ?? "",
              notes: editing.notes ?? "",
            }
          : empty,
      );
    }
  }, [open, editing, resetErrors]);

  function update<K extends keyof Customer>(key: K, value: Customer[K] | string | boolean) {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key as string]) setOne(key as string, undefined);
  }

  function clientValidate(): Record<string, string> {
    const next: Record<string, string> = {};
    if (!form.code?.trim()) next.code = "Code is required";
    if (!form.name?.trim()) next.name = "Name is required";
    if (form.email && form.email.trim() && !/^\S+@\S+\.\S+$/.test(form.email.trim())) {
      next.email = "Enter a valid email";
    }
    if (form.country && form.country.length > 2) {
      next.country = "Use a 2-letter country code";
    }
    return next;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const clientErrs = clientValidate();
    if (Object.keys(clientErrs).length) {
      setErrors(clientErrs);
      toast.error(summarizeFieldErrors(clientErrs, labelMap) ?? "Please complete required fields");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await api(`/api/customers/${editing.id}`, { method: "PUT", json: form });
        toast.success("Customer updated");
      } else {
        await api("/api/customers", { method: "POST", json: form });
        toast.success("Customer created");
      }
      resetErrors();
      onSaved();
    } catch (err) {
      const fieldErrs = getServerFieldErrors(err);
      if (Object.keys(fieldErrs).length) {
        setErrors(fieldErrs);
        toast.error(summarizeFieldErrors(fieldErrs, labelMap) ?? "Validation failed");
      } else {
        toast.error(err instanceof ApiClientError ? err.message : "Save failed");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit customer" : "New customer"}</DialogTitle>
          <DialogDescription>
            Fields marked <span className="text-destructive">*</span> are required.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Code" required error={errors.code}>
              <Input
                value={form.code ?? ""}
                onChange={(e) => update("code", e.target.value)}
                placeholder="ACME001"
                maxLength={50}
              />
            </FormField>
            <FormField label="Name" required error={errors.name}>
              <Input
                value={form.name ?? ""}
                onChange={(e) => update("name", e.target.value)}
                placeholder="Acme Industries"
              />
            </FormField>
            <FormField label="Contact person" error={errors.contactPerson}>
              <Input
                value={form.contactPerson ?? ""}
                onChange={(e) => update("contactPerson", e.target.value)}
              />
            </FormField>
            <FormField label="Email" error={errors.email}>
              <Input
                type="email"
                value={form.email ?? ""}
                onChange={(e) => update("email", e.target.value)}
              />
            </FormField>
            <FormField label="Phone" error={errors.phone}>
              <Input value={form.phone ?? ""} onChange={(e) => update("phone", e.target.value)} />
            </FormField>
            <FormField label="GSTIN" error={errors.gstin}>
              <Input value={form.gstin ?? ""} onChange={(e) => update("gstin", e.target.value)} />
            </FormField>
            <FormField label="PAN" error={errors.pan}>
              <Input value={form.pan ?? ""} onChange={(e) => update("pan", e.target.value)} />
            </FormField>
            <FormField label="Country" error={errors.country} hint="2-letter ISO code">
              <Input
                value={form.country ?? "IN"}
                onChange={(e) => update("country", e.target.value)}
                maxLength={2}
              />
            </FormField>
            <FormField label="Address line 1" className="sm:col-span-2" error={errors.addressLine1}>
              <Input
                value={form.addressLine1 ?? ""}
                onChange={(e) => update("addressLine1", e.target.value)}
              />
            </FormField>
            <FormField label="Address line 2" className="sm:col-span-2" error={errors.addressLine2}>
              <Input
                value={form.addressLine2 ?? ""}
                onChange={(e) => update("addressLine2", e.target.value)}
              />
            </FormField>
            <FormField label="City" error={errors.city}>
              <Input value={form.city ?? ""} onChange={(e) => update("city", e.target.value)} />
            </FormField>
            <FormField label="State" error={errors.state}>
              <Input value={form.state ?? ""} onChange={(e) => update("state", e.target.value)} />
            </FormField>
            <FormField label="Pincode" error={errors.pincode}>
              <Input value={form.pincode ?? ""} onChange={(e) => update("pincode", e.target.value)} />
            </FormField>
            <FormField label="Status">
              <Select
                value={form.isActive ? "1" : "0"}
                onChange={(e) => update("isActive", e.target.value === "1")}
              >
                <option value="1">Active</option>
                <option value="0">Inactive</option>
              </Select>
            </FormField>
            <FormField label="Notes" className="sm:col-span-2" error={errors.notes}>
              <Textarea value={form.notes ?? ""} onChange={(e) => update("notes", e.target.value)} rows={3} />
            </FormField>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : editing ? "Save changes" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
