import type { Env } from "../env";
import { eq } from "drizzle-orm";
import { getDb } from "../db/client";
import { quotations, quotationItems, customers } from "../db/schema";
import { amountInWordsINR } from "../modules/quotations/quotations.calc";

// Generate a quotation PDF using Cloudflare Browser Rendering.
// Requires `[browser] binding = "BROWSER"` in wrangler config and Workers Paid plan.
export async function renderQuotationPdf(env: Env, quotationId: number): Promise<ArrayBuffer> {
  const html = await buildQuotationHtml(env, quotationId);

  // Lazy import to keep cold start small.
  // @ts-ignore - puppeteer types provided by @cloudflare/puppeteer at runtime
  const puppeteer = await import("@cloudflare/puppeteer").catch(() => null);
  if (!puppeteer || !env.BROWSER) {
    // Local-dev fallback: a tiny placeholder PDF.
    return new TextEncoder().encode(
      `%PDF-1.4\n% Placeholder for quotation #${quotationId}\n`,
    ).buffer;
  }
  const browser = await puppeteer.launch(env.BROWSER);
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle0" });
  const pdf = await page.pdf({
    format: "A4",
    printBackground: true,
    margin: { top: "20mm", right: "16mm", bottom: "20mm", left: "16mm" },
  });
  await browser.close();
  return pdf;
}

