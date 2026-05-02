"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, FileStack, Loader2, Pencil, Plus, Truck } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Typeahead } from "@/components/typeahead";
import { FormField } from "@/components/form-field";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, ApiClientError } from "@/lib/api-client";
import { formatCurrency, formatDate } from "@/lib/calc";
import { useDebounced, useList, useResource } from "@/lib/hooks";

type Detail = {
  id: number;
  soNumber: string;
  orderDate: string;
  customerId: number;
  customerName: string | null;
  customerCode: string | null;
  status: string;
  currency: string;
  subtotal: string;
  taxableAmount: string;
  gstAmount: string;
  grandTotal: string;
  notes: string | null;
  items: Array<{
    id: number;
    productId: number | null;
    productName: string;
    unitName: string | null;
    qty: string;
    dispatchedQty: string;
    unitPrice: string;
    gstRate: string;
    lineTotal: string;
  }>;
  dispatches: Array<{
    id: number;
    dispatchNumber: string;
    dispatchDate: string;
    status: string;
    warehouseName: string | null;
    trackingNumber: string | null;
    transporterName: string | null;
  }>;
};

type Warehouse = { id: number; code: string; name: string };
type Customer = { id: number; code: string; name: string };
type Product = { id: number; sku: string | null; name: string; unitCode: string | null; unitName: string | null };

type SoLine = {
  productId: string;
  productQuery: string;
  productName: string;
  unitName: string;
  qty: string;
  unitPrice: string;
  gstRate: string;
};

