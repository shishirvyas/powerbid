"use client";

import * as React from "react";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, EmptyState } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { FormField, getServerFieldErrors, summarizeFieldErrors } from "@/components/form-field";
import { Typeahead } from "@/components/typeahead";
import { Pagination } from "@/components/pagination";
import { TableSkeleton } from "@/components/table-skeleton";
import { useDebounced, useList } from "@/lib/hooks";
import { api, ApiClientError } from "@/lib/api-client";
import { formatCurrency } from "@/lib/calc";

type SupplierProduct = {
  id: number;
  supplierId: number | null;
  supplierName: string | null;
  code: string;
  name: string;
  description: string | null;
  unitName: string | null;
  standardPrice: string;
  leadDays: number;
  hsnCode: string | null;
  isActive: boolean;
  createdAt: string;
};

type SupplierOption = { id: number; code: string; companyName: string };

type SPForm = {
  supplierId: string;
  supplierQuery: string;
  code: string;
  name: string;
  description: string;
  unitName: string;
  standardPrice: string;
  leadDays: string;
  hsnCode: string;
  isActive: boolean;
};

const emptyForm: SPForm = {
  supplierId: "",
  supplierQuery: "",
  code: "",
  name: "",
  description: "",
  unitName: "",
  standardPrice: "0",
  leadDays: "0",
  hsnCode: "",
  isActive: true,
};

