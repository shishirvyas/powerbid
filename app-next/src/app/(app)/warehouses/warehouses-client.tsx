"use client";

import * as React from "react";
import { Pencil, Plus, Search, Trash2, Warehouse } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, EmptyState } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { FormField, getServerFieldErrors, useFieldErrors } from "@/components/form-field";
import { useDebounced, useList } from "@/lib/hooks";
import { api, ApiClientError } from "@/lib/api-client";

type WarehouseItem = {
  id: number;
  code: string;
  name: string;
  location: string | null;
  isActive: boolean;
};

const empty: Partial<WarehouseItem> = {
  code: "",
  name: "",
  location: "",
  isActive: true,
};

export function WarehousesClient() {
  const [search, setSearch] = React.useState("");
  const q = useDebounced(search, 300);
  const [limit, setLimit] = React.useState(25);
  const [offset, setOffset] = React.useState(0);

  React.useEffect(() => {
    setOffset(0);
  }, [q, limit]);

  const { data, loading, error, refresh } = useList<WarehouseItem>("/api/warehouses", { q, limit, offset });

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<WarehouseItem | null>(null);
  const [confirmDel, setConfirmDel] = React.useState<WarehouseItem | null>(null);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }
  function openEdit(w: WarehouseItem) {
    setEditing(w);
    setDialogOpen(true);
  }

  return (
    <div className="space-y-6 animate-in fade-in-50">
      <PageHeader
        title="Warehouses"
        description="Manage your inventory locations and bins."
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> New warehouse
          </Button>
        }
      />

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by code or name..."
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
          title={q ? "No warehouses match" : "No warehouses"}
          description={q ? undefined : "Create your first warehouse to start tracking stock."}
          action={
            !q ? (
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4" /> New warehouse
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
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && !data ? (
                <TableSkeleton cols={5} rows={4} />
              ) : (
                data?.rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono text-xs">{row.code}</TableCell>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell>{row.location || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={row.isActive ? "success" : "muted"}>
                        {row.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(row)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setConfirmDel(row)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <WarehouseFormDialog
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
        title="Delete warehouse?"
        description={confirmDel ? `"${confirmDel.name}" will be permanently removed.` : undefined}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={async () => {
          if (!confirmDel) return;
          try {
            await api(`/api/warehouses/${confirmDel.id}`, { method: "DELETE" });
            toast.success("Warehouse deleted");
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

function WarehouseFormDialog({
  open,
  onOpenChange,
  editing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: WarehouseItem | null;
  onSaved: () => void;
}) {
  const [form, setForm] = React.useState<Partial<WarehouseItem>>(empty);
  const [saving, setSaving] = React.useState(false);
  const { errors, set: setErrors, reset: resetErrors, setOne } = useFieldErrors();

  React.useEffect(() => {
    if (open) {
      resetErrors();
      setForm(editing ? { ...editing, location: editing.location ?? "" } : empty);
    }
  }, [open, editing, resetErrors]);

  function update(key: keyof WarehouseItem, value: any) {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setOne(key as string, undefined);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await api(`/api/warehouses/${editing.id}`, { method: "PUT", json: form });
        toast.success("Warehouse updated");
      } else {
        await api("/api/warehouses", { method: "POST", json: form });
        toast.success("Warehouse created");
      }
      onSaved();
    } catch (err) {
      const fieldErrs = getServerFieldErrors(err);
      if (Object.keys(fieldErrs).length) {
        setErrors(fieldErrs);
      } else {
        toast.error(err instanceof ApiClientError ? err.message : "Save failed");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit warehouse" : "New warehouse"}</DialogTitle>
          <DialogDescription>
            Configure inventory locations.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <FormField label="Code" required error={errors.code}>
            <Input value={form.code ?? ""} onChange={(e) => update("code", e.target.value)} placeholder="WH-01" />
          </FormField>
          <FormField label="Name" required error={errors.name}>
            <Input value={form.name ?? ""} onChange={(e) => update("name", e.target.value)} placeholder="Main Warehouse" />
          </FormField>
          <FormField label="Location" error={errors.location}>
            <Input value={form.location ?? ""} onChange={(e) => update("location", e.target.value)} placeholder="Mumbai, MH" />
          </FormField>
          <FormField label="Status">
            <Select value={form.isActive ? "1" : "0"} onChange={(e) => update("isActive", e.target.value === "1")}>
              <option value="1">Active</option>
              <option value="0">Inactive</option>
            </Select>
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
