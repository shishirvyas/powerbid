"use client";

import * as React from "react";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, EmptyState } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
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
import { Pagination } from "@/components/pagination";
import { TableSkeleton } from "@/components/table-skeleton";
import {
  FormField,
  getServerFieldErrors,
  summarizeFieldErrors,
  useFieldErrors,
} from "@/components/form-field";
import { useDebounced, useList } from "@/lib/hooks";
import { api, ApiClientError } from "@/lib/api-client";

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

export function CustomersClient() {
  const [search, setSearch] = React.useState("");
  const q = useDebounced(search, 300);
  const [limit, setLimit] = React.useState(25);
  const [offset, setOffset] = React.useState(0);

  React.useEffect(() => {
    setOffset(0);
  }, [q, limit]);

  const { data, loading, error, refresh } = useList<Customer>("/api/customers", {
    q,
    limit,
    offset,
  });

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Customer | null>(null);
  const [confirmDel, setConfirmDel] = React.useState<Customer | null>(null);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }
  function openEdit(c: Customer) {
    setEditing(c);
    setDialogOpen(true);
  }

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
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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

      {!loading && data && data.rows.length === 0 ? (
        <EmptyState
          title={q ? "No customers match your search" : "No customers yet"}
          description={q ? undefined : "Create your first customer to get started."}
          action={
            !q ? (
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4" /> New customer
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="space-y-3">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="hidden md:table-cell">Contact</TableHead>
                <TableHead className="hidden lg:table-cell">Phone</TableHead>
                <TableHead className="hidden xl:table-cell">City</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && !data ? (
                <TableSkeleton cols={7} rows={6} />
              ) : (
                data?.rows.map((c) => (
                  <TableRow key={c.id} className="transition-colors hover:bg-muted/40">
                    <TableCell className="font-mono text-xs">{c.code}</TableCell>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm">{c.contactPerson || "—"}</TableCell>
                    <TableCell className="hidden lg:table-cell text-sm">{c.phone || "—"}</TableCell>
                    <TableCell className="hidden xl:table-cell text-sm">{c.city || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={c.isActive ? "success" : "muted"}>
                        {c.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(c)} aria-label="Edit">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setConfirmDel(c)}
                          aria-label="Delete"
                        >
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
        onConfirm={async () => {
          if (!confirmDel) return;
          try {
            await api(`/api/customers/${confirmDel.id}`, { method: "DELETE" });
            toast.success("Customer deleted");
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
              <Input
                value={form.phone ?? ""}
                onChange={(e) => update("phone", e.target.value)}
              />
            </FormField>
            <FormField label="GSTIN" error={errors.gstin}>
              <Input
                value={form.gstin ?? ""}
                onChange={(e) => update("gstin", e.target.value)}
              />
            </FormField>
            <FormField label="PAN" error={errors.pan}>
              <Input
                value={form.pan ?? ""}
                onChange={(e) => update("pan", e.target.value)}
              />
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
              <Textarea
                value={form.notes ?? ""}
                onChange={(e) => update("notes", e.target.value)}
                rows={3}
              />
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
