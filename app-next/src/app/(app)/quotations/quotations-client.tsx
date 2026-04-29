"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Eye, Loader2, Pencil, Plus, Printer, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState, PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { QuotationStatusBadge } from "@/components/status-badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TableSkeleton } from "@/components/table-skeleton";
import { api, ApiClientError } from "@/lib/api-client";
import { formatCurrency, formatDate } from "@/lib/calc";
import { useDebounced, useList, useResource } from "@/lib/hooks";

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

type QuotationDetail = {
  id: number;
  quotationNo: string;
  referenceNo: string | null;
  quotationDate: string;
  status: string;
  currency: string;
  grandTotal: string;
  customerId: number;
  customer: { id: number; name: string | null; code: string | null } | null;
  contact: { id: number; name: string | null; email: string | null; phone: string | null } | null;
  validityDays: number;
  subject: string | null;
  projectName: string | null;
  customerAttention: string | null;
  introText: string | null;
  inquiryId: number | null;
  contactPersonId: number | null;
  subjectTemplateId: number | null;
  paymentTerms: string | null;
  deliverySchedule: string | null;
  termsConditions: string | null;
  notes: string | null;
  signatureMode: "upload" | "draw" | "typed" | "blank" | null;
  signatureData: string | null;
  signatureName: string | null;
  signatureDesignation: string | null;
  signatureMobile: string | null;
  signatureEmail: string | null;
  items: Array<{
    id: number;
    productId: number | null;
    productName: string;
    unitName: string | null;
    qty: string;
    unitPrice: string;
    gstRate: string;
    gstSlabId: number | null;
  }>;
};

function toQuotationPayload(detail: QuotationDetail, patch: Partial<QuotationDetail>) {
  const next = { ...detail, ...patch };
  if (next.items.some((it) => !it.productId)) {
    throw new Error("Some line items are missing product IDs. Open full edit for this quotation.");
  }
  return {
    referenceNo: next.referenceNo,
    quotationDate: next.quotationDate,
    subject: next.subject,
    projectName: next.projectName,
    customerAttention: next.customerAttention,
    introText: next.introText,
    validityDays: Number(next.validityDays || 0),
    customerId: next.customerId,
    contactPersonId: next.contactPersonId,
    inquiryId: next.inquiryId,
    subjectTemplateId: next.subjectTemplateId,
    status: next.status,
    currency: next.currency,
    discountType: "percent" as const,
    discountValue: 0,
    freightAmount: 0,
    termsConditions: next.termsConditions,
    paymentTerms: next.paymentTerms,
    deliverySchedule: next.deliverySchedule,
    notes: next.notes,
    signatureMode: next.signatureMode,
    signatureData: next.signatureData,
    signatureName: next.signatureName,
    signatureDesignation: next.signatureDesignation,
    signatureMobile: next.signatureMobile,
    signatureEmail: next.signatureEmail,
    items: next.items.map((it) => ({
      productId: Number(it.productId),
      productName: it.productName,
      unitName: it.unitName,
      qty: Number(it.qty || 0),
      unitPrice: Number(it.unitPrice || 0),
      gstRate: Number(it.gstRate || 0),
      gstSlabId: it.gstSlabId,
    })),
  };
}

