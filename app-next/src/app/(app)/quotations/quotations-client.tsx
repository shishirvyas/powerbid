"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, Pencil, Plus, Printer, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, EmptyState } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QuotationStatusBadge } from "@/components/status-badges";
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

type Quotation = {
  id: number;
  quotationNo: string;
  quotationDate: string;
  status: string;
  currency: string;
  grandTotal: string;
  customerId: number;
  customerName: string | null;
  createdAt: string;
};

export function QuotationsClient() {
  const router = useRouter();
  const [search, setSearch] = React.useState("");
  const q = useDebounced(search, 300);
  const [limit, setLimit] = React.useState(25);
  const [offset, setOffset] = React.useState(0);
  React.useEffect(() => {
    setOffset(0);
  }, [q, limit]);

  const { data, loading, error, refresh } = useList<Quotation>("/api/quotations", { q, limit, offset });
  const [confirmDel, setConfirmDel] = React.useState<Quotation | null>(null);

  // Keyboard shortcut: N → new quotation
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
        router.push("/quotations/new");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  return (
    <div className="space-y-6 animate-in fade-in-50">
      <PageHeader
        title="Quotations"
        description="Build, send, and track quotations end-to-end."
        actions={
          <Button onClick={() => router.push("/quotations/new")}>
            <Plus className="h-4 w-4" /> New quotation
            <kbd className="ml-2 hidden sm:inline-flex items-center rounded border bg-background/40 px-1.5 text-[10px] font-mono">
              N
            </kbd>
          </Button>
        }
      />

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by quotation no, customer..."
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
          title={q ? "No quotations match" : "No quotations yet"}
          action={
            !q ? (
              <Button onClick={() => router.push("/quotations/new")}>
                <Plus className="h-4 w-4" /> New quotation
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="space-y-3">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quotation</TableHead>
                <TableHead className="hidden md:table-cell">Date</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && !data ? (
                <TableSkeleton cols={6} rows={5} />
              ) : (
                data?.rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className="cursor-pointer transition-colors hover:bg-muted/40"
                    onClick={(e) => {
                      // Don't navigate when clicking action buttons
                      if ((e.target as HTMLElement).closest("button, a")) return;
                      router.push(`/quotations/${row.id}`);
                    }}
                  >
                    <TableCell className="font-mono text-xs">{row.quotationNo}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm">{formatDate(row.quotationDate)}</TableCell>
                    <TableCell className="font-medium">{row.customerName || "—"}</TableCell>
                    <TableCell><QuotationStatusBadge status={row.status} /></TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(row.grandTotal, row.currency)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button asChild variant="ghost" size="icon" aria-label="Print">
                          <Link href={`/quotations/${row.id}/print`} target="_blank">
                            <Printer className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button asChild variant="ghost" size="icon" aria-label="View">
                          <Link href={`/quotations/${row.id}`}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button asChild variant="ghost" size="icon" aria-label="Edit">
                          <Link href={`/quotations/${row.id}/edit`}>
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
        title="Delete quotation?"
        description={confirmDel ? `${confirmDel.quotationNo} will be permanently removed.` : undefined}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={async () => {
          if (!confirmDel) return;
          try {
            await api(`/api/quotations/${confirmDel.id}`, { method: "DELETE" });
            toast.success("Quotation deleted");
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
