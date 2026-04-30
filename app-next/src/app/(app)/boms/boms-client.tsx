"use client";

import * as React from "react";
import { Pencil, Plus, Search, ShieldCheck, Trash2 } from "lucide-react";
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
import { FormField } from "@/components/form-field";
import { Typeahead } from "@/components/typeahead";
import { Pagination } from "@/components/pagination";
import { TableSkeleton } from "@/components/table-skeleton";
import { useDebounced, useList } from "@/lib/hooks";
import { api, ApiClientError } from "@/lib/api-client";
import { formatCurrency, formatDate } from "@/lib/calc";

type BomRow = {
  id: number;
  bomCode: string;
  version: string;
  isActive: boolean;
  laborCost: string;
  overheadCost: string;
  productId: number;
  productName: string;
  productSku: string | null;
  itemCount: number;
  createdAt: string;
};

type ProductOption = { id: number; sku: string | null; name: string };

type BomItemForm = {
  rawMaterialId: string;
  rawMaterialQuery: string;
  qtyPerUnit: string;
  wastagePercent: string;
  notes: string;
};

type BomForm = {
  productId: string;
  bomCode: string;
  version: string;
  isActive: boolean;
  laborCost: string;
  overheadCost: string;
  notes: string;
  items: BomItemForm[];
};

const emptyForm: BomForm = {
  productId: "",
  bomCode: "",
  version: "1.0",
  isActive: true,
  laborCost: "0",
  overheadCost: "0",
  notes: "",
  items: [{ rawMaterialId: "", rawMaterialQuery: "", qtyPerUnit: "1", wastagePercent: "0", notes: "" }],
};