async function buildQuotationHtml(env: Env, id: number): Promise<string> {
  const db = getDb(env.DB);
  const [row] = await db
    .select()
    .from(quotations)
    .leftJoin(customers, eq(customers.id, quotations.customerId))
    .where(eq(quotations.id, id))
    .limit(1);
  if (!row) return `<html><body>Quotation ${id} not found</body></html>`;
  const items = await db
    .select()
    .from(quotationItems)
    .where(eq(quotationItems.quotationId, id))
    .orderBy(quotationItems.sortOrder);

  const q = row.quotations;
  const cust = row.customers;
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

  const itemsHtml = items
    .map(
      (it, idx) => `
    <tr>
      <td>${idx + 1}</td>
      <td>
        <div class="pname">${escape(it.productName)}</div>
        ${it.description ? `<div class="pdesc">${escape(it.description)}</div>` : ""}
      </td>
      <td class="num">${fmt(it.qty)}${it.unitName ? ` ${escape(it.unitName)}` : ""}</td>
      <td class="num">${fmt(it.unitPrice)}</td>
      <td class="num">${fmt(it.discountPercent)}%</td>
      <td class="num">${fmt(it.gstRate)}%</td>
      <td class="num">${fmt(it.lineTotal)}</td>
    </tr>`,
    )
    .join("");

  return `<!doctype html>
<html><head><meta charset="utf-8" /><title>${escape(q.quotationNo)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Inter', system-ui, -apple-system, sans-serif; color: #0F172A; font-size: 12px; margin: 0; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 16px; border-bottom: 3px solid #1E40AF; }
  .brand { color: #1E40AF; font-size: 22px; font-weight: 700; letter-spacing: -0.02em; }
  .brand small { display: block; color: #64748B; font-weight: 500; font-size: 11px; letter-spacing: .12em; text-transform: uppercase; margin-top: 4px; }
  .meta { text-align: right; font-size: 11px; color: #475569; }
  .meta .qno { font-size: 16px; color: #0F172A; font-weight: 700; }
  .row { display: flex; gap: 24px; margin: 18px 0; }
  .card { flex: 1; padding: 12px 14px; background: #F8FAFC; border-radius: 8px; border-left: 3px solid #1E40AF; }
  .card h4 { margin: 0 0 6px; font-size: 10px; letter-spacing: .12em; text-transform: uppercase; color: #64748B; }
  .card .name { font-weight: 600; font-size: 13px; }
  table.items { width: 100%; border-collapse: collapse; margin-top: 8px; }
  table.items th { background: #1E40AF; color: white; padding: 8px 10px; font-size: 11px; text-align: left; font-weight: 600; }
  table.items th.num, table.items td.num { text-align: right; }
  table.items td { padding: 10px; border-bottom: 1px solid #E2E8F0; vertical-align: top; }
  .pname { font-weight: 600; }
  .pdesc { color: #64748B; font-size: 11px; margin-top: 2px; }
  .totals { margin-top: 18px; display: flex; justify-content: flex-end; }
  .totals table { min-width: 280px; border-collapse: collapse; }
  .totals td { padding: 6px 12px; }
  .totals .lbl { color: #475569; }
  .totals .grand td { background: #1E40AF; color: white; font-weight: 700; font-size: 14px; padding: 10px 12px; }
  .words { margin-top: 10px; font-style: italic; color: #475569; font-size: 11px; }
  .terms { margin-top: 24px; padding: 12px 14px; background: #F8FAFC; border-radius: 8px; font-size: 11px; white-space: pre-wrap; }
  .terms h4 { margin: 0 0 6px; font-size: 10px; letter-spacing: .12em; text-transform: uppercase; color: #64748B; }
  .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #E2E8F0; color: #94A3B8; font-size: 10px; text-align: center; }
</style></head>
<body>
  <div class="head">
    <div>
      <div class="brand">${escape(env.MAIL_FROM_NAME || "PowerBid")}<small>Quotation</small></div>
    </div>
    <div class="meta">
      <div class="qno">${escape(q.quotationNo)}</div>
      <div>Date: ${escape(q.quotationDate)}</div>
      <div>Valid for: ${q.validityDays} days</div>
      <div>Status: ${escape(q.status.toUpperCase())}</div>
    </div>
  </div>

  <div class="row">
    <div class="card">
      <h4>Bill To</h4>
      <div class="name">${escape(cust?.name ?? "—")}</div>
      ${cust?.contactPerson ? `<div>${escape(cust.contactPerson)}</div>` : ""}
      ${[cust?.addressLine1, cust?.addressLine2].filter(Boolean).map((s) => `<div>${escape(s as string)}</div>`).join("")}
      <div>${[cust?.city, cust?.state, cust?.pincode].filter(Boolean).map(escape).join(", ")}</div>
      ${cust?.gstin ? `<div>GSTIN: ${escape(cust.gstin)}</div>` : ""}
      ${cust?.phone ? `<div>${escape(cust.phone)}</div>` : ""}
    </div>
  </div>

  <table class="items">
    <thead>
      <tr>
        <th style="width:32px">#</th>
        <th>Item</th>
        <th class="num">Qty</th>
        <th class="num">Rate</th>
        <th class="num">Disc</th>
        <th class="num">GST</th>
        <th class="num">Amount</th>
      </tr>
    </thead>
    <tbody>${itemsHtml}</tbody>
  </table>

  <div class="totals">
    <table>
      <tr><td class="lbl">Subtotal</td><td class="num">₹ ${fmt(q.subtotal)}</td></tr>
      <tr><td class="lbl">Discount</td><td class="num">- ₹ ${fmt(q.discountAmount)}</td></tr>
      <tr><td class="lbl">Taxable</td><td class="num">₹ ${fmt(q.taxableAmount)}</td></tr>
      <tr><td class="lbl">GST</td><td class="num">₹ ${fmt(q.gstAmount)}</td></tr>
      <tr><td class="lbl">Freight</td><td class="num">₹ ${fmt(q.freightAmount)}</td></tr>
      <tr class="grand"><td>Grand Total</td><td class="num">₹ ${fmt(q.grandTotal)}</td></tr>
    </table>
  </div>
  <div class="words">Amount in words: ${escape(amountInWordsINR(q.grandTotal))}</div>

  ${q.termsConditions ? `<div class="terms"><h4>Terms &amp; Conditions</h4>${escape(q.termsConditions)}</div>` : ""}
  ${q.notes ? `<div class="terms"><h4>Notes</h4>${escape(q.notes)}</div>` : ""}

  <div class="footer">${escape(q.quotationNo)} • System-generated; no signature required.</div>
</body></html>`;
}

function escape(s: string | null | undefined): string {
  if (!s) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

