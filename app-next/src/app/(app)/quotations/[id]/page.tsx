"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Pencil, Printer } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { QuotationStatusBadge } from "@/components/status-badges";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useResource } from "@/lib/hooks";
import { formatCurrency, formatDate } from "@/lib/calc";

type QuotationDetail = {
  id: number;
  quotationNo: string;
  quotationDate: string;
  validityDays: number;
  status: string;
  currency: string;
  subtotal: string;
  discountAmount: string;
  taxableAmount: string;
  gstAmount: string;
  freightAmount: string;
  grandTotal: string;
  termsConditions: string | null;
  paymentTerms: string | null;
  deliverySchedule: string | null;
  notes: string | null;
  customer: {
    id: number;
    code: string;
    name: string;
    email: string | null;
    phone: string | null;
    addressLine1: string | null;
    addressLine2: string | null;
    city: string | null;
    state: string | null;
    pincode: string | null;
    gstin: string | null;
  } | null;
  items: {
    id: number;
    productName: string;
    unitName: string | null;
    qty: string;
    unitPrice: string;
    discountPercent: string;
    gstRate: string;
    lineSubtotal: string;
    lineGst: string;
    lineTotal: string;
  }[];
};

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const { data, loading, error } = useResource<QuotationDetail>(`/api/quotations/${id}`);

  if (error) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        {error}
      </div>
    );
  }
  if (loading || !data) {
    return <div className="text-sm text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in-50">
      <PageHeader
        title={data.quotationNo}
        description={`Dated ${formatDate(data.quotationDate)} · valid ${data.validityDays} days`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/quotations">
                <ArrowLeft className="h-4 w-4" /> Back
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/quotations/${id}/print`} target="_blank">
                <Printer className="h-4 w-4" /> Print
              </Link>
            </Button>
            <Button asChild>
              <Link href={`/quotations/${id}/edit`}>
                <Pencil className="h-4 w-4" /> Edit
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Customer</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {data.customer ? (
              <>
                <div className="font-semibold">{data.customer.name}</div>
                <div className="text-muted-foreground">
                  {[data.customer.addressLine1, data.customer.addressLine2, data.customer.city, data.customer.state, data.customer.pincode]
                    .filter(Boolean)
                    .join(", ") || "—"}
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {data.customer.email ? <span>{data.customer.email}</span> : null}
                  {data.customer.phone ? <span>{data.customer.phone}</span> : null}
                  {data.customer.gstin ? <span>GSTIN: {data.customer.gstin}</span> : null}
                </div>
              </>
            ) : (
              "—"
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status</CardTitle>
          </CardHeader>
          <CardContent>
            <QuotationStatusBadge status={data.status} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Line items</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Unit price</TableHead>
                <TableHead className="text-right">Disc %</TableHead>
                <TableHead className="text-right">GST %</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((it, i) => (
                <TableRow key={it.id}>
                  <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                  <TableCell>
                    <div className="font-medium">{it.productName}</div>
                    {it.unitName ? (
                      <div className="text-xs text-muted-foreground">{it.unitName}</div>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{Number(it.qty).toLocaleString("en-IN")}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(it.unitPrice, data.currency)}</TableCell>
                  <TableCell className="text-right tabular-nums">{Number(it.discountPercent).toFixed(2)}</TableCell>
                  <TableCell className="text-right tabular-nums">{Number(it.gstRate).toFixed(2)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(it.lineTotal, data.currency)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Terms</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Section title="Payment terms" body={data.paymentTerms} />
            <Section title="Delivery schedule" body={data.deliverySchedule} />
            <Section title="Terms & conditions" body={data.termsConditions} />
            <Section title="Notes" body={data.notes} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Totals</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2 text-sm">
              <Row label="Subtotal" value={formatCurrency(data.subtotal, data.currency)} />
              <Row label="Discount" value={`− ${formatCurrency(data.discountAmount, data.currency)}`} />
              <Row label="Taxable" value={formatCurrency(data.taxableAmount, data.currency)} />
              <Row label="GST" value={formatCurrency(data.gstAmount, data.currency)} />
              <Row label="Freight" value={formatCurrency(data.freightAmount, data.currency)} />
              <div className="my-2 h-px bg-border" />
              <Row label="Grand total" value={formatCurrency(data.grandTotal, data.currency)} strong />
            </dl>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Section({ title, body }: { title: string; body: string | null }) {
  if (!body) return null;
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{title}</div>
      <p className="whitespace-pre-wrap">{body}</p>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${strong ? "text-base font-semibold" : ""}`}>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