export function BomsClient() {
  const [search, setSearch] = React.useState("");
  const q = useDebounced(search, 300);
  const [limit, setLimit] = React.useState(25);
  const [offset, setOffset] = React.useState(0);
  const { data, loading, error, refresh } = useList<BomRow>("/api/boms", { q, limit, offset });

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState<BomRow | null>(null);
  const [form, setForm] = React.useState<BomForm>(emptyForm);
  const [productQuery, setProductQuery] = React.useState("");
  const [productLookupQuery, setProductLookupQuery] = React.useState("");
  const productLookupQ = useDebounced(productLookupQuery, 250);
  const [saving, setSaving] = React.useState(false);
  const { data: products } = useList<ProductOption>("/api/products", { q: productLookupQ, limit: 100 });

  React.useEffect(() => {
    setOffset(0);
  }, [q, limit]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setProductQuery("");
    setDialogOpen(true);
  }

  async function openEdit(id: number) {
    try {
      const detail = await api<any>(`/api/boms/${id}`);
      setEditingId(id);
      setForm({
        productId: String(detail.productId),
        bomCode: detail.bomCode,
        version: detail.version,
        isActive: !!detail.isActive,
        laborCost: String(detail.laborCost ?? "0"),
        overheadCost: String(detail.overheadCost ?? "0"),
        notes: detail.notes || "",
        items: (detail.items || []).map((it: any) => ({
          rawMaterialId: String(it.rawMaterialId),
          rawMaterialQuery: it.rawMaterialName || "",
          qtyPerUnit: String(it.qtyPerUnit),
          wastagePercent: String(it.wastagePercent),
          notes: it.notes || "",
        })),
      });
      setProductQuery(`${detail.productSku || "NO-SKU"} - ${detail.productName}`);
      setDialogOpen(true);
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Failed to load BOM");
    }
  }

  async function submitBom(e: React.FormEvent) {
    e.preventDefault();
    if (!form.productId) {
      toast.error("Select a product");
      return;
    }
    if (!form.bomCode.trim()) {
      toast.error("BOM code is required");
      return;
    }
    if (form.items.length === 0 || form.items.some((it) => !it.rawMaterialId || Number(it.qtyPerUnit) <= 0)) {
      toast.error("Add valid BOM items");
      return;
    }

    setSaving(true);
    const payload = {
      productId: Number(form.productId),
      bomCode: form.bomCode.trim(),
      version: form.version.trim() || "1.0",
      isActive: form.isActive,
      laborCost: Number(form.laborCost || 0),
      overheadCost: Number(form.overheadCost || 0),
      notes: form.notes || null,
      items: form.items.map((it) => ({
        rawMaterialId: Number(it.rawMaterialId),
        qtyPerUnit: Number(it.qtyPerUnit || 0),
        wastagePercent: Number(it.wastagePercent || 0),
        notes: it.notes || null,
      })),
    };

    try {
      if (editingId) {
        await api(`/api/boms/${editingId}`, { method: "PUT", json: payload });
        toast.success("BOM updated");
      } else {
        await api("/api/boms", { method: "POST", json: payload });
        toast.success("BOM created");
      }
      setDialogOpen(false);
      refresh();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Failed to save BOM");
    } finally {
      setSaving(false);
    }
  }

  async function activate(id: number) {
    try {
      await api(`/api/boms/${id}/activate`, { method: "POST" });
      toast.success("BOM revision activated");
      refresh();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Activation failed");
    }
  }

  const materialLookup = new Map((products?.rows || []).map((p) => [String(p.id), `${p.sku || "NO-SKU"} - ${p.name}`]));

  return (
    <div className="space-y-6 animate-in fade-in-50">
      <PageHeader
        title="BOM Management"
        description="Build and maintain bill-of-material revisions."
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> New BOM
          </Button>
        }
      />

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search BOM code / product..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>
      ) : null}

      {!loading && data && data.rows.length === 0 ? (
        <EmptyState title={q ? "No BOMs match" : "No BOMs yet"} action={!q ? <Button onClick={openCreate}><Plus className="h-4 w-4" /> New BOM</Button> : null} />
      ) : (
        <div className="space-y-3">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>BOM</TableHead>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Items</TableHead>
                <TableHead className="text-right">Labor+OH</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && !data ? (
                <TableSkeleton cols={7} rows={5} />
              ) : (
                data?.rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <div className="font-mono text-xs">{row.bomCode}</div>
                      <div className="text-xs text-muted-foreground">v{row.version}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{row.productName}</div>
                      <div className="text-xs text-muted-foreground">{row.productSku || "No SKU"}</div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{row.itemCount}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(Number(row.laborCost) + Number(row.overheadCost), "INR")}
                    </TableCell>
                    <TableCell>
                      <Badge variant={row.isActive ? "success" : "muted"}>{row.isActive ? "Active" : "Inactive"}</Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{formatDate(row.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {!row.isActive ? (
                          <Button variant="ghost" size="icon" onClick={() => activate(row.id)} title="Activate revision">
                            <ShieldCheck className="h-4 w-4" />
                          </Button>
                        ) : null}
                        <Button variant="ghost" size="icon" onClick={() => openEdit(row.id)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setConfirmDelete(row)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {data ? <Pagination total={data.total} limit={limit} offset={offset} onPageChange={setOffset} onLimitChange={setLimit} /> : null}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit BOM" : "Create BOM"}</DialogTitle>
            <DialogDescription>Define revision metadata and material lines.</DialogDescription>
          </DialogHeader>

          <form onSubmit={submitBom} className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <FormField label="Product" required>
                <Typeahead
                  value={form.productId}
                  inputValue={productQuery}
                  onInputValueChange={(v) => {
                    setProductLookupQuery(v);
                    setProductQuery(v);
                    setForm((f) => ({ ...f, productId: "" }));
                  }}
                  onSelect={(opt) => {
                    setForm((f) => ({ ...f, productId: opt.value }));
                    setProductQuery(opt.label);
                  }}
                  options={(products?.rows || []).map((p) => ({ value: String(p.id), label: `${p.sku || "NO-SKU"} - ${p.name}` }))}
                  placeholder="Search product..."
                />
              </FormField>
              <FormField label="BOM Code" required>
                <Input value={form.bomCode} onChange={(e) => setForm((f) => ({ ...f, bomCode: e.target.value }))} placeholder="e.g. BOM-ASSY-001" />
              </FormField>
              <FormField label="Version" required>
                <Input value={form.version} onChange={(e) => setForm((f) => ({ ...f, version: e.target.value }))} />
              </FormField>
              <FormField label="Set Active">
                <label className="flex h-10 items-center gap-2 rounded-md border px-3 text-sm">
                  <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} />
                  Active revision
                </label>
              </FormField>
              <FormField label="Labor Cost">
                <Input type="number" min="0" value={form.laborCost} onChange={(e) => setForm((f) => ({ ...f, laborCost: e.target.value }))} />
              </FormField>
              <FormField label="Overhead Cost">
                <Input type="number" min="0" value={form.overheadCost} onChange={(e) => setForm((f) => ({ ...f, overheadCost: e.target.value }))} />
              </FormField>
            </div>

            <FormField label="Notes">
              <Input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </FormField>

            <div className="space-y-2 rounded-md border p-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">BOM Items</div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setForm((f) => ({ ...f, items: [...f.items, { rawMaterialId: "", rawMaterialQuery: "", qtyPerUnit: "1", wastagePercent: "0", notes: "" }] }))}
                >
                  <Plus className="h-4 w-4" /> Add Item
                </Button>
              </div>

              {form.items.map((it, idx) => (
                <div key={idx} className="grid grid-cols-1 gap-2 rounded-md border bg-muted/30 p-2 md:grid-cols-12">
                  <div className="md:col-span-5">
                    <Typeahead
                      value={it.rawMaterialId}
                      inputValue={it.rawMaterialQuery}
                      onInputValueChange={(v) => {
                        setProductLookupQuery(v);
                        setForm((f) => {
                          const items = [...f.items];
                          items[idx] = { ...items[idx], rawMaterialId: "", rawMaterialQuery: v };
                          return { ...f, items };
                        });
                      }}
                      onSelect={(opt) =>
                        setForm((f) => {
                          const items = [...f.items];
                          items[idx] = { ...items[idx], rawMaterialId: opt.value, rawMaterialQuery: opt.label };
                          return { ...f, items };
                        })
                      }
                      options={(products?.rows || []).map((p) => ({ value: String(p.id), label: `${p.sku || "NO-SKU"} - ${p.name}` }))}
                      placeholder="Search material..."
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Input
                      type="number"
                      min="0.0001"
                      step="0.0001"
                      value={it.qtyPerUnit}
                      onChange={(e) =>
                        setForm((f) => {
                          const items = [...f.items];
                          items[idx] = { ...items[idx], qtyPerUnit: e.target.value };
                          return { ...f, items };
                        })
                      }
                      placeholder="Qty/Unit"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={it.wastagePercent}
                      onChange={(e) =>
                        setForm((f) => {
                          const items = [...f.items];
                          items[idx] = { ...items[idx], wastagePercent: e.target.value };
                          return { ...f, items };
                        })
                      }
                      placeholder="Wastage %"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Input
                      value={it.notes}
                      onChange={(e) =>
                        setForm((f) => {
                          const items = [...f.items];
                          items[idx] = { ...items[idx], notes: e.target.value };
                          return { ...f, items };
                        })
                      }
                      placeholder="Notes"
                    />
                  </div>
                  <div className="md:col-span-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={form.items.length <= 1}
                      onClick={() =>
                        setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }))
                      }
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                  {it.rawMaterialId ? (
                    <div className="md:col-span-12 text-xs text-muted-foreground">{materialLookup.get(it.rawMaterialId)}</div>
                  ) : null}
                </div>
              ))}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Saving..." : editingId ? "Save BOM" : "Create BOM"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(v) => !v && setConfirmDelete(null)}
        title="Delete BOM?"
        description={confirmDelete ? `${confirmDelete.bomCode} will be permanently deleted.` : undefined}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={async () => {
          if (!confirmDelete) return;
          try {
            await api(`/api/boms/${confirmDelete.id}`, { method: "DELETE" });
            toast.success("BOM deleted");
            setConfirmDelete(null);
            refresh();
          } catch (err) {
            toast.error(err instanceof ApiClientError ? err.message : "Delete failed");
          }
        }}
      />
    </div>
  );
}
