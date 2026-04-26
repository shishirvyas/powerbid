"use client";

import * as React from "react";
import { useResource } from "@/lib/hooks";
import { formatCurrency, formatDate, formatNumber } from "@/lib/calc";
import { BrandLogo } from "@/components/brand-logo";
import { COMPANY_NAME, COMPANY_TAGLINE } from "@/lib/branding";
import {
  DEFAULT_COMMERCIAL_TERMS,
  DEFAULT_ENCLOSURES,
  DEFAULT_INTRO_PARAGRAPH,
  DEFAULT_SIGNATURE_BLOCK,
  DEFAULT_SUBJECT,
} from "@/lib/quotation-templates";
import { collectQtyColumns, parseQtyBreakup } from "@/lib/quotation-format";

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
  signatureMode: "upload" | "draw" | "typed" | null;
  signatureData: string | null;
  signatureName: string | null;
  signatureDesignation: string | null;
  signatureMobile: string | null;
  signatureEmail: string | null;
  customer: {
    name: string;
    addressLine1: string | null;
    addressLine2: string | null;
    city: string | null;
    state: string | null;
    pincode: string | null;
    email: string | null;
    phone: string | null;
    gstin: string | null;
  } | null;
  items: {
    id: number;
    productName: string;
    unitName: string | null;
    qtyBreakup: string | null;
    qty: string;
    unitPrice: string;
    discountPercent: string;
    gstRate: string;
    lineSubtotal: string;
    lineGst: string;
    lineTotal: string;
  }[];
};

