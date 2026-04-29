"use client";

import * as React from "react";
import { ArrowRightLeft, Pencil, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, EmptyState } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Pagination } from "@/components/pagination";
import { TableSkeleton } from "@/components/table-skeleton";
import { FormField, getServerFieldErrors, useFieldErrors } from "@/components/form-field";
import { useDebounced, useList, useResource } from "@/lib/hooks";
import { api, ApiClientError } from "@/lib/api-client";

type StockItemRow = {
  id: number;
  productId: number;
  productName: string;
  productSku: string | null;
  warehouseId: number;
  warehouseName: string;
  qtyOnHand: string;
  qtyReserved: string;
  qtyAvailable: string;
  binLocation: string | null;
  reorderLevel: string;
};

const emptyCreate = {
  productId: null as number | null,
  warehouseId: null as number | null,
  binLocation: "",
  reorderLevel: "0",
  initialQty: "0",
};

export function StockItemsClient() {
  const [search, setSearch] = React.useState("");
  const q = useDebounced(search, 300);
  const [limit, setLimit] = React.useState(25);
  const [offset, setOffset] = React.useState(0);

  React.useEffect(() => {
    setOffset(0);
  }, [q, limit]);

  const { data, loading, error, refresh } = useList<StockItemRow>("/api/stock-items", { q, limit, offset });

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<StockItemRow | null>(null);
  const [movementTarget, setMovementTarget] = React.useState<StockItemRow | null>(null);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }
  function openEdit(row: StockItemRow) {
    setEditing(row);
    setDialogOpen(true);
  }

  return (
    <div className="space-y-6 animate-in fade-in-50">
      <PageHeader
        title="Stock Items"
        description="View real-time stock levels across warehouses."
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> Initialize Stock
          </Button>
        }
      />

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by product, SKU, or warehouse..."
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

      {data && data.rows.length > 0 ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          Low stock items: <strong>{data.rows.filter((r) => Number(r.qtyAvailable) <= Number(r.reorderLevel)).length}</strong>
        </div>
      ) : null}

      {!loading && data && data.rows.length === 0 ? (
        <EmptyState
          title={q ? "No stock items match" : "No stock items"}
          description={q ? undefined : "Initialize your first product stock in a warehouse."}
          action={
            !q ? (
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4" /> Initialize Stock
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="space-y-3">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Warehouse</TableHead>
                <TableHead className="text-right">Available</TableHead>
                <TableHead className="text-right">On Hand</TableHead>
                <TableHead className="hidden md:table-cell">Bin</TableHead>
                <TableHead className="hidden md:table-cell text-right">Reorder Lvl</TableHead>
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
                      <div className="font-medium">{row.productName}</div>
                      <div className="text-xs text-muted-foreground">{row.productSku || "No SKU"}</div>
                    </TableCell>
                    <TableCell>{row.warehouseName}</TableCell>
                    <TableCell className="text-right tabular-nums font-bold text-primary">{Number(row.qtyAvailable)}</TableCell>
                    <TableCell className="text-right tabular-nums">{Number(row.qtyOnHand)}</TableCell>
                    <TableCell className="hidden md:table-cell">{row.binLocation || "—"}</TableCell>
                    <TableCell className="hidden md:table-cell text-right tabular-nums text-muted-foreground">{Number(row.reorderLevel)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setMovementTarget(row)} title="Post stock transaction">
                          <ArrowRightLeft className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(row)} title="Edit stock settings">
                          <Pencil className="h-4 w-4" />
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

      <StockItemFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        onSaved={() => {
          setDialogOpen(false);
          refresh();
        }}
      />

      <StockMovementDialog
        open={!!movementTarget}
        onOpenChange={(open) => {
          if (!open) setMovementTarget(null);
        }}
        item={movementTarget}
        onSaved={() => {
          setMovementTarget(null);
          refresh();
        }}
      />
    </div>
  );
}

function StockMovementDialog({
  open,
  onOpenChange,
  item,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  item: StockItemRow | null;
  onSaved: () => void;
}) {
  type MovementRow = {
    id: number;
    movementType: string;
    qty: string;
    referenceType: string | null;
    referenceId: string | null;
    remarks: string | null;
    createdAt: string;
  };

  const [form, setForm] = React.useState({
    movementType: "in",
    qty: "0",
    targetWarehouseId: "",
    referenceType: "adjustment",
    referenceId: "",
    remarks: "",
  });
  const [saving, setSaving] = React.useState(false);
  const { data: warehouses } = useList<{ id: number; code: string; name: string }>("/api/warehouses", { limit: 100 });
  const { data: recentMovements } = useResource<MovementRow[]>(item ? `/api/stock-items/${item.id}/movements` : null);

  React.useEffect(() => {
    if (!open || !item) return;
    setForm({
      movementType: "in",
      qty: "0",
      targetWarehouseId: "",
      referenceType: "adjustment",
      referenceId: "",
      remarks: "",
    });
  }, [open, item]);

  async function submitMovement(e: React.FormEvent) {
    e.preventDefault();
    if (!item) return;
    try {
      setSaving(true);
      await api(`/api/stock-items/${item.id}/movements`, {
        method: "POST",
        json: {
          movementType: form.movementType,
          qty: Number(form.qty),
          targetWarehouseId: form.movementType === "transfer" ? Number(form.targetWarehouseId) : undefined,
          referenceType: form.referenceType || null,
          referenceId: form.referenceId || null,
          remarks: form.remarks || null,
        },
      });
      toast.success("Stock movement posted");
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Movement failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Post stock transaction</DialogTitle>
          <DialogDescription>
            {item ? `${item.productName} @ ${item.warehouseName} (Available: ${Number(item.qtyAvailable)})` : ""}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submitMovement} className="space-y-4">
          <FormField label="Movement Type" required>
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={form.movementType}
              onChange={(e) => setForm((f) => ({ ...f, movementType: e.target.value }))}
            >
              <option value="in">Stock In</option>
              <option value="out">Stock Out</option>
              <option value="transfer">Transfer</option>
            </select>
          </FormField>

          <FormField label="Quantity" required>
            <Input type="number" min="0.01" step="0.01" value={form.qty} onChange={(e) => setForm((f) => ({ ...f, qty: e.target.value }))} />
          </FormField>

          {form.movementType === "transfer" ? (
            <FormField label="Target Warehouse" required>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={form.targetWarehouseId}
                onChange={(e) => setForm((f) => ({ ...f, targetWarehouseId: e.target.value }))}
              >
                <option value="">Select warehouse</option>
                {(warehouses?.rows || [])
                  .filter((w) => w.id !== item?.warehouseId)
                  .map((w) => (
                    <option key={w.id} value={String(w.id)}>
                      {w.code} - {w.name}
                    </option>
                  ))}
              </select>
            </FormField>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Reference Type">
              <Input value={form.referenceType} onChange={(e) => setForm((f) => ({ ...f, referenceType: e.target.value }))} placeholder="adjustment" />
            </FormField>
            <FormField label="Reference Id">
              <Input value={form.referenceId} onChange={(e) => setForm((f) => ({ ...f, referenceId: e.target.value }))} placeholder="Optional" />
            </FormField>
          </div>

          <FormField label="Remarks">
            <Input value={form.remarks} onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))} placeholder="Reason / note" />
          </FormField>

          <div className="rounded-md border p-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recent Movements</div>
            {!recentMovements || recentMovements.length === 0 ? (
              <div className="text-xs text-muted-foreground">No transactions yet.</div>
            ) : (
              <div className="space-y-1 text-xs">
                {recentMovements.slice(0, 6).map((m) => (
                  <div key={m.id} className="flex items-center justify-between gap-2 rounded bg-muted/40 px-2 py-1">
                    <span className="capitalize">{m.movementType}</span>
                    <span className="tabular-nums">{Number(m.qty).toLocaleString("en-IN")}</span>
                    <span className="text-muted-foreground">{formatDate(m.createdAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Posting..." : "Post Movement"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function StockItemFormDialog({
  open,
  onOpenChange,
  editing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: StockItemRow | null;
  onSaved: () => void;
}) {
  const [form, setForm] = React.useState(emptyCreate);
  const [saving, setSaving] = React.useState(false);
  const { errors, set: setErrors, reset: resetErrors, setOne } = useFieldErrors();

  const [productQuery, setProductQuery] = React.useState("");
  const [warehouseQuery, setWarehouseQuery] = React.useState("");

  const { data: products } = useList<{id: number; name: string; sku: string}>("/api/products", { limit: 100 });
  const { data: warehouses } = useList<{id: number; name: string; code: string}>("/api/warehouses", { limit: 50 });

  React.useEffect(() => {
    if (open) {
      resetErrors();
      if (editing) {
        setForm({
          productId: editing.productId,
          warehouseId: editing.warehouseId,
          binLocation: editing.binLocation || "",
          reorderLevel: editing.reorderLevel,
          initialQty: "0",
        });
        setProductQuery(editing.productName);
        setWarehouseQuery(editing.warehouseName);
      } else {
        setForm(emptyCreate);
        setProductQuery("");
        setWarehouseQuery("");
      }
    }
  }, [open, editing, resetErrors]);

  function update(key: string, value: any) {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setOne(key, undefined);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing && (!form.productId || !form.warehouseId)) {
      setErrors({
        productId: !form.productId ? "Product is required" : "",
        warehouseId: !form.warehouseId ? "Warehouse is required" : ""
      });
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        await api(`/api/stock-items/${editing.id}`, { method: "PUT", json: form });
        toast.success("Stock details updated");
      } else {
        await api("/api/stock-items", { method: "POST", json: form });
        toast.success("Stock item initialized");
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
          <DialogTitle>{editing ? "Edit stock item details" : "Initialize stock item"}</DialogTitle>
          <DialogDescription>
            {editing ? "Update bin location and reorder limits." : "Start tracking a product in a warehouse."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <FormField label="Product" required error={errors.productId}>
            <Typeahead
              value={form.productId ? String(form.productId) : ""}
              inputValue={productQuery}
              onInputValueChange={(v) => { setProductQuery(v); if (!editing) update("productId", null); }}
              onSelect={(opt) => { update("productId", Number(opt.value)); setProductQuery(opt.label); }}
              options={(products?.rows || []).map(p => ({ value: String(p.id), label: `${p.sku||""} - ${p.name}` }))}
              placeholder="Search product..."
              disabled={!!editing}
            />
          </FormField>
          
          <FormField label="Warehouse" required error={errors.warehouseId}>
            <Typeahead
              value={form.warehouseId ? String(form.warehouseId) : ""}
              inputValue={warehouseQuery}
              onInputValueChange={(v) => { setWarehouseQuery(v); if (!editing) update("warehouseId", null); }}
              onSelect={(opt) => { update("warehouseId", Number(opt.value)); setWarehouseQuery(opt.label); }}
              options={(warehouses?.rows || []).map(w => ({ value: String(w.id), label: `${w.code} - ${w.name}` }))}
              placeholder="Search warehouse..."
              disabled={!!editing}
            />
          </FormField>

          {!editing && (
            <FormField label="Initial Quantity" error={errors.initialQty}>
              <Input type="number" min="0" value={form.initialQty} onChange={e => update("initialQty", e.target.value)} />
            </FormField>
          )}

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Bin Location" error={errors.binLocation}>
              <Input value={form.binLocation} onChange={e => update("binLocation", e.target.value)} placeholder="e.g. A1-04" />
            </FormField>
            <FormField label="Reorder Level" error={errors.reorderLevel}>
              <Input type="number" min="0" value={form.reorderLevel} onChange={e => update("reorderLevel", e.target.value)} />
            </FormField>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