export default function SalesOrderDetailClient({ id }: { id: string }) {
  const { data, loading, error, refresh } = useResource<Detail>(`/api/sales-orders/${id}`);
  const { data: warehouses } = useList<Warehouse>("/api/warehouses", { limit: 100 });

  // Edit dialog state
  const [editOpen, setEditOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [editForm, setEditForm] = React.useState<{
    orderDate: string; customerId: string; notes: string; items: SoLine[];
  }>({ orderDate: "", customerId: "", notes: "", items: [] });
  const [customerQuery, setCustomerQuery] = React.useState("");
  const [productLookupQuery, setProductLookupQuery] = React.useState("");
  const customerLookupQ = useDebounced(customerQuery, 250);
  const productLookupQ = useDebounced(productLookupQuery, 250);
  const { data: customers } = useList<Customer>("/api/customers", { q: customerLookupQ, limit: 100 });
  const { data: products } = useList<Product>("/api/products", { q: productLookupQ, limit: 100 });

  function openEdit() {
    if (!data) return;
    setEditForm({
      orderDate: data.orderDate.slice(0, 10),
      customerId: String(data.customerId),
      notes: data.notes || "",
      items: data.items.map((line) => ({
        productId: line.productId ? String(line.productId) : "",
        productQuery: line.productName,
        productName: line.productName,
        unitName: line.unitName || "",
        qty: String(line.qty),
        unitPrice: String(line.unitPrice),
        gstRate: String(line.gstRate),
      })),
    });
    setCustomerQuery(data.customerName || "");
    setEditOpen(true);
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editForm.customerId) return toast.error("Select customer");
    if (editForm.items.length === 0 || editForm.items.some((i) => !i.productId || Number(i.qty) <= 0))
      return toast.error("Add valid line items");
    try {
      setSaving(true);
      await api(`/api/sales-orders/${id}`, {
        method: "PUT",
        json: {
          orderDate: editForm.orderDate,
          customerId: Number(editForm.customerId),
          status: data!.status,
          notes: editForm.notes || null,
          items: editForm.items.map((i) => ({
            productId: Number(i.productId),
            productName: i.productName,
            unitName: i.unitName || null,
            qty: Number(i.qty),
            unitPrice: Number(i.unitPrice),
            gstRate: Number(i.gstRate),
          })),
        },
      });
      toast.success("Sales order updated");
      setEditOpen(false);
      refresh();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  }

  const [dispatching, setDispatching] = React.useState(false);
  const [warehouseQuery, setWarehouseQuery] = React.useState("");
  const [dispatchForm, setDispatchForm] = React.useState({
    warehouseId: "",
    dispatchDate: new Date().toISOString().slice(0, 10),
    transporterName: "",
    vehicleNumber: "",
    trackingNumber: "",
    notes: "",
    qtyByItem: {} as Record<number, string>,
  });

  React.useEffect(() => {
    if (!data) return;
    const next: Record<number, string> = {};
    data.items.forEach((line) => {
      const pending = Math.max(0, Number(line.qty) - Number(line.dispatchedQty));
      next[line.id] = pending > 0 ? String(pending) : "0";
    });
    setDispatchForm((prev) => ({ ...prev, qtyByItem: next }));
  }, [data]);

  async function postDispatch() {
    if (!data) return;
    if (!dispatchForm.warehouseId) {
      toast.error("Select warehouse");
      return;
    }
    const items = data.items
      .map((line) => ({ soItemId: line.id, qty: Number(dispatchForm.qtyByItem[line.id] || 0) }))
      .filter((line) => line.qty > 0);
    if (items.length === 0) {
      toast.error("Enter at least one dispatch quantity");
      return;
    }

    try {
      setDispatching(true);
      await api(`/api/sales-orders/${id}/dispatch`, {
        method: "POST",
        json: {
          warehouseId: Number(dispatchForm.warehouseId),
          dispatchDate: dispatchForm.dispatchDate,
          transporterName: dispatchForm.transporterName || null,
          vehicleNumber: dispatchForm.vehicleNumber || null,
          trackingNumber: dispatchForm.trackingNumber || null,
          notes: dispatchForm.notes || null,
          items,
        },
      });
      toast.success("Dispatch posted and stock updated");
      refresh();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Dispatch failed");
    } finally {
      setDispatching(false);
    }
  }

  if (error) return <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>;
  if (loading || !data) return <div className="text-sm text-muted-foreground">Loading...</div>;

  return (
    <>
    <div className="space-y-6 animate-in fade-in-50">
      <PageHeader
        title={data.soNumber}
        description={`Order Date ${formatDate(data.orderDate)} · ${data.customerName || "-"}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline"><Link href="/sales-orders"><ArrowLeft className="h-4 w-4" /> Back</Link></Button>
            <Badge variant={data.status.includes("dispatch") ? "info" : data.status === "confirmed" ? "warning" : "muted"}>{data.status.replaceAll("_", " ")}</Badge>
            {(data.status === "draft" || data.status === "confirmed") && (
              <Button variant="outline" onClick={openEdit}><Pencil className="h-4 w-4" /> Edit</Button>
            )}
            <Button asChild variant="outline" title="New BOM for this SO">
              <Link href={`/boms?newBom=1&soId=${data.id}&soNumber=${encodeURIComponent(data.soNumber)}`}>
                <FileStack className="h-4 w-4" /> New BOM
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Customer</CardTitle></CardHeader>
          <CardContent className="text-sm">
            <div className="font-semibold">{data.customerName || "-"}</div>
            <div className="text-muted-foreground">Code: {data.customerCode || "-"}</div>
            {data.notes ? <div className="mt-2 text-muted-foreground">{data.notes}</div> : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Totals</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div className="flex items-center justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatCurrency(data.subtotal, data.currency)}</span></div>
            <div className="flex items-center justify-between"><span className="text-muted-foreground">Taxable</span><span>{formatCurrency(data.taxableAmount, data.currency)}</span></div>
            <div className="flex items-center justify-between"><span className="text-muted-foreground">GST</span><span>{formatCurrency(data.gstAmount, data.currency)}</span></div>
            <div className="mt-2 border-t pt-2 flex items-center justify-between font-semibold"><span>Grand Total</span><span>{formatCurrency(data.grandTotal, data.currency)}</span></div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Order Items</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Ordered</TableHead>
                <TableHead className="text-right">Dispatched</TableHead>
                <TableHead className="text-right">Pending</TableHead>
                <TableHead className="text-right">Unit Price</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((line) => {
                const pending = Math.max(0, Number(line.qty) - Number(line.dispatchedQty));
                return (
                  <TableRow key={line.id}>
                    <TableCell>
                      <div className="font-medium">{line.productName}</div>
                      {line.unitName ? <div className="text-xs text-muted-foreground">{line.unitName}</div> : null}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{Number(line.qty).toLocaleString("en-IN")}</TableCell>
                    <TableCell className="text-right tabular-nums">{Number(line.dispatchedQty).toLocaleString("en-IN")}</TableCell>
                    <TableCell className="text-right tabular-nums">{pending.toLocaleString("en-IN")}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(line.unitPrice, data.currency)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(line.lineTotal, data.currency)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Create Dispatch</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Input type="date" value={dispatchForm.dispatchDate} onChange={(e) => setDispatchForm((f) => ({ ...f, dispatchDate: e.target.value }))} />
            <Typeahead
              value={dispatchForm.warehouseId}
              inputValue={warehouseQuery}
              onInputValueChange={(v) => {
                setWarehouseQuery(v);
                setDispatchForm((f) => ({ ...f, warehouseId: "" }));
              }}
              onSelect={(opt) => {
                setDispatchForm((f) => ({ ...f, warehouseId: opt.value }));
                setWarehouseQuery(opt.label);
              }}
              options={(warehouses?.rows || []).map((w) => ({ value: String(w.id), label: `${w.code} - ${w.name}` }))}
              placeholder="Search warehouse..."
            />
            <Input placeholder="Transporter" value={dispatchForm.transporterName} onChange={(e) => setDispatchForm((f) => ({ ...f, transporterName: e.target.value }))} />
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Input placeholder="Vehicle Number" value={dispatchForm.vehicleNumber} onChange={(e) => setDispatchForm((f) => ({ ...f, vehicleNumber: e.target.value }))} />
            <Input placeholder="Tracking Number" value={dispatchForm.trackingNumber} onChange={(e) => setDispatchForm((f) => ({ ...f, trackingNumber: e.target.value }))} />
            <Input placeholder="Notes" value={dispatchForm.notes} onChange={(e) => setDispatchForm((f) => ({ ...f, notes: e.target.value }))} />
          </div>

          <div className="rounded-md border p-3">
            <div className="mb-2 text-sm font-semibold">Dispatch Quantities</div>
            <div className="space-y-2">
              {data.items.map((line) => {
                const pending = Math.max(0, Number(line.qty) - Number(line.dispatchedQty));
                return (
                  <div key={line.id} className="grid grid-cols-1 gap-2 rounded border bg-muted/30 p-2 md:grid-cols-12">
                    <div className="md:col-span-6">
                      <div className="font-medium text-sm">{line.productName}</div>
                      <div className="text-xs text-muted-foreground">Pending: {pending.toLocaleString("en-IN")}</div>
                    </div>
                    <div className="md:col-span-3 md:col-start-10">
                      <Input
                        type="number"
                        min="0"
                        max={String(pending)}
                        step="0.01"
                        value={dispatchForm.qtyByItem[line.id] ?? "0"}
                        onChange={(e) => setDispatchForm((f) => ({ ...f, qtyByItem: { ...f.qtyByItem, [line.id]: e.target.value } }))}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <Button onClick={postDispatch} disabled={dispatching}>
            {dispatching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />} Post Dispatch
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Dispatch History</CardTitle></CardHeader>
        <CardContent>
          {data.dispatches.length === 0 ? (
            <div className="text-sm text-muted-foreground">No dispatch records yet.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dispatch No</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Transporter</TableHead>
                  <TableHead>Tracking</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.dispatches.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-mono text-xs">{d.dispatchNumber}</TableCell>
                    <TableCell>{formatDate(d.dispatchDate)}</TableCell>
                    <TableCell>{d.warehouseName || "-"}</TableCell>
                    <TableCell><Badge variant="info">{d.status}</Badge></TableCell>
                    <TableCell>{d.transporterName || "-"}</TableCell>
                    <TableCell>{d.trackingNumber || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>

    {/* ── Edit Sales Order Dialog ── */}
    <Dialog open={editOpen} onOpenChange={setEditOpen}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Edit {data.soNumber}</DialogTitle>
          <DialogDescription>Update order details and line items. Status must be draft or confirmed.</DialogDescription>
        </DialogHeader>
        <form onSubmit={saveEdit} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <FormField label="Order Date" required>
              <Input type="date" value={editForm.orderDate} onChange={(e) => setEditForm((f) => ({ ...f, orderDate: e.target.value }))} />
            </FormField>
            <FormField label="Customer" required>
              <Typeahead
                value={editForm.customerId}
                inputValue={customerQuery}
                onInputValueChange={(v) => { setCustomerQuery(v); setEditForm((f) => ({ ...f, customerId: "" })); }}
                onSelect={(opt) => { setEditForm((f) => ({ ...f, customerId: opt.value })); setCustomerQuery(opt.label); }}
                options={(customers?.rows || []).map((c) => ({ value: String(c.id), label: `${c.code} - ${c.name}` }))}
                placeholder="Search customer..."
              />
            </FormField>
          </div>
          <FormField label="Notes">
            <Input value={editForm.notes} onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))} />
          </FormField>

          <div className="space-y-2 rounded-md border p-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">Line Items</div>
              <Button type="button" variant="outline" size="sm" onClick={() =>
                setEditForm((f) => ({ ...f, items: [...f.items, { productId: "", productQuery: "", productName: "", unitName: "", qty: "1", unitPrice: "0", gstRate: "18" }] }))
              }><Plus className="h-4 w-4" /> Add Line</Button>
            </div>
            {editForm.items.map((line, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-1 rounded border bg-muted/30 p-2 items-end">
                <div className="col-span-12 md:col-span-4">
                  <div className="text-xs text-muted-foreground mb-0.5">Product</div>
                  <Typeahead
                    value={line.productId}
                    inputValue={line.productQuery}
                    onInputValueChange={(v) => {
                      setProductLookupQuery(v);
                      setEditForm((f) => {
                        const items = [...f.items];
                        items[idx] = { ...items[idx], productId: "", productQuery: v, productName: v };
                        return { ...f, items };
                      });
                    }}
                    onSelect={(opt) => {
                      const prod = products?.rows.find((p) => String(p.id) === opt.value);
                      setEditForm((f) => {
                        const items = [...f.items];
                        items[idx] = { ...items[idx], productId: opt.value, productQuery: opt.label, productName: prod?.name || opt.label, unitName: prod?.unitName || "" };
                        return { ...f, items };
                      });
                    }}
                    options={(products?.rows || []).map((p) => ({ value: String(p.id), label: `${p.sku || "NO-SKU"} - ${p.name}` }))}
                    placeholder="Search product..."
                  />
                </div>
                <div className="col-span-4 md:col-span-2">
                  <div className="text-xs text-muted-foreground mb-0.5">Qty</div>
                  <Input type="number" min="0" step="0.01" value={line.qty} onChange={(e) => setEditForm((f) => { const items = [...f.items]; items[idx] = { ...items[idx], qty: e.target.value }; return { ...f, items }; })} />
                </div>
                <div className="col-span-4 md:col-span-2">
                  <div className="text-xs text-muted-foreground mb-0.5">Unit Price</div>
                  <Input type="number" min="0" step="0.01" value={line.unitPrice} onChange={(e) => setEditForm((f) => { const items = [...f.items]; items[idx] = { ...items[idx], unitPrice: e.target.value }; return { ...f, items }; })} />
                </div>
                <div className="col-span-3 md:col-span-2">
                  <div className="text-xs text-muted-foreground mb-0.5">GST %</div>
                  <Input type="number" min="0" max="28" step="0.01" value={line.gstRate} onChange={(e) => setEditForm((f) => { const items = [...f.items]; items[idx] = { ...items[idx], gstRate: e.target.value }; return { ...f, items }; })} />
                </div>
                <div className="col-span-1">
                  <Button type="button" variant="ghost" size="icon" onClick={() => setEditForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }))}>
                    ✕
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    </>
  );
}