function customerAddress(c: QuotationDetail["customer"]): string[] {
  if (!c) return [];
  const cityLine = [c.city, c.state, c.pincode].filter(Boolean).join(" ");
  return [c.addressLine1, c.addressLine2, cityLine].filter(Boolean) as string[];
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const { data, loading, error } = useResource<QuotationDetail>(`/api/quotations/${id}`);

  const qtyColumns = React.useMemo(() => collectQtyColumns(data?.items.map((it) => it.qtyBreakup) ?? []), [data]);

  if (error) return <div style={{ padding: 24 }}>Error: {error}</div>;
  if (loading || !data) return <div style={{ padding: 24 }}>Loading...</div>;

  const c = data.customer;
  const addresses = customerAddress(c);
  const subject = data.subject || DEFAULT_SUBJECT;
  const intro = data.introText || DEFAULT_INTRO_PARAGRAPH;
  const referenceNo = data.referenceNo || data.quotationNo;
  const signerLines = [data.signatureName, data.signatureDesignation, data.signatureMobile, data.signatureEmail].filter(Boolean) as string[];

  return (
    <div className="print-root">
      <style>{`
        @page { size: A4 portrait; margin: 12mm; }
        @media print {
          html, body { background: #ffffff !important; }
          .no-print { display: none !important; }
          .page { page-break-after: always; }
          .page:last-child { page-break-after: auto; }
        }
        .print-root {
          --background: 0 0% 100%;
          --foreground: 222 47% 11%;
          --card: 0 0% 100%;
          --card-foreground: 222 47% 11%;
          --popover: 0 0% 100%;
          --popover-foreground: 222 47% 11%;
          --primary-foreground: 0 0% 100%;
          --secondary: 210 40% 96%;
          --secondary-foreground: 222 47% 11%;
          --muted: 210 40% 96%;
          --muted-foreground: 215 16% 47%;
          --accent: 210 40% 94%;
          --accent-foreground: 222 47% 11%;
          --border: 214 32% 91%;
          color-scheme: light;
          font-family: Inter, system-ui, sans-serif;
          color: #171717;
          background: #ffffff;
          max-width: 900px;
          margin: 0 auto;
          padding: 20px;
        }
        .print-root, .print-root * { color: inherit; }
        .print-root .text-foreground { color: #111827 !important; }
        .print-root .text-muted-foreground { color: #6b7280 !important; }
        .toolbar { display: flex; justify-content: flex-end; gap: 8px; margin-bottom: 10px; }
        .toolbar button { border: 1px solid #222; background: #fff; color: #222; padding: 6px 12px; border-radius: 4px; font-size: 12px; cursor: pointer; }
        .toolbar button.primary { background: #111; color: #fff; }

        .page {
          min-height: calc(297mm - 24mm);
          background: #ffffff;
          color: #171717;
          display: flex;
          flex-direction: column;
        }
        .page-body { flex: 1 1 auto; }
        .letter-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; border-bottom: 1px solid #d7d7d7; padding-bottom: 10px; }
        .meta { font-size: 12px; color: #4b4b4b; line-height: 1.5; text-align: right; }

        .to-block { font-size: 13px; line-height: 1.7; margin-bottom: 18px; }
        .to-block .label { color: #555; text-transform: uppercase; letter-spacing: 0.04em; font-size: 11px; }

        .subject { font-size: 14px; margin: 12px 0; }
        .subject b { color: #111; }

        .body-copy { font-size: 13px; line-height: 1.8; margin-top: 10px; white-space: pre-wrap; }
        .signoff { margin-top: 22px; font-size: 13px; line-height: 1.8; white-space: pre-wrap; }
        .signature-img { margin-top: 6px; max-height: 72px; object-fit: contain; }
        .signature-typed { margin-top: 6px; font-size: 28px; font-family: cursive; line-height: 1.2; }
        .enclosures { margin-top: 18px; font-size: 12px; }
        .enclosures ol { margin: 6px 0 0 16px; padding: 0; }

        .section-title { text-transform: uppercase; letter-spacing: 0.05em; font-size: 12px; color: #555; margin-bottom: 8px; }
        table.schedule { width: 100%; border-collapse: collapse; font-size: 12px; }
        table.schedule th, table.schedule td { border: 1px solid #d9d9d9; padding: 7px 6px; vertical-align: top; }
        table.schedule thead { display: table-header-group; }
        table.schedule th { background: #f6f6f6; font-weight: 600; }
        table.schedule td.num, table.schedule th.num { text-align: right; font-variant-numeric: tabular-nums; }

        .totals { width: 320px; margin-left: auto; margin-top: 14px; font-size: 12px; }
        .totals .row { display: flex; justify-content: space-between; padding: 4px 0; }
        .totals .grand { border-top: 2px solid #222; margin-top: 6px; padding-top: 7px; font-size: 14px; font-weight: 700; }

        .commercial { margin-top: 18px; font-size: 12px; line-height: 1.7; }
        .footer-note { margin-top: auto; border-top: 1px solid #ddd; padding-top: 8px; font-size: 11px; color: #666; display: flex; justify-content: space-between; }
      `}</style>

      <div className="toolbar no-print">
        <button onClick={() => window.print()}>Preview</button>
        <button onClick={() => window.open(`/api/quotations/${id}/pdf`, "_blank")}>Download PDF</button>
        <button className="primary" onClick={() => window.print()}>Print</button>
      </div>

      <section className="page">
        <div className="page-body">
          <div className="letter-header">
            <div>
              <BrandLogo />
              <div style={{ marginTop: 2, fontSize: 11, color: "#5b5b5b" }}>{COMPANY_TAGLINE}</div>
            </div>
            <div className="meta">
              <div><b>Ref No:</b> {referenceNo}</div>
              <div><b>Date:</b> {formatDate(data.quotationDate)}</div>
              <div><b>Status:</b> {data.status.toUpperCase()}</div>
            </div>
          </div>

          <div className="to-block">
            <div className="label">To</div>
            <div><b>M/s {c?.name || "Customer"}</b></div>
            {addresses.map((line, idx) => (<div key={idx}>{line}</div>))}
            {data.customerAttention ? <div><b>Kind Attention:</b> {data.customerAttention}</div> : null}
          </div>

          <div className="subject"><b>Subject:</b> {subject}{data.projectName ? ` - ${data.projectName}` : ""}</div>

          <div className="body-copy">Dear Sir,\n\n{intro}</div>

          <div className="signoff">{DEFAULT_SIGNATURE_BLOCK}</div>
          {data.signatureMode && data.signatureMode !== "typed" && data.signatureData ? (
            <img src={data.signatureData} alt="Signature" className="signature-img" />
          ) : null}
          {data.signatureMode === "typed" && data.signatureData ? (
            <div className="signature-typed">{data.signatureData}</div>
          ) : null}
          <div className="body-copy" style={{ marginTop: 8 }}>
            {signerLines.length ? signerLines.join("\n") : "Authorized Signatory"}
          </div>

          <div className="enclosures">
            <div><b>Enclosures:</b></div>
            <ol>
              {DEFAULT_ENCLOSURES.map((entry) => (
                <li key={entry}>{entry}</li>
              ))}
            </ol>
          </div>
        </div>

        <div className="footer-note">
          <span>{COMPANY_NAME}</span>
          <span>Page 1</span>
        </div>
      </section>

      <section className="page">
        <div className="page-body">
          <div className="section-title">Price Schedule</div>
          <table className="schedule">
            <thead>
              <tr>
                <th style={{ width: 36 }}>Sr</th>
                <th>Description of Materials</th>
                <th>Unit</th>
                {qtyColumns.map((col) => (
                  <th key={col} className="num">{col}</th>
                ))}
                <th className="num">Total Qty</th>
                <th className="num">Price Per Unit</th>
                <th className="num">Amount</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((it, idx) => {
                const split = parseQtyBreakup(it.qtyBreakup);
                return (
                  <tr key={it.id}>
                    <td>{idx + 1}</td>
                    <td>{it.productName}</td>
                    <td>{it.unitName || "-"}</td>
                    {qtyColumns.map((col) => (
                      <td key={col} className="num">{split[col] ? formatNumber(split[col], 2) : "-"}</td>
                    ))}
                    <td className="num">{formatNumber(it.qty, 2)}</td>
                    <td className="num">{formatCurrency(it.unitPrice, data.currency)}</td>
                    <td className="num">{formatCurrency(it.lineTotal, data.currency)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="totals">
            <div className="row"><span>Subtotal</span><span>{formatCurrency(data.subtotal, data.currency)}</span></div>
            <div className="row"><span>Discount</span><span>- {formatCurrency(data.discountAmount, data.currency)}</span></div>
            <div className="row"><span>Taxable</span><span>{formatCurrency(data.taxableAmount, data.currency)}</span></div>
            <div className="row"><span>GST</span><span>{formatCurrency(data.gstAmount, data.currency)}</span></div>
            <div className="row"><span>Freight</span><span>{formatCurrency(data.freightAmount, data.currency)}</span></div>
            <div className="row grand"><span>Grand Total</span><span>{formatCurrency(data.grandTotal, data.currency)}</span></div>
          </div>

          <div className="section-title" style={{ marginTop: 20 }}>Commercial Terms & Conditions</div>
          <div className="commercial">
            <div style={{ whiteSpace: "pre-wrap" }}>
              {data.termsConditions || DEFAULT_COMMERCIAL_TERMS}
            </div>
            {data.paymentTerms ? <div style={{ marginTop: 8 }}><b>Payment Terms:</b> {data.paymentTerms}</div> : null}
            {data.deliverySchedule ? <div style={{ marginTop: 4 }}><b>Delivery:</b> {data.deliverySchedule}</div> : null}
          </div>

          <div className="signoff">{DEFAULT_SIGNATURE_BLOCK}</div>
          {data.signatureMode && data.signatureMode !== "typed" && data.signatureData ? (
            <img src={data.signatureData} alt="Signature" className="signature-img" />
          ) : null}
          {data.signatureMode === "typed" && data.signatureData ? (
            <div className="signature-typed">{data.signatureData}</div>
          ) : null}
          <div className="body-copy" style={{ marginTop: 8 }}>
            {signerLines.length ? signerLines.join("\n") : "Authorized Signatory"}
          </div>
        </div>

        <div className="footer-note">
          <span>{COMPANY_NAME}</span>
          <span>Page 2</span>
        </div>
      </section>
    </div>
  );
}
