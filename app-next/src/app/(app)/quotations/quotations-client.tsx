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
  const { data, loading, error, refresh } = useList<Quotation>("/api/quotations", { q, limit: 100 });
  const [confirmDel, setConfirmDel] = React.useState<Quotation | null>(null);

  return (
    <div className="space-y-6 animate-in fade-in-50">
      <PageHeader
        title="Quotations"
        description="Build, send, and track quotations end-to-end."
        actions={
          <Button onClick={() => router.push("/quotations/new")}>
            <Plus className="h-4 w-4" /> New quotation
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
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                  Loading...
                </TableCell>
              </TableRow>
            ) : (
              data?.rows.map((q) => (
                <TableRow key={q.id}>
                  <TableCell className="font-mono text-xs">{q.quotationNo}</TableCell>
                  <TableCell className="hidden md:table-cell text-sm">{formatDate(q.quotationDate)}</TableCell>
                  <TableCell className="font-medium">{q.customerName || "—"}</TableCell>
                  <TableCell><QuotationStatusBadge status={q.status} /></TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(q.grandTotal, q.currency)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button asChild variant="ghost" size="icon" aria-label="Print">
                        <Link href={`/quotations/${q.id}/print`} target="_blank">
                          <Printer className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button asChild variant="ghost" size="icon" aria-label="View">
                        <Link href={`/quotations/${q.id}`}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button asChild variant="ghost" size="icon" aria-label="Edit">
                        <Link href={`/quotations/${q.id}/edit`}>
                          <Pencil className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setConfirmDel(q)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
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
