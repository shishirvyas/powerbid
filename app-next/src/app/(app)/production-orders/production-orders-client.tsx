"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, Plus, Search, Trash2 } from "lucide-react";
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
import { FormField } from "@/components/form-field";
import { Typeahead } from "@/components/typeahead";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Pagination } from "@/components/pagination";
import { TableSkeleton } from "@/components/table-skeleton";
import { useDebounced, useList } from "@/lib/hooks";
import { api, ApiClientError } from "@/lib/api-client";
import { formatDate } from "@/lib/calc";

type Row = {
  id: number;
  productionNumber: string;
  status: string;
  plannedQty: string;
  producedQty: string;
  productName: string;
  productSku: string | null;
  warehouseName: string;
  bomCode: string | null;
  createdAt: string;
};

type Product = { id: number; sku: string | null; name: string };
type Warehouse = { id: number; code: string; name: string };
type Bom = { id: number; bomCode: string; productId: number; productName: string };

export function ProductionOrdersClient() {
  const router = useRouter();
  const [search, setSearch] = React.useState("");
  const q = useDebounced(search, 300);
  const [limit, setLimit] = React.useState(25);
  const [offset, setOffset] = React.useState(0);
  const { data, loading, error, refresh } = useList<Row>("/api/production-orders", { q, limit, offset });

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState<Row | null>(null);
  const [productQuery, setProductQuery] = React.useState("");
  const productLookupQ = useDebounced(productQuery, 250);
  const { data: products } = useList<Product>("/api/products", { q: productLookupQ, limit: 100 });
  const { data: warehouses } = useList<Warehouse>("/api/warehouses", { limit: 100 });
  const { data: boms } = useList<Bom>("/api/boms", { limit: 300 });
  const [bomQuery, setBomQuery] = React.useState("");
  const [warehouseQuery, setWarehouseQuery] = React.useState("");
  const [form, setForm] = React.useState({
    productId: "",
    warehouseId: "",
    bomId: "",
    plannedQty: "1",
    notes: "",
  });

  React.useEffect(() => {
    setOffset(0);
  }, [q, limit]);

  async function createOrder(e: React.FormEvent) {
    e.preventDefault();
    if (!form.productId || !form.warehouseId || Number(form.plannedQty) <= 0) {
      toast.error("Product, warehouse and planned qty are required");
      return;
    }
    try {
      setSaving(true);
      const row = await api<{ id: number }>("/api/production-orders", {
        method: "POST",
        json: {
          productId: Number(form.productId),
          warehouseId: Number(form.warehouseId),
          bomId: form.bomId ? Number(form.bomId) : null,
          plannedQty: Number(form.plannedQty),
          notes: form.notes || null,
        },
      });
      toast.success("Production order created");
      setDialogOpen(false);
      setProductQuery("");
      setBomQuery("");
      setWarehouseQuery("");
      setForm({ productId: "", warehouseId: "", bomId: "", plannedQty: "1", notes: "" });
      refresh();
      router.push(`/production-orders/${row.id}`);
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Create failed");
    } finally {
      setSaving(false);
    }
  }

  const selectedProductId = Number(form.productId || 0);
  const bomOptions = (boms?.rows || []).filter((b) => !selectedProductId || b.productId === selectedProductId);

  return (
    <div className="space-y-6 animate-in fade-in-50">
      <PageHeader
        title="Production Orders"
        description="Plan, consume materials, and post finished goods."
        actions={<Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4" /> New Production</Button>}
      />

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search by production no, product, warehouse..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {error ? <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div> : null}

      {!loading && data && data.rows.length === 0 ? (
        <EmptyState title={q ? "No production orders match" : "No production orders yet"} action={!q ? <Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4" /> New Production</Button> : null} />
      ) : (
        <div className="space-y-3">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Production No</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Warehouse</TableHead>
                <TableHead className="text-right">Planned</TableHead>
                <TableHead className="text-right">Produced</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && !data ? <TableSkeleton cols={8} rows={5} /> : data?.rows.map((row) => (
                <TableRow key={row.id} className="cursor-pointer hover:bg-muted/40" onClick={(e) => {
                  if ((e.target as HTMLElement).closest("button,a")) return;
                  router.push(`/production-orders/${row.id}`);
                }}>
                  <TableCell className="font-mono text-xs">{row.productionNumber}</TableCell>
                  <TableCell>
                    <div className="font-medium">{row.productName}</div>
                    <div className="text-xs text-muted-foreground">{row.productSku || "No SKU"} {row.bomCode ? `· ${row.bomCode}` : ""}</div>
                  </TableCell>
                  <TableCell>{row.warehouseName}</TableCell>
                  <TableCell className="text-right tabular-nums">{Number(row.plannedQty).toLocaleString("en-IN")}</TableCell>
                  <TableCell className="text-right tabular-nums">{Number(row.producedQty).toLocaleString("en-IN")}</TableCell>
                  <TableCell><Badge variant={row.status === "completed" ? "success" : row.status === "in_progress" ? "warning" : "muted"}>{row.status.replaceAll("_", " ")}</Badge></TableCell>
                  <TableCell className="hidden md:table-cell">{formatDate(row.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button asChild variant="ghost" size="icon"><Link href={`/production-orders/${row.id}`}><Eye className="h-4 w-4" /></Link></Button>
                      <Button variant="ghost" size="icon" onClick={() => setConfirmDelete(row)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {data ? <Pagination total={data.total} limit={limit} offset={offset} onPageChange={setOffset} onLimitChange={setLimit} /> : null}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Production Order</DialogTitle>
            <DialogDescription>Create a lightweight production job from BOM.</DialogDescription>
          </DialogHeader>
          <form onSubmit={createOrder} className="space-y-4">
            <FormField label="Product" required>
              <Typeahead
                value={form.productId}
                inputValue={productQuery}
                onInputValueChange={(v) => {
                  setProductQuery(v);
                  setBomQuery("");
                  setForm((f) => ({ ...f, productId: "", bomId: "" }));
                }}
                onSelect={(opt) => {
                  setProductQuery(opt.label);
                  setBomQuery("");
                  setForm((f) => ({ ...f, productId: opt.value, bomId: "" }));
                }}
                options={(products?.rows || []).map((p) => ({ value: String(p.id), label: `${p.sku || "NO-SKU"} - ${p.name}` }))}
                placeholder="Search product..."
              />
            </FormField>
            <FormField label="BOM Revision">
              <Typeahead
                value={form.bomId}
                inputValue={bomQuery}
                onInputValueChange={(v) => {
                  setBomQuery(v);
                  setForm((f) => ({ ...f, bomId: "" }));
                }}
                onSelect={(opt) => {
                  setForm((f) => ({ ...f, bomId: opt.value }));
                  setBomQuery(opt.label);
                }}
                options={bomOptions.map((b) => ({ value: String(b.id), label: `${b.bomCode} - ${b.productName}` }))}
                placeholder="Search BOM revision..."
              />
            </FormField>
            <FormField label="Warehouse" required>
              <Typeahead
                value={form.warehouseId}
                inputValue={warehouseQuery}
                onInputValueChange={(v) => {
                  setWarehouseQuery(v);
                  setForm((f) => ({ ...f, warehouseId: "" }));
                }}
                onSelect={(opt) => {
                  setForm((f) => ({ ...f, warehouseId: opt.value }));
                  setWarehouseQuery(opt.label);
                }}
                options={(warehouses?.rows || []).map((w) => ({ value: String(w.id), label: `${w.code} - ${w.name}` }))}
                placeholder="Search warehouse..."
              />
            </FormField>
            <FormField label="Planned Qty" required>
              <Input type="number" min="0.01" step="0.01" value={form.plannedQty} onChange={(e) => setForm((f) => ({ ...f, plannedQty: e.target.value }))} />
            </FormField>
            <FormField label="Notes">
              <Input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </FormField>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Creating..." : "Create"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(v) => !v && setConfirmDelete(null)}
        title="Delete Production Order?"
        description={confirmDelete ? `${confirmDelete.productionNumber} will be removed.` : undefined}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={async () => {
          if (!confirmDelete) return;
          try {
            await api(`/api/production-orders/${confirmDelete.id}`, { method: "DELETE" });
            toast.success("Production order deleted");
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
