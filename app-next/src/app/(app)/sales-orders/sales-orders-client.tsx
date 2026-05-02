"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, FileStack, Plus, Search, Trash2 } from "lucide-react";
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
import { formatCurrency, formatDate } from "@/lib/calc";

type Row = {
  id: number;
  soNumber: string;
  orderDate: string;
  status: string;
  currency: string;
  grandTotal: string;
  customerId: number;
  customerName: string | null;
  createdAt: string;
};

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

export function SalesOrdersClient() {
  const router = useRouter();
  const [search, setSearch] = React.useState("");
  const q = useDebounced(search, 300);
  const [limit, setLimit] = React.useState(25);
  const [offset, setOffset] = React.useState(0);
  const { data, loading, error, refresh } = useList<Row>("/api/sales-orders", { q, limit, offset });

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState<Row | null>(null);
  const [customerQuery, setCustomerQuery] = React.useState("");
  const [productLookupQuery, setProductLookupQuery] = React.useState("");
  const customerLookupQ = useDebounced(customerQuery, 250);
  const productLookupQ = useDebounced(productLookupQuery, 250);
  const { data: customers } = useList<Customer>("/api/customers", { q: customerLookupQ, limit: 100 });
  const { data: products } = useList<Product>("/api/products", { q: productLookupQ, limit: 100 });

  const [form, setForm] = React.useState({
    orderDate: new Date().toISOString().slice(0, 10),
    customerId: "",
    notes: "",
    items: [{ productId: "", productQuery: "", productName: "", unitName: "", qty: "1", unitPrice: "0", gstRate: "18" }] as SoLine[],
  });

  React.useEffect(() => {
    setOffset(0);
  }, [q, limit]);

  async function createOrder(e: React.FormEvent) {
    e.preventDefault();
    if (!form.customerId) return toast.error("Select customer");
    if (form.items.length === 0 || form.items.some((i) => !i.productId || Number(i.qty) <= 0)) return toast.error("Add valid line items");

    try {
      setSaving(true);
      const row = await api<{ id: number }>("/api/sales-orders", {
        method: "POST",
        json: {
          orderDate: form.orderDate,
          customerId: Number(form.customerId),
          status: "confirmed",
          notes: form.notes || null,
          items: form.items.map((i) => ({
            productId: Number(i.productId),
            productName: i.productName,
            unitName: i.unitName || null,
            qty: Number(i.qty),
            unitPrice: Number(i.unitPrice),
            gstRate: Number(i.gstRate),
          })),
        },
      });
      toast.success("Sales order created");
      setDialogOpen(false);
      setCustomerQuery("");
      setForm({ orderDate: new Date().toISOString().slice(0, 10), customerId: "", notes: "", items: [{ productId: "", productQuery: "", productName: "", unitName: "", qty: "1", unitPrice: "0", gstRate: "18" }] });
      refresh();
      router.push(`/sales-orders/${row.id}`);
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Create failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in-50">
      <PageHeader title="Sales Orders" description="Confirm customer demand and drive dispatch." actions={<Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4" /> New Sales Order</Button>} />

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search by SO number, customer..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {error ? <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div> : null}

      {!loading && data && data.rows.length === 0 ? (
        <EmptyState title={q ? "No sales orders match" : "No sales orders yet"} action={!q ? <Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4" /> New Sales Order</Button> : null} />
      ) : (
        <div className="space-y-3">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SO Number</TableHead>
                <TableHead className="hidden md:table-cell">Order Date</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && !data ? <TableSkeleton cols={6} rows={5} /> : data?.rows.map((row) => (
                <TableRow key={row.id} className="cursor-pointer hover:bg-muted/40" onClick={(e) => {
                  if ((e.target as HTMLElement).closest("button,a")) return;
                  router.push(`/sales-orders/${row.id}`);
                }}>
                  <TableCell className="font-mono text-xs">{row.soNumber}</TableCell>
                  <TableCell className="hidden md:table-cell">{formatDate(row.orderDate)}</TableCell>
                  <TableCell>{row.customerName || "-"}</TableCell>
                  <TableCell><Badge variant={row.status.includes("dispatch") ? "info" : row.status === "confirmed" ? "warning" : "muted"}>{row.status.replaceAll("_", " ")}</Badge></TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(row.grandTotal, row.currency)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button asChild variant="ghost" size="icon" title="View SO"><Link href={`/sales-orders/${row.id}`}><Eye className="h-4 w-4" /></Link></Button>
                      <Button asChild variant="ghost" size="icon" title="New BOM for this SO"><Link href={`/boms?newBom=1&soId=${row.id}&soNumber=${encodeURIComponent(row.soNumber)}`}><FileStack className="h-4 w-4 text-primary" /></Link></Button>
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
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>New Sales Order</DialogTitle>
            <DialogDescription>Create a sales order and confirm lines for dispatch.</DialogDescription>
          </DialogHeader>

          <form onSubmit={createOrder} className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <FormField label="Order Date" required>
                <Input type="date" value={form.orderDate} onChange={(e) => setForm((f) => ({ ...f, orderDate: e.target.value }))} />
              </FormField>
              <FormField label="Customer" required>
                <Typeahead
                  value={form.customerId}
                  inputValue={customerQuery}
                  onInputValueChange={(v) => {
                    setCustomerQuery(v);
                    setForm((f) => ({ ...f, customerId: "" }));
                  }}
                  onSelect={(opt) => {
                    setForm((f) => ({ ...f, customerId: opt.value }));
                    setCustomerQuery(opt.label);
                  }}
                  options={(customers?.rows || []).map((c) => ({ value: String(c.id), label: `${c.code} - ${c.name}` }))}
                  placeholder="Search customer..."
                />
              </FormField>
            </div>

            <FormField label="Notes">
              <Input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </FormField>

            <div className="space-y-2 rounded-md border p-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">Line Items</div>
                <Button type="button" variant="outline" size="sm" onClick={() => setForm((f) => ({ ...f, items: [...f.items, { productId: "", productQuery: "", productName: "", unitName: "", qty: "1", unitPrice: "0", gstRate: "18" }] }))}><Plus className="h-4 w-4" /> Add Line</Button>
              </div>

              {form.items.map((line, idx) => (
                <div key={idx} className="grid grid-cols-1 gap-2 rounded-md border bg-muted/30 p-2 md:grid-cols-12">
                  <div className="md:col-span-5">
                    <Typeahead
                      value={line.productId}
                      inputValue={line.productQuery}
                      onInputValueChange={(v) => {
                        setProductLookupQuery(v);
                        setForm((f) => {
                          const items = [...f.items];
                          items[idx] = { ...items[idx], productId: "", productQuery: v, productName: v, unitName: "" };
                          return { ...f, items };
                        });
                      }}
                      onSelect={(opt) => {
                        const p = (products?.rows || []).find((x) => String(x.id) === opt.value);
                        setForm((f) => {
                          const items = [...f.items];
                          items[idx] = {
                            ...items[idx],
                            productId: opt.value,
                            productQuery: opt.label,
                            productName: p?.name || "",
                            unitName: p?.unitCode || p?.unitName || "",
                          };
                          return { ...f, items };
                        });
                      }}
                      options={(products?.rows || []).map((p) => ({ value: String(p.id), label: `${p.sku || "NO-SKU"} - ${p.name}` }))}
                      placeholder="Search product..."
                    />
                  </div>
                  <div className="md:col-span-2"><Input type="number" min="0.01" step="0.01" value={line.qty} onChange={(e) => setForm((f) => { const items = [...f.items]; items[idx] = { ...items[idx], qty: e.target.value }; return { ...f, items }; })} placeholder="Qty" /></div>
                  <div className="md:col-span-2"><Input type="number" min="0" step="0.01" value={line.unitPrice} onChange={(e) => setForm((f) => { const items = [...f.items]; items[idx] = { ...items[idx], unitPrice: e.target.value }; return { ...f, items }; })} placeholder="Unit Price" /></div>
                  <div className="md:col-span-2"><Input type="number" min="0" max="100" step="0.01" value={line.gstRate} onChange={(e) => setForm((f) => { const items = [...f.items]; items[idx] = { ...items[idx], gstRate: e.target.value }; return { ...f, items }; })} placeholder="GST %" /></div>
                  <div className="md:col-span-1">
                    <Button type="button" variant="ghost" size="icon" disabled={form.items.length <= 1} onClick={() => setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }))}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </div>
              ))}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Creating..." : "Create SO"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(v) => !v && setConfirmDelete(null)}
        title="Delete Sales Order?"
        description={confirmDelete ? `${confirmDelete.soNumber} will be deleted.` : undefined}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={async () => {
          if (!confirmDelete) return;
          try {
            await api(`/api/sales-orders/${confirmDelete.id}`, { method: "DELETE" });
            toast.success("Sales order deleted");
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