export function QuotationsClient() {
  const router = useRouter();
  const [search, setSearch] = React.useState("");
  const q = useDebounced(search, 250);
  const [limit, setLimit] = React.useState(50);
  const [offset, setOffset] = React.useState(0);
  const [selectedId, setSelectedId] = React.useState<number | null>(null);
  const [confirmDel, setConfirmDel] = React.useState<Quotation | null>(null);
  const [inlineEdit, setInlineEdit] = React.useState(false);
  const [subjectDraft, setSubjectDraft] = React.useState("");
  const [validityDraft, setValidityDraft] = React.useState("15");
  const [savingInline, setSavingInline] = React.useState(false);

  React.useEffect(() => {
    setOffset(0);
  }, [q, limit]);

  const { data, loading, error, refresh } = useList<Quotation>("/api/quotations", { q, limit, offset });
  const rows = data?.rows ?? [];

  React.useEffect(() => {
    if (!rows.length) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !rows.some((r) => r.id === selectedId)) {
      setSelectedId(rows[0]?.id ?? null);
    }
  }, [rows, selectedId]);

  const {
    data: selectedDetail,
    loading: detailLoading,
    error: detailError,
    refresh: refreshDetail,
  } = useResource<QuotationDetail>(selectedId ? `/api/quotations/${selectedId}` : null);

  React.useEffect(() => {
    if (!selectedDetail) return;
    setSubjectDraft(selectedDetail.subject ?? "");
    setValidityDraft(String(selectedDetail.validityDays ?? 15));
    setInlineEdit(false);
  }, [selectedDetail?.id]);

  const saveInline = React.useCallback(async () => {
    if (!selectedDetail) return;
    const validityDays = Number(validityDraft);
    if (!Number.isInteger(validityDays) || validityDays < 0 || validityDays > 365) {
      toast.error("Validity must be a whole number between 0 and 365");
      return;
    }
    setSavingInline(true);
    try {
      await api(`/api/quotations/${selectedDetail.id}`, {
        method: "PUT",
        json: toQuotationPayload(selectedDetail, {
          subject: subjectDraft || null,
          validityDays,
        }),
      });
      toast.success("Quotation updated");
      setInlineEdit(false);
      refresh();
      refreshDetail();
    } catch (e) {
      toast.error(e instanceof ApiClientError || e instanceof Error ? e.message : "Inline save failed");
    } finally {
      setSavingInline(false);
    }
  }, [refresh, refreshDetail, selectedDetail, subjectDraft, validityDraft]);

  return (
    <div className="space-y-4 animate-in fade-in-50">
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
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>
      ) : null}

      {!loading && data && rows.length === 0 ? (
        <EmptyState
          title={q ? "No quotations match" : "No quotations yet"}
          action={!q ? <Button onClick={() => router.push("/quotations/new")}>New quotation</Button> : null}
        />
      ) : (
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1.3fr)_minmax(22rem,0.9fr)]">
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
                  <TableSkeleton cols={6} rows={6} />
                ) : (
                  rows.map((row) => (
                    <TableRow
                      key={row.id}
                      className={[
                        "group cursor-pointer",
                        selectedId === row.id ? "bg-primary/5" : "",
                      ].join(" ")}
                      onClick={() => setSelectedId(row.id)}
                    >
                      <TableCell className="font-mono text-xs">{row.quotationNo}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm">{formatDate(row.quotationDate)}</TableCell>
                      <TableCell className="font-medium">{row.customerName || "-"}</TableCell>
                      <TableCell><QuotationStatusBadge status={row.status} /></TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(row.grandTotal, row.currency)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div
                          className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button asChild variant="ghost" size="icon" aria-label="Print">
                            <Link href={`/quotations/${row.id}/print`} target="_blank">
                              <Printer className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button asChild variant="ghost" size="icon" aria-label="Open full view">
                            <Link href={`/quotations/${row.id}`}>
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button asChild variant="ghost" size="icon" aria-label="Open full edit">
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

          <aside className="rounded-xl border bg-card p-3 md:p-4 xl:sticky xl:top-16 xl:h-fit">
            {!selectedId ? (
              <div className="text-sm text-muted-foreground">Select a quotation to view details.</div>
            ) : detailLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading quotation...
              </div>
            ) : detailError ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {detailError}
              </div>
            ) : selectedDetail ? (
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs text-muted-foreground">{selectedDetail.quotationNo}</div>
                    <div className="text-base font-medium">{selectedDetail.customer?.name || "Unknown customer"}</div>
                    <div className="text-xs text-muted-foreground">Date {formatDate(selectedDetail.quotationDate)}</div>
                  </div>
                  <QuotationStatusBadge status={selectedDetail.status} />
                </div>

                <div className="grid gap-2">
                  <div className="grid grid-cols-[6rem_minmax(0,1fr)] items-center gap-2 rounded-md bg-muted/25 px-2 py-1.5 text-sm">
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">Total</span>
                    <span className="font-medium tabular-nums">{formatCurrency(selectedDetail.grandTotal, selectedDetail.currency)}</span>
                  </div>
                  <div className="grid grid-cols-[6rem_minmax(0,1fr)] items-center gap-2 rounded-md bg-muted/25 px-2 py-1.5 text-sm">
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">Reference</span>
                    <span>{selectedDetail.referenceNo || "-"}</span>
                  </div>
                </div>

                <div className="rounded-md border p-2.5">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Inline edit</div>
                    {!inlineEdit ? (
                      <Button size="sm" variant="outline" onClick={() => setInlineEdit(true)}>
                        <Pencil className="h-4 w-4" /> Edit
                      </Button>
                    ) : (
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={saveInline} disabled={savingInline}>
                          {savingInline ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 text-emerald-600" />}
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            setInlineEdit(false);
                            setSubjectDraft(selectedDetail.subject ?? "");
                            setValidityDraft(String(selectedDetail.validityDays ?? 15));
                          }}
                          disabled={savingInline}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div>
                      <div className="mb-1 text-xs text-muted-foreground">Subject</div>
                      {inlineEdit ? (
                        <Input value={subjectDraft} onChange={(e) => setSubjectDraft(e.target.value)} />
                      ) : (
                        <div className="text-sm">{selectedDetail.subject || "-"}</div>
                      )}
                    </div>
                    <div>
                      <div className="mb-1 text-xs text-muted-foreground">Validity (days)</div>
                      {inlineEdit ? (
                        <Input value={validityDraft} onChange={(e) => setValidityDraft(e.target.value)} />
                      ) : (
                        <div className="text-sm">{selectedDetail.validityDays}</div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Items ({selectedDetail.items.length})</div>
                  <div className="max-h-52 overflow-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Item</TableHead>
                          <TableHead className="text-right">Qty</TableHead>
                          <TableHead className="text-right">Rate</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedDetail.items.map((it) => (
                          <TableRow key={it.id}>
                            <TableCell className="text-sm">{it.productName}</TableCell>
                            <TableCell className="text-right tabular-nums">{it.qty}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatCurrency(it.unitPrice, selectedDetail.currency)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            ) : null}
          </aside>
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
