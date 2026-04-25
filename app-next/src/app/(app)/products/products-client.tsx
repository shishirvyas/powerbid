"use client";

import * as React from "react";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, EmptyState } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
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
import { useDebounced, useList, useResource } from "@/lib/hooks";
import { api, ApiClientError } from "@/lib/api-client";
import { formatCurrency } from "@/lib/calc";

type Product = {
  id: number;
  sku: string;
  name: string;
  description: string | null;
  brandId: number | null;
  brandName: string | null;
  unitId: number | null;
  unitCode: string | null;
  unitName: string | null;
  gstSlabId: number | null;
  gstName: string | null;
  gstRate: string | null;
  basePrice: string;
  isActive: boolean;
};

type Masters = {
  brands: { id: number; name: string; isActive: boolean }[];
  units: { id: number; code: string; name: string; isActive: boolean }[];
  gstSlabs: { id: number; name: string; rate: string; isActive: boolean }[];
};

type ProductForm = {
  sku: string;
  name: string;
  description: string;
  brandId: string;
  unitId: string;
  gstSlabId: string;
  basePrice: string;
  isActive: boolean;
};

const empty: ProductForm = {
  sku: "",
  name: "",
  description: "",
  brandId: "",
  unitId: "",
  gstSlabId: "",
  basePrice: "0",
  isActive: true,
};

const labelMap: Record<string, string> = {
  sku: "SKU",
  name: "Name",
  description: "Description",
  brandId: "Brand",
  unitId: "Unit",
  gstSlabId: "GST slab",
  basePrice: "Base price",
};

export function ProductsClient() {
  const [search, setSearch] = React.useState("");
  const q = useDebounced(search, 300);
  const [limit, setLimit] = React.useState(25);
  const [offset, setOffset] = React.useState(0);
  React.useEffect(() => {
    setOffset(0);
  }, [q, limit]);

  const { data, loading, error, refresh } = useList<Product>("/api/products", { q, limit, offset });
  const { data: masters } = useResource<Masters>("/api/masters");

  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Product | null>(null);
  const [confirmDel, setConfirmDel] = React.useState<Product | null>(null);

  return (
    <div className="space-y-6 animate-in fade-in-50">
      <PageHeader
        title="Products"
        description="SKUs with brands, units, pricing and GST."
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> New product
          </Button>
        }
      />

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by SKU or name..."
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
          title={q ? "No products match" : "No products yet"}
          action={
            !q ? (
              <Button
                onClick={() => {
                  setEditing(null);
                  setOpen(true);
                }}
              >
                <Plus className="h-4 w-4" /> New product
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="space-y-3">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="hidden md:table-cell">Brand</TableHead>
                <TableHead className="hidden md:table-cell">Unit</TableHead>
                <TableHead className="hidden lg:table-cell">GST</TableHead>
                <TableHead className="text-right">Base price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && !data ? (
                <TableSkeleton cols={8} rows={6} />
              ) : (
                data?.rows.map((p) => (
                  <TableRow key={p.id} className="transition-colors hover:bg-muted/40">
                    <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm">{p.brandName || "—"}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm">{p.unitCode || "—"}</TableCell>
                    <TableCell className="hidden lg:table-cell text-sm">
                      {p.gstName ? `${p.gstName} (${p.gstRate}%)` : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(p.basePrice)}</TableCell>
                    <TableCell>
                      <Badge variant={p.isActive ? "success" : "muted"}>
                        {p.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditing(p);
                            setOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setConfirmDel(p)}
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

      <ProductFormDialog
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        masters={masters}
        onSaved={() => {
          setOpen(false);
          refresh();
        }}
      />

      <ConfirmDialog
        open={!!confirmDel}
        onOpenChange={(v) => !v && setConfirmDel(null)}
        title="Delete product?"
        description={confirmDel ? `"${confirmDel.name}" will be permanently removed.` : undefined}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={async () => {
          if (!confirmDel) return;
          try {
            await api(`/api/products/${confirmDel.id}`, { method: "DELETE" });
            toast.success("Product deleted");
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

function ProductFormDialog({
  open,
  onOpenChange,
  editing,
  masters,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Product | null;
  masters: Masters | null;
  onSaved: () => void;
}) {
  const [form, setForm] = React.useState<ProductForm>(empty);
  const [saving, setSaving] = React.useState(false);
  const { errors, set: setErrors, reset: resetErrors, setOne } = useFieldErrors();

  React.useEffect(() => {
    if (open) {
      resetErrors();
      setForm(
        editing
          ? {
              sku: editing.sku,
              name: editing.name,
              description: editing.description ?? "",
              brandId: editing.brandId ? String(editing.brandId) : "",
              unitId: editing.unitId ? String(editing.unitId) : "",
              gstSlabId: editing.gstSlabId ? String(editing.gstSlabId) : "",
              basePrice: editing.basePrice ?? "0",
              isActive: editing.isActive,
            }
          : empty,
      );
    }
  }, [open, editing, resetErrors]);

  function update<K extends keyof ProductForm>(key: K, value: ProductForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key as string]) setOne(key as string, undefined);
  }

  function clientValidate(): Record<string, string> {
    const next: Record<string, string> = {};
    if (!form.sku.trim()) next.sku = "SKU is required";
    if (!form.name.trim()) next.name = "Name is required";
    if (form.basePrice === "" || Number.isNaN(Number(form.basePrice))) {
      next.basePrice = "Enter a valid base price";
    } else if (Number(form.basePrice) < 0) {
      next.basePrice = "Base price cannot be negative";
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
    const payload = {
      sku: form.sku,
      name: form.name,
      description: form.description || null,
      brandId: form.brandId ? Number(form.brandId) : null,
      unitId: form.unitId ? Number(form.unitId) : null,
      gstSlabId: form.gstSlabId ? Number(form.gstSlabId) : null,
      basePrice: form.basePrice || "0",
      isActive: form.isActive,
    };
    try {
      if (editing) {
        await api(`/api/products/${editing.id}`, { method: "PUT", json: payload });
        toast.success("Product updated");
      } else {
        await api("/api/products", { method: "POST", json: payload });
        toast.success("Product created");
      }
      resetErrors();
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit product" : "New product"}</DialogTitle>
          <DialogDescription>
            Fields marked <span className="text-destructive">*</span> are required.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="SKU" required error={errors.sku}>
              <Input value={form.sku} onChange={(e) => update("sku", e.target.value)} maxLength={80} />
            </FormField>
            <FormField label="Name" required error={errors.name}>
              <Input value={form.name} onChange={(e) => update("name", e.target.value)} />
            </FormField>
            <FormField label="Brand" error={errors.brandId}>
              <Select value={form.brandId} onChange={(e) => update("brandId", e.target.value)}>
                <option value="">—</option>
                {masters?.brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Unit" error={errors.unitId}>
              <Select value={form.unitId} onChange={(e) => update("unitId", e.target.value)}>
                <option value="">—</option>
                {masters?.units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.code} — {u.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="GST slab" error={errors.gstSlabId}>
              <Select value={form.gstSlabId} onChange={(e) => update("gstSlabId", e.target.value)}>
                <option value="">—</option>
                {masters?.gstSlabs.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({g.rate}%)
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Base price (INR)" required error={errors.basePrice}>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.basePrice}
                onChange={(e) => update("basePrice", e.target.value)}
              />
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
            <FormField label="Description" className="sm:col-span-2" error={errors.description}>
              <Textarea
                value={form.description}
                onChange={(e) => update("description", e.target.value)}
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
