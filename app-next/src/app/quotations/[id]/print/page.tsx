"use client";

import * as React from "react";
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

  React.useEffect(() => {
    if (data) {
      const t = setTimeout(() => window.print(), 400);
      return () => clearTimeout(t);
    }
  }, [data]);

  if (error) return <div style={{ padding: 24 }}>Error: {error}</div>;
  if (loading || !data) return <div style={{ padding: 24 }}>Loading...</div>;

  const c = data.customer;
  const addr = c
    ? [c.addressLine1, c.addressLine2, [c.city, c.state, c.pincode].filter(Boolean).join(" ")]
        .filter(Boolean)
        .join(", ")
    : "";

  return (
    <div className="print-root">
      <style>{`
        @page { size: A4; margin: 14mm; }
        @media print { .no-print { display: none; } }
        .print-root { font-family: Inter, system-ui, sans-serif; color: #111; padding: 24px; max-width: 900px; margin: 0 auto; }
        .print-root h1 { font-size: 24px; margin: 0; }
        .print-root h2 { font-size: 14px; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.05em; color: #555; }
        .row { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; }
        .meta { font-size: 12px; color: #555; }
        table.lines { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 12px; }
        table.lines th, table.lines td { border-bottom: 1px solid #ddd; padding: 8px 6px; text-align: left; }
        table.lines th { background: #f5f5f5; font-weight: 600; }
        table.lines td.num, table.lines th.num { text-align: right; font-variant-numeric: tabular-nums; }
        .totals { width: 320px; margin-left: auto; margin-top: 16px; font-size: 13px; }
        .totals .t { display: flex; justify-content: space-between; padding: 4px 0; }
        .totals .grand { border-top: 2px solid #111; margin-top: 8px; padding-top: 8px; font-weight: 700; font-size: 15px; }
        .terms { margin-top: 24px; font-size: 12px; color: #333; }
        .terms h3 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #555; margin: 12px 0 4px; }
        .terms p { margin: 0; white-space: pre-wrap; }
        .actions { text-align: right; margin-bottom: 12px; }
        .actions button { background: #111; color: #fff; border: 0; padding: 6px 12px; font-size: 12px; cursor: pointer; border-radius: 4px; }
      `}</style>

      <div className="actions no-print">
        <button onClick={() => window.print()}>Print / Save PDF</button>
      </div>

      <div className="row" style={{ marginBottom: 16 }}>
        <div>
          <h1>QUOTATION</h1>
          <div className="meta" style={{ marginTop: 4 }}>{data.quotationNo}</div>
        </div>
        <div style={{ textAlign: "right" }} className="meta">
          <div>Date: {formatDate(data.quotationDate)}</div>
          <div>Validity: {data.validityDays} days</div>
          <div>Status: {data.status.toUpperCase()}</div>
        </div>
      </div>

      <div className="row" style={{ marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <h2>Bill to</h2>
          {c ? (
            <>
              <div style={{ fontWeight: 600 }}>{c.name}</div>
              {addr ? <div className="meta">{addr}</div> : null}
              <div className="meta" style={{ marginTop: 4 }}>
                {c.email ? <span>{c.email}</span> : null}
                {c.phone ? <span> · {c.phone}</span> : null}
              </div>
              {c.gstin ? <div className="meta">GSTIN: {c.gstin}</div> : null}
            </>
          ) : (
            "—"
          )}
        </div>
      </div>

      <table className="lines">
        <thead>
          <tr>
            <th style={{ width: 32 }}>#</th>
            <th>Description</th>
            <th className="num">Qty</th>
            <th className="num">Unit price</th>
            <th className="num">Disc %</th>
            <th className="num">GST %</th>
            <th className="num">Amount</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((it, i) => (
            <tr key={it.id}>
              <td>{i + 1}</td>
              <td>
                <div>{it.productName}</div>
                {it.unitName ? <div style={{ color: "#777", fontSize: 11 }}>{it.unitName}</div> : null}
              </td>
              <td className="num">{Number(it.qty).toLocaleString("en-IN")}</td>
              <td className="num">{formatCurrency(it.unitPrice, data.currency)}</td>
              <td className="num">{Number(it.discountPercent).toFixed(2)}</td>
              <td className="num">{Number(it.gstRate).toFixed(2)}</td>
              <td className="num">{formatCurrency(it.lineTotal, data.currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="totals">
        <div className="t"><span>Subtotal</span><span>{formatCurrency(data.subtotal, data.currency)}</span></div>
        <div className="t"><span>Discount</span><span>− {formatCurrency(data.discountAmount, data.currency)}</span></div>
        <div className="t"><span>Taxable</span><span>{formatCurrency(data.taxableAmount, data.currency)}</span></div>
        <div className="t"><span>GST</span><span>{formatCurrency(data.gstAmount, data.currency)}</span></div>
        <div className="t"><span>Freight</span><span>{formatCurrency(data.freightAmount, data.currency)}</span></div>
        <div className="t grand"><span>Grand total</span><span>{formatCurrency(data.grandTotal, data.currency)}</span></div>
      </div>

      <div className="terms">
        {data.paymentTerms ? <><h3>Payment terms</h3><p>{data.paymentTerms}</p></> : null}
        {data.deliverySchedule ? <><h3>Delivery schedule</h3><p>{data.deliverySchedule}</p></> : null}
        {data.termsConditions ? <><h3>Terms &amp; conditions</h3><p>{data.termsConditions}</p></> : null}
      </div>
    </div>
  );
}
