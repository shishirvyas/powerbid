"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, Pencil, Plus, Printer, Search, Trash2 } from "lucide-react";
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
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Pagination } from "@/components/pagination";
import { TableSkeleton } from "@/components/table-skeleton";
import { useDebounced, useList } from "@/lib/hooks";
import { api, ApiClientError } from "@/lib/api-client";
import { formatCurrency, formatDate } from "@/lib/calc";

type PurchaseOrder = {
  id: number;
  poNumber: string;
  expectedDate: string | null;
  status: string;
  currency: string;
  grandTotal: string;
  supplierId: number;
  supplierName: string | null;
  soId: number | null;
  soNumber: string | null;
  bomId: number | null;
  bomCode: string | null;
  createdAt: string;
};

export function PurchaseOrdersClient() {
  const router = useRouter();
  const [search, setSearch] = React.useState("");
  const q = useDebounced(search, 300);
  const [limit, setLimit] = React.useState(25);
  const [offset, setOffset] = React.useState(0);
  
  React.useEffect(() => {
    setOffset(0);
  }, [q, limit]);

  const { data, loading, error, refresh } = useList<PurchaseOrder>("/api/purchase-orders", { q, limit, offset });
  const [confirmDel, setConfirmDel] = React.useState<PurchaseOrder | null>(null);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (
        e.key.toLowerCase() === "n" &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement) &&
        !(e.target instanceof HTMLSelectElement)
      ) {
        e.preventDefault();
        router.push("/purchase-orders/new");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  return (
    <div className="space-y-6 animate-in fade-in-50">
      <PageHeader
        title="Purchase Orders"
        description="Create and manage purchase orders for your suppliers."
        actions={
          <Button onClick={() => router.push("/purchase-orders/new")}>
            <Plus className="h-4 w-4" /> New PO
            <kbd className="ml-2 hidden sm:inline-flex items-center rounded border bg-background/40 px-1.5 text-[10px] font-mono">
              N
            </kbd>
          </Button>
        }
      />

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by PO number, supplier..."
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
          title={q ? "No purchase orders match" : "No purchase orders yet"}
          action={
            !q ? (
              <Button onClick={() => router.push("/purchase-orders/new")}>
                <Plus className="h-4 w-4" /> New PO
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="space-y-3">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>PO Number</TableHead>
                <TableHead className="hidden md:table-cell">Expected Date</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead className="hidden lg:table-cell">Linked SO</TableHead>
                <TableHead className="hidden lg:table-cell">Linked BOM</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && !data ? (
                <TableSkeleton cols={8} rows={5} />
              ) : (
                data?.rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className="cursor-pointer transition-colors hover:bg-muted/40"
                    onClick={(e) => {
                       if ((e.target as HTMLElement).closest("button, a")) return;
                       router.push(`/purchase-orders/${row.id}`);
                    }}
                  >
                    <TableCell className="font-mono text-xs">{row.poNumber}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm">{formatDate(row.expectedDate)}</TableCell>
                    <TableCell className="font-medium">{row.supplierName || "—"}</TableCell>
                    <TableCell className="hidden lg:table-cell font-mono text-xs">{row.soNumber || (row.soId ? `SO-${row.soId}` : "—")}</TableCell>
                    <TableCell className="hidden lg:table-cell font-mono text-xs">{row.bomCode || (row.bomId ? `BOM-${row.bomId}` : "—")}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{row.status.replace("_", " ").toUpperCase()}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(row.grandTotal, row.currency)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button asChild variant="ghost" size="icon" aria-label="Print">
                          <Link href={`/purchase-orders/${row.id}/print`} target="_blank">
                            <Printer className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button asChild variant="ghost" size="icon" aria-label="View">
                          <Link href={`/purchase-orders/${row.id}`}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button asChild variant="ghost" size="icon" aria-label="Edit">
                          <Link href={`/purchase-orders/${row.id}/edit`}>
                            <Pencil className="h-4 w-4" />
                          </Link>
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

      <ConfirmDialog
        open={!!confirmDel}
        onOpenChange={(v) => !v && setConfirmDel(null)}
        title="Delete Purchase Order?"
        description={confirmDel ? `${confirmDel.poNumber} will be permanently removed.` : undefined}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={async () => {
          if (!confirmDel) return;
          try {
            await api(`/api/purchase-orders/${confirmDel.id}`, { method: "DELETE" });
            toast.success("Purchase Order deleted");
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