export function SupplierProductsClient() {
  const [search, setSearch] = React.useState("");
  const q = useDebounced(search, 300);
  const [limit, setLimit] = React.useState(25);
  const [offset, setOffset] = React.useState(0);
  const { data, loading, error, refresh } = useList<SupplierProduct>("/api/supplier-products", { q, limit, offset });

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState<SupplierProduct | null>(null);
  const [form, setForm] = React.useState<SPForm>(emptyForm);
  const [saving, setSaving] = React.useState(false);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  const [supplierLookupQ, setSupplierLookupQ] = React.useState("");
  const debouncedSupplierQ = useDebounced(supplierLookupQ, 250);
  const { data: suppliers } = useList<SupplierOption>("/api/suppliers", { q: debouncedSupplierQ, limit: 50 });

  React.useEffect(() => { setOffset(0); }, [q, limit]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setFieldErrors({});
    setDialogOpen(true);
  }

  async function openEdit(row: SupplierProduct) {
    setEditingId(row.id);
    setForm({
      supplierId: row.supplierId ? String(row.supplierId) : "",
      supplierQuery: row.supplierName ?? "",
      code: row.code,
      name: row.name,
      description: row.description ?? "",
      unitName: row.unitName ?? "",
      standardPrice: String(row.standardPrice ?? "0"),
      leadDays: String(row.leadDays ?? 0),
      hsnCode: row.hsnCode ?? "",
      isActive: row.isActive,
    });
    setFieldErrors({});
    setDialogOpen(true);
  }

  function setField<K extends keyof SPForm>(key: K, val: SPForm[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function handleSave() {
    setSaving(true);
    setFieldErrors({});
    const payload = {
      supplierId: form.supplierId ? Number(form.supplierId) : null,
      code: form.code,
      name: form.name,
      description: form.description || null,
      unitName: form.unitName || null,
      standardPrice: Number(form.standardPrice) || 0,
      leadDays: Number(form.leadDays) || 0,
      hsnCode: form.hsnCode || null,
      isActive: form.isActive,
    };
    try {
      if (editingId) {
        await api(`/api/supplier-products/${editingId}`, { method: "PUT", body: payload });
        toast.success("Supplier product updated");
      } else {
        await api("/api/supplier-products", { method: "POST", body: payload });
        toast.success("Supplier product created");
      }
      setDialogOpen(false);
      refresh();
    } catch (err) {
      if (err instanceof ApiClientError) {
        const fe = getServerFieldErrors(err.data);
        if (fe) {
          setFieldErrors(fe);
          toast.error(summarizeFieldErrors(fe));
        } else {
          toast.error(err.message ?? "Save failed");
        }
      } else {
        toast.error("Save failed");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(sp: SupplierProduct) {
    try {
      await api(`/api/supplier-products/${sp.id}`, { method: "DELETE" });
      toast.success("Deleted");
      refresh();
    } catch {
      toast.error("Delete failed");
    } finally {
      setConfirmDelete(null);
    }
  }

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;

  return (
    <>
      <PageHeader title="Supplier Products">
        <Button size="sm" onClick={openCreate}>
          <Plus className="mr-1 h-4 w-4" /> New Product
        </Button>
      </PageHeader>

      <div className="flex items-center gap-2 px-4 pb-3 pt-1">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search name, code, HSN…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
      </div>

      <div className="px-4">
        {loading ? (
          <TableSkeleton cols={7} rows={8} />
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : rows.length === 0 ? (
          <EmptyState message="No supplier products found." onNew={openCreate} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">Lead Days</TableHead>
                <TableHead>HSN</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((sp) => (
                <TableRow key={sp.id}>
                  <TableCell className="font-mono text-xs">{sp.code}</TableCell>
                  <TableCell className="font-medium">{sp.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{sp.supplierName ?? "—"}</TableCell>
                  <TableCell className="text-sm">{sp.unitName ?? "—"}</TableCell>
                  <TableCell className="text-right text-sm">{formatCurrency(Number(sp.standardPrice))}</TableCell>
                  <TableCell className="text-right text-sm">{sp.leadDays}d</TableCell>
                  <TableCell className="text-xs font-mono">{sp.hsnCode ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={sp.isActive ? "default" : "outline"}>
                      {sp.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(sp)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => setConfirmDelete(sp)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {total > limit && (
          <div className="pt-3">
            <Pagination total={total} limit={limit} offset={offset} onPage={setOffset} onPageSize={setLimit} />
          </div>
        )}
      </div>

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Supplier Product" : "New Supplier Product"}</DialogTitle>
            <DialogDescription>
              Raw materials and components sourced from suppliers.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Code" required error={fieldErrors.code}>
                <Input
                  value={form.code}
                  onChange={(e) => setField("code", e.target.value)}
                  placeholder="SP0001"
                  className="h-8 text-sm font-mono"
                />
              </FormField>
              <FormField label="HSN Code" error={fieldErrors.hsnCode}>
                <Input
                  value={form.hsnCode}
                  onChange={(e) => setField("hsnCode", e.target.value)}
                  placeholder="28182010"
                  className="h-8 text-sm"
                />
              </FormField>
            </div>

            <FormField label="Name" required error={fieldErrors.name}>
              <Input
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
                placeholder="Product name"
                className="h-8 text-sm"
              />
            </FormField>

            <FormField label="Supplier" error={fieldErrors.supplierId}>
              <Typeahead
                value={form.supplierQuery}
                onChange={setSupplierLookupQ}
                onSelect={(item: SupplierOption) => {
                  setField("supplierId", String(item.id));
                  setField("supplierQuery", item.companyName);
                }}
                onClear={() => { setField("supplierId", ""); setField("supplierQuery", ""); }}
                items={(suppliers?.rows ?? []) as SupplierOption[]}
                getLabel={(s) => s.companyName}
                placeholder="Search supplier…"
              />
            </FormField>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="Unit" error={fieldErrors.unitName}>
                <Input
                  value={form.unitName}
                  onChange={(e) => setField("unitName", e.target.value)}
                  placeholder="kg / pcs / ltr"
                  className="h-8 text-sm"
                />
              </FormField>
              <FormField label="Lead Days" error={fieldErrors.leadDays}>
                <Input
                  type="number"
                  min={0}
                  value={form.leadDays}
                  onChange={(e) => setField("leadDays", e.target.value)}
                  className="h-8 text-sm"
                />
              </FormField>
            </div>

            <FormField label="Standard Price (₹)" error={fieldErrors.standardPrice}>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={form.standardPrice}
                onChange={(e) => setField("standardPrice", e.target.value)}
                className="h-8 text-sm"
              />
            </FormField>

            <FormField label="Description" error={fieldErrors.description}>
              <Input
                value={form.description}
                onChange={(e) => setField("description", e.target.value)}
                placeholder="Optional description"
                className="h-8 text-sm"
              />
            </FormField>

            <FormField label="Active">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setField("isActive", e.target.checked)}
                  className="rounded"
                />
                Active
              </label>
            </FormField>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : editingId ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete Supplier Product?"
        description={`Delete "${confirmDelete?.name}" (${confirmDelete?.code})? This cannot be undone.`}
        onConfirm={() => confirmDelete && handleDelete(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
      />
    </>
  );
}
