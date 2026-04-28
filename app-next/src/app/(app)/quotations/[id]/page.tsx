"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Download, Eye, Loader2, Mail, MessageCircle, Pencil, Printer } from "lucide-react";
import { PdfPreviewDialog } from "@/components/pdf-preview-dialog";
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
import { api, ApiClientError } from "@/lib/api-client";
import { useResource } from "@/lib/hooks";
import { formatCurrency, formatDate } from "@/lib/calc";
import { toast } from "sonner";

type QuotationDetail = {
  id: number;
  quotationNo: string;
  referenceNo: string | null;
  quotationDate: string;
  subject: string | null;
  projectName: string | null;
  customerAttention: string | null;
  introText: string | null;
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
  signatureMode: "upload" | "draw" | "typed" | "blank" | null;
  signatureData: string | null;
  signatureName: string | null;
  signatureDesignation: string | null;
  signatureMobile: string | null;
  signatureEmail: string | null;
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

type DispatchLog = {
  id: number;
  channel: string;
  status: string;
  recipient: string;
  subject: string | null;
  error: string | null;
  createdAt: string;
};

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const { data, loading, error, refresh } = useResource<QuotationDetail>(`/api/quotations/${id}`);
  const { data: dispatchLogs, refresh: refreshLogs } = useResource<DispatchLog[]>(`/api/quotations/${id}/dispatch`);
  const [sending, setSending] = React.useState<"email" | "whatsapp" | null>(null);
  const [pdfPreviewOpen, setPdfPreviewOpen] = React.useState(false);

  async function sendEmail() {
    if (!data) return;
    const to = window.prompt("Recipient email", data.customer?.email || data.signatureEmail || "");
    if (!to) return;
    const subject = window.prompt("Email subject", data.subject || `Quotation ${data.referenceNo || data.quotationNo}`) || undefined;
    try {
      setSending("email");
      await api(`/api/quotations/${id}/dispatch`, {
        method: "POST",
        json: {
          channel: "email",
          to,
          subject,
          attachPdf: true,
        },
      });
      toast.success("Quotation emailed successfully");
      refresh();
      refreshLogs();
    } catch (e: unknown) {
      toast.error(e instanceof ApiClientError ? e.message : "Email send failed");
    } finally {
      setSending(null);
    }
  }

  async function sendWhatsApp() {
    if (!data) return;
    const to = window.prompt("WhatsApp number (with country code)", data.customer?.phone || data.signatureMobile || "");
    if (!to) return;
    const message = window.prompt("Message", `Please find our quotation ${data.referenceNo || data.quotationNo}.`) || undefined;
    try {
      setSending("whatsapp");
      const res = await api<{ whatsappUrl?: string }>(`/api/quotations/${id}/dispatch`, {
        method: "POST",
        json: {
          channel: "whatsapp",
          to,
          message,
          attachPdf: true,
        },
      });
      if (res.whatsappUrl) window.open(res.whatsappUrl, "_blank");
      toast.success("WhatsApp message prepared");
      refresh();
      refreshLogs();
    } catch (e: unknown) {
      toast.error(e instanceof ApiClientError ? e.message : "WhatsApp send failed");
    } finally {
      setSending(null);
    }
  }

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
    <>
    <div className="space-y-6 animate-in fade-in-50">
      <PageHeader
        title={data.referenceNo || data.quotationNo}
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
            <Button variant="outline" onClick={() => setPdfPreviewOpen(true)}>
              <Eye className="h-4 w-4" /> Preview PDF
            </Button>
            <Button asChild variant="outline">
              <Link href={`/api/quotations/${id}/pdf`} download>
                <Download className="h-4 w-4" /> Download PDF
              </Link>
            </Button>
            <Button variant="outline" onClick={sendEmail} disabled={sending !== null}>
              {sending === "email" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />} Send Email
            </Button>
            <Button variant="outline" onClick={sendWhatsApp} disabled={sending !== null}>
              {sending === "whatsapp" ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />} Send WhatsApp
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
            {data.subject ? <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">{data.subject}</div> : null}
            {data.projectName ? <div className="mb-2 font-medium">Project: {data.projectName}</div> : null}
            {data.customer ? (
              <>
                <div className="font-semibold">{data.customer.name}</div>
                {data.customerAttention ? <div className="text-xs text-muted-foreground">Kind Attention: {data.customerAttention}</div> : null}
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
            {data.introText ? <p className="mt-3 whitespace-pre-wrap text-muted-foreground">{data.introText}</p> : null}
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
            {data.signatureMode !== "blank" ? (
              <Section title="Signatory" body={[
                data.signatureName,
                data.signatureDesignation,
                data.signatureMobile,
                data.signatureEmail,
              ].filter(Boolean).join("\n") || null} />
            ) : null}
            {data.signatureMode && data.signatureMode !== "typed" && data.signatureData ? (
              <img src={data.signatureData} alt="Signature" className="max-h-16 object-contain" />
            ) : null}
            {data.signatureMode === "typed" && data.signatureData ? (
              <div className="text-2xl" style={{ fontFamily: "cursive" }}>{data.signatureData}</div>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Totals</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2 text-sm">
              <Row label="Subtotal" value={formatCurrency(data.subtotal, data.currency)} />
              <Row label="Taxable" value={formatCurrency(data.taxableAmount, data.currency)} />
              <Row label="GST" value={formatCurrency(data.gstAmount, data.currency)} />
              <div className="my-2 h-px bg-border" />
              <Row label="Grand total" value={formatCurrency(data.grandTotal, data.currency)} strong />
            </dl>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dispatch history</CardTitle>
        </CardHeader>
        <CardContent>
          {!dispatchLogs || dispatchLogs.length === 0 ? (
            <div className="text-sm text-muted-foreground">No send attempts yet.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Recipient</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dispatchLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>{formatDate(log.createdAt)}</TableCell>
                    <TableCell className="capitalize">{log.channel}</TableCell>
                    <TableCell>{log.recipient}</TableCell>
                    <TableCell className="capitalize">{log.status}</TableCell>
                    <TableCell className="text-destructive">{log.error || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>

    <PdfPreviewDialog
      open={pdfPreviewOpen}
      onClose={() => setPdfPreviewOpen(false)}
      label={data.referenceNo || data.quotationNo}
      pdfRoute={`/api/quotations/${id}/pdf`}
    />
    </>
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
