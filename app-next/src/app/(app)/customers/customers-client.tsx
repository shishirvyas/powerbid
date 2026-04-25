"use client";

import * as React from "react";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, EmptyState } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

export function CustomersClient() {
  const [search, setSearch] = React.useState("");
  const q = useDebounced(search, 300);
  const { data, loading, error, refresh } = useList<Customer>("/api/customers", { q, limit: 100 });

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
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                  Loading...
                </TableCell>
              </TableRow>
            ) : (
              data?.rows.map((c) => (
                <TableRow key={c.id}>
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

  React.useEffect(() => {
    if (open) {
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
  }, [open, editing]);

  function update<K extends keyof Customer>(key: K, value: Customer[K] | string | boolean) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.code?.trim() || !form.name?.trim()) {
      toast.error("Code and name are required");
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
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit customer" : "New customer"}</DialogTitle>
          <DialogDescription>Required fields are marked with *.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Code *">
              <Input
                value={form.code ?? ""}
                onChange={(e) => update("code", e.target.value)}
                placeholder="ACME001"
                required
                maxLength={50}
              />
            </Field>
            <Field label="Name *">
              <Input
                value={form.name ?? ""}
                onChange={(e) => update("name", e.target.value)}
                placeholder="Acme Industries"
                required
              />
            </Field>
            <Field label="Contact person">
              <Input
                value={form.contactPerson ?? ""}
                onChange={(e) => update("contactPerson", e.target.value)}
              />
            </Field>
            <Field label="Email">
              <Input
                type="email"
                value={form.email ?? ""}
                onChange={(e) => update("email", e.target.value)}
              />
            </Field>
            <Field label="Phone">
              <Input
                value={form.phone ?? ""}
                onChange={(e) => update("phone", e.target.value)}
              />
            </Field>
            <Field label="GSTIN">
              <Input
                value={form.gstin ?? ""}
                onChange={(e) => update("gstin", e.target.value)}
              />
            </Field>
            <Field label="PAN">
              <Input
                value={form.pan ?? ""}
                onChange={(e) => update("pan", e.target.value)}
              />
            </Field>
            <Field label="Country">
              <Input
                value={form.country ?? "IN"}
                onChange={(e) => update("country", e.target.value)}
                maxLength={2}
              />
            </Field>
            <Field label="Address line 1" className="sm:col-span-2">
              <Input
                value={form.addressLine1 ?? ""}
                onChange={(e) => update("addressLine1", e.target.value)}
              />
            </Field>
            <Field label="Address line 2" className="sm:col-span-2">
              <Input
                value={form.addressLine2 ?? ""}
                onChange={(e) => update("addressLine2", e.target.value)}
              />
            </Field>
            <Field label="City">
              <Input
                value={form.city ?? ""}
                onChange={(e) => update("city", e.target.value)}
              />
            </Field>
            <Field label="State">
              <Input
                value={form.state ?? ""}
                onChange={(e) => update("state", e.target.value)}
              />
            </Field>
            <Field label="Pincode">
              <Input
                value={form.pincode ?? ""}
                onChange={(e) => update("pincode", e.target.value)}
              />
            </Field>
            <Field label="Status">
              <select
                value={form.isActive ? "1" : "0"}
                onChange={(e) => update("isActive", e.target.value === "1")}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="1">Active</option>
                <option value="0">Inactive</option>
              </select>
            </Field>
            <Field label="Notes" className="sm:col-span-2">
              <Textarea
                value={form.notes ?? ""}
                onChange={(e) => update("notes", e.target.value)}
                rows={3}
              />
            </Field>
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
