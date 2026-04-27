import { NextRequest } from "next/server";
import { asc, eq } from "drizzle-orm";
import { PDFDocument, PDFPage, StandardFonts, degrees, rgb } from "pdf-lib";
import { readFile } from "fs/promises";
import path from "path";
import { db } from "@/lib/db";
import { customers, quotationItems, quotations } from "@/lib/db/schema";
import { ApiError, errorToResponse, parseId, requireSession } from "@/lib/api";
import {
  COMPANY_ADDRESS,
  COMPANY_CREDENTIALS,
  COMPANY_EMAIL,
  COMPANY_EMAIL2,
  COMPANY_GSTIN,
  COMPANY_MFG_LINE,
  COMPANY_NAME,
  COMPANY_PAN,
  COMPANY_PHONE,
  COMPANY_TAGLINE,
  COMPANY_WEBSITE,
  DEFAULT_SIGNER_DESIGNATION,
  DEFAULT_SIGNER_MOBILE,
  DEFAULT_SIGNER_NAME,
} from "@/lib/branding";
import { collectQtyColumns, parseQtyBreakup, sumQtyBreakup } from "@/lib/quotation-format";

/**
 * Strip HTML produced by the rich-text editor down to plain text suitable for
 * pdf-lib rendering. Preserves paragraph breaks and bullet markers.
 */
function htmlToPlain(html: string | null | undefined): string {
  if (!html) return "";
  if (!/<\/?[a-z]/i.test(html)) return html.trim();
  let s = html
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|blockquote)>/gi, "\n\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "");
  s = s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
  return s
    .split("\n")
    .map((l) => l.replace(/[ \t]+$/g, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

type Ctx = { params: Promise<{ id: string }> };

// A4 (595.28 x 841.89 pt)
const PW = 595.28;
const PH = 841.89;
const MARGIN_X = 50;
const FOOTER_BASE_Y = 18;
// Header band: logo + company info occupies top ~80pt
const HEADER_TOP = 828;

async function loadLogoBytes() {
  const configured = process.env.QUOTATION_LOGO_PATH || "public/brand/lan-logo.png";
  const relative = configured.replace(/^[/\\]+/, "");
  const candidates = path.isAbsolute(configured)
    ? [configured]
    : [
        path.join(process.cwd(), relative),
        path.join(process.cwd(), "app-next", relative),
      ];

  for (const candidate of candidates) {
    try {
      const bytes = await readFile(candidate);
      return { bytes, ext: path.extname(candidate).toLowerCase() };
    } catch {
      // try next candidate
    }
  }
  return null;
}

function wrapText(text: string, font: import("pdf-lib").PDFFont, size: number, maxWidth: number): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    const w = font.widthOfTextAtSize(candidate, size);
    if (w <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function money(value: string | number | null | undefined, currency = "INR") {
  const n = Number(value ?? 0);
  return `${currency} ${Number.isFinite(n) ? n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}`;
}

// ── helpers ──────────────────────────────────────────────────────────────────

type FontSet = {
  sans: import("pdf-lib").PDFFont;
  sansBold: import("pdf-lib").PDFFont;
  serif: import("pdf-lib").PDFFont;
};

const COMPANY_ADDRESS_LINES = [
  COMPANY_ADDRESS,
  COMPANY_PHONE,
  `${COMPANY_EMAIL}, ${COMPANY_EMAIL2}`,
  COMPANY_MFG_LINE,
] as const;

const CANONICAL_TERMS = [
  "SCOPE: Scope of our offer is to supply material as per the following terms & conditions and our enclosed technical offer.",
  "Validity: Our offer is valid for a period of 30 days from the date of the quotation, beyond which it will need our specific confirmation for extension.",
  "GST @18%: to be added extra.",
  "Freight: - Inclusive, Material will be delivered on full truck load. Partial truck load charges will be your account.",
  "Payment Terms: - 10% advance and balance payment before supply.",
  "Delivery: - Material will be dispatched within 30 days from the date of receipt of your technically and commercially clear purchase order.",
  "Force Majeure: - We shall not be liable for any liquidated damages for delay or failure to perform the contract for reasons of force majeure.",
  "Guarantee/Warranty: - Material will be guaranteed for a period of 12 Months from the date of dispatch.",
] as const;

function buildTermsText(termsConditions: string | null | undefined) {
  const customLines = htmlToPlain(termsConditions)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const normalizedCanonical = new Set(CANONICAL_TERMS.map((line) => line.toLowerCase()));
  const extraLines = customLines.filter((line) => !normalizedCanonical.has(line.toLowerCase()));
  return [...CANONICAL_TERMS, ...extraLines].join("\n");
}

/** Draw the company header band (logo + name/tagline + ref/date block). */
async function drawHeader(
  page: PDFPage,
  fonts: FontSet,
  logoImage: import("pdf-lib").PDFImage | null,
  refNo: string,
  dateStr: string,
  totalPages: number,
  pageNo: number,
) {
  const { sans, sansBold } = fonts;
  const x0 = MARGIN_X;

  // ── logo (top) with "Engineering & Technologies" + ISO caption directly beneath ──
  const SUBTITLE = "Engineering & Technologies";
  const ISO_LINE = COMPANY_TAGLINE; // "An ISO 9001:2015 Certified Company"
  const subtitleSize = 11;
  const isoSize = 8;
  const subtitleW = sansBold.widthOfTextAtSize(SUBTITLE, subtitleSize);
  const isoW = sans.widthOfTextAtSize(ISO_LINE, isoSize);
  let logoRightX = x0;
  let logoBlockBottom = HEADER_TOP;
  if (logoImage) {
    const maxW = 130;
    const maxH = 44;
    const scale = Math.min(maxW / logoImage.width, maxH / logoImage.height);
    const dw = logoImage.width * scale;
    const dh = logoImage.height * scale;
    // Center captions under the logo
    const blockW = Math.max(dw, subtitleW, isoW);
    const logoX = x0 + (blockW - dw) / 2;
    page.drawImage(logoImage, { x: logoX, y: HEADER_TOP - dh, width: dw, height: dh });
    const subtitleX = x0 + (blockW - subtitleW) / 2;
    const subtitleY = HEADER_TOP - dh - subtitleSize - 1;
    page.drawText(SUBTITLE, { x: subtitleX, y: subtitleY, size: subtitleSize, font: sansBold, color: rgb(0.08, 0.12, 0.22) });
    const isoX = x0 + (blockW - isoW) / 2;
    const isoY = subtitleY - isoSize - 2;
    page.drawText(ISO_LINE, { x: isoX, y: isoY, size: isoSize, font: sans, color: rgb(0.32, 0.38, 0.46) });
    logoRightX = x0 + blockW + 18;
    logoBlockBottom = isoY;
  } else {
    page.drawText("LAN", { x: x0, y: HEADER_TOP - 22, size: 30, font: sansBold, color: rgb(0.1, 0.19, 0.36) });
    page.drawText(SUBTITLE, { x: x0, y: HEADER_TOP - 38, size: subtitleSize, font: sansBold, color: rgb(0.08, 0.12, 0.22) });
    page.drawText(ISO_LINE, { x: x0, y: HEADER_TOP - 38 - isoSize - 3, size: isoSize, font: sans, color: rgb(0.32, 0.38, 0.46) });
    logoRightX = x0 + Math.max(78, subtitleW, isoW) + 18;
    logoBlockBottom = HEADER_TOP - 38 - isoSize - 3;
  }

  // ── company credentials/address intentionally omitted from header (shown in footer) ──
  void logoRightX;
  void logoBlockBottom;

  // ── ref / date / label (right block) ──
  const rx = PW - MARGIN_X - 155;
  page.drawText(`Ref: ${refNo}`, { x: rx, y: HEADER_TOP - 4, size: 9, font: sansBold, color: rgb(0.08, 0.12, 0.22) });
  page.drawText(`Date: ${dateStr}`, { x: rx, y: HEADER_TOP - 18, size: 9, font: sans, color: rgb(0.22, 0.26, 0.32) });
  page.drawText("Price Quotation", { x: rx, y: HEADER_TOP - 34, size: 10, font: sansBold, color: rgb(0.1, 0.19, 0.36) });
  page.drawText(`Page ${pageNo} of ${totalPages}`, { x: rx, y: HEADER_TOP - 47, size: 8, font: sans, color: rgb(0.45, 0.48, 0.54) });

  // ── separator line ──
  const lineY = HEADER_TOP - 64;
  page.drawLine({ start: { x: MARGIN_X, y: lineY }, end: { x: PW - MARGIN_X, y: lineY }, thickness: 0.8, color: rgb(0.78, 0.82, 0.88) });
}

/** Draw the footer on a page. */
function drawFooter(page: PDFPage, fonts: FontSet) {
  const { sans } = fonts;
  const addressTopY = FOOTER_BASE_Y + 64;
  const ruleY = FOOTER_BASE_Y + 10;
  const gstPanY = FOOTER_BASE_Y - 1;
  const siteY = FOOTER_BASE_Y - 12;

  COMPANY_ADDRESS_LINES.forEach((line, index) => {
    page.drawText(line, {
      x: MARGIN_X,
      y: addressTopY - index * 10,
      size: 7,
      font: sans,
      color: rgb(0.38, 0.42, 0.5),
    });
  });

  page.drawLine({ start: { x: MARGIN_X, y: ruleY }, end: { x: PW - MARGIN_X, y: ruleY }, thickness: 0.6, color: rgb(0.78, 0.82, 0.88) });
  page.drawText(`GSTIN: ${COMPANY_GSTIN}  |  PAN: ${COMPANY_PAN}`, {
    x: MARGIN_X,
    y: gstPanY,
    size: 7,
    font: sans,
    color: rgb(0.38, 0.42, 0.5),
  });
  const siteW = sans.widthOfTextAtSize(COMPANY_WEBSITE, 7);
  page.drawText(COMPANY_WEBSITE, {
    x: PW - MARGIN_X - siteW,
    y: siteY,
    size: 7,
    font: sans,
    color: rgb(0.38, 0.42, 0.5),
  });
}

// ── content area constants ──
const CONTENT_TOP = HEADER_TOP - 72; // first usable y after header separator
const CONTENT_BOTTOM = FOOTER_BASE_Y + 86; // last usable y above footer + address block

// ── column layout helpers ──
type ColDef = { title: string; x: number; w: number; align: "left" | "right" | "center" };

function buildColumns(qtyKeys: string[]): ColDef[] {
  const cw = PW - MARGIN_X * 2; // 512
  const srW = 24;
  const unitW = 38;
  const priceW = 88;
  const amtW = 84;

  if (qtyKeys.length === 0) {
    // No breakup: Sr | Description | Unit | Qty | Price per Unit | Amount
    const qtyW = 44;
    const descW = cw - srW - unitW - qtyW - priceW - amtW;
    let cx = MARGIN_X;
    const cols: ColDef[] = [
      { title: "Sr.", x: cx, w: srW, align: "center" },
    ];
    cx += srW;
    cols.push({ title: "Description of Materials", x: cx, w: descW, align: "left" });
    cx += descW;
    cols.push({ title: "Unit", x: cx, w: unitW, align: "center" });
    cx += unitW;
    cols.push({ title: "Qty", x: cx, w: qtyW, align: "center" });
    cx += qtyW;
    cols.push({ title: "Price per Unit", x: cx, w: priceW, align: "right" });
    cx += priceW;
    cols.push({ title: "Amount", x: cx, w: amtW, align: "right" });
    return cols;
  }

  // With breakup: Sr | Description | Unit | ...divCols | Total Qty | Price per Unit
  const maxDiv = Math.min(qtyKeys.length, 3);
  const divW = Math.min(58, Math.floor((cw - srW - unitW - priceW - amtW - 40) / (maxDiv + 1)));
  const totalQtyW = divW;
  const descW = cw - srW - unitW - divW * maxDiv - totalQtyW - priceW - amtW;
  let cx = MARGIN_X;
  const cols: ColDef[] = [{ title: "Sr.", x: cx, w: srW, align: "center" }];
  cx += srW;
  cols.push({ title: "Description of Materials", x: cx, w: descW, align: "left" });
  cx += descW;
  cols.push({ title: "Unit", x: cx, w: unitW, align: "center" });
  cx += unitW;
  for (let i = 0; i < maxDiv; i++) {
    cols.push({ title: qtyKeys[i], x: cx, w: divW, align: "center" });
    cx += divW;
  }
  cols.push({ title: "Total Qty", x: cx, w: totalQtyW, align: "center" });
  cx += totalQtyW;
  cols.push({ title: "Price per Unit", x: cx, w: priceW, align: "right" });
  cx += priceW;
  cols.push({ title: "Amount", x: cx, w: amtW, align: "right" });
  return cols;
}

function cellText(col: ColDef, text: string, y: number, rowH: number, font: import("pdf-lib").PDFFont, size: number, page: PDFPage) {
  const pad = 3;
  const tw = font.widthOfTextAtSize(text, size);
  let tx: number;
  if (col.align === "right") tx = col.x + col.w - pad - tw;
  else if (col.align === "center") tx = col.x + (col.w - tw) / 2;
  else tx = col.x + pad;
  page.drawText(text, { x: Math.max(col.x + 1, tx), y: y + (rowH - size) / 2, size, font });
}

export const runtime = "nodejs";

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    await requireSession();
    const id = parseId((await ctx.params).id);
    const watermark = req.nextUrl.searchParams.get("watermark") === "1";

    const [q] = await db.select().from(quotations).where(eq(quotations.id, id));
    if (!q) throw new ApiError(404, "Quotation not found");

    const items = await db
      .select()
      .from(quotationItems)
      .where(eq(quotationItems.quotationId, id))
      .orderBy(asc(quotationItems.sortOrder));

    const [customer] = await db.select().from(customers).where(eq(customers.id, q.customerId));

    const pdf = await PDFDocument.create();
    const fontSans = await pdf.embedFont(StandardFonts.Helvetica);
    const fontSansBold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const fontSerif = await pdf.embedFont(StandardFonts.TimesRoman);
    const fonts: FontSet = { sans: fontSans, sansBold: fontSansBold, serif: fontSerif };

    // ── load logo ──
    const logoAsset = await loadLogoBytes();
    let logoImage: import("pdf-lib").PDFImage | null = null;
    if (logoAsset) {
      try {
        logoImage = logoAsset.ext === ".jpg" || logoAsset.ext === ".jpeg"
          ? await pdf.embedJpg(logoAsset.bytes)
          : await pdf.embedPng(logoAsset.bytes);
      } catch { /* fall back to text */ }
    }

    // ── qty breakup columns ──
    const qtyKeys = collectQtyColumns(items.map((it) => it.qtyBreakup));

    // ── estimate page count (rough) ──
    const ROW_H = 20;
    const tableRowsPerPage = Math.floor((CONTENT_TOP - 140 - CONTENT_BOTTOM) / ROW_H);
    const needsPage3 = items.length > tableRowsPerPage;
    const totalPages = needsPage3 ? 3 : 2;

    // ── create pages ──
    const page1 = pdf.addPage([PW, PH]);
    const page2 = pdf.addPage([PW, PH]);
    const page3 = needsPage3 ? pdf.addPage([PW, PH]) : null;

    const refNo = q.referenceNo || q.quotationNo;
    const dateStr = q.quotationDate;

    // ── watermark ──
    if (watermark) {
      for (const pg of [page1, page2, ...(page3 ? [page3] : [])]) {
        pg.drawText("DRAFT", { x: 150, y: 370, size: 100, font: fontSansBold, color: rgb(0.94, 0.94, 0.94), rotate: degrees(35) });
      }
    }

    // ── draw headers + footers on all pages ──
    await drawHeader(page1, fonts, logoImage, refNo, dateStr, totalPages, 1);
    await drawHeader(page2, fonts, logoImage, refNo, dateStr, totalPages, 2);
    if (page3) await drawHeader(page3, fonts, logoImage, refNo, dateStr, totalPages, 3);
    drawFooter(page1, fonts);
    drawFooter(page2, fonts);
    if (page3) drawFooter(page3, fonts);

    // ═══════════════════════════════════════════════════════════════
    // PAGE 1 — Cover Letter
    // ═══════════════════════════════════════════════════════════════
    let cy = CONTENT_TOP - 10;

    // To / customer address
    page1.drawText("To,", { x: MARGIN_X, y: cy, size: 10, font: fontSansBold });
    cy -= 14;
    page1.drawText(`M/s ${customer?.name || "Customer"}`, { x: MARGIN_X, y: cy, size: 10, font: fontSansBold });
    cy -= 13;

    const addrParts = [customer?.addressLine1, customer?.addressLine2, customer?.city, customer?.state, customer?.pincode].filter(Boolean);
    // Address lines (up to 4 lines)
    const addrChunks: string[] = [];
    const addrFull = addrParts.join(", ");
    const addrWrapped = wrapText(addrFull, fontSans, 9, PW - MARGIN_X * 2 - 160);
    for (const line of addrWrapped.slice(0, 4)) {
      page1.drawText(line, { x: MARGIN_X, y: cy, size: 9, font: fontSans, color: rgb(0.2, 0.24, 0.3) });
      cy -= 12;
      addrChunks.push(line);
    }
    if (addrChunks.length === 0) cy += 0; // keep going

    if (q.customerAttention) {
      page1.drawText(`Kind Attn.: ${q.customerAttention}`, { x: MARGIN_X, y: cy, size: 9.5, font: fontSansBold, color: rgb(0.1, 0.14, 0.22) });
      cy -= 18;
    } else {
      cy -= 6;
    }

    // Subject
    const subjectText = `Subject: ${q.subject || "Quotation for Supply Scope"}${q.projectName ? ` – ${q.projectName}` : ""}`;
    const subjectLines = wrapText(subjectText, fontSansBold, 10, PW - MARGIN_X * 2);
    for (const line of subjectLines.slice(0, 3)) {
      page1.drawText(line, { x: MARGIN_X, y: cy, size: 10, font: fontSansBold, color: rgb(0.08, 0.12, 0.22) });
      cy -= 14;
    }
    cy -= 4;

    // Salutation
    page1.drawText("Dear Sir,", { x: MARGIN_X, y: cy, size: 10, font: fontSerif });
    cy -= 18;

    // Intro paragraph
    const intro = htmlToPlain(q.introText) ||
      "We thankfully acknowledge the receipt of your inquiry and are pleased to submit our optimum offer for your kind consideration. We anticipate that our offer will be in line with your requirement. We look forward to your valued response. If you require any techno commercial clarification, please feel free to contact us.";
    const introLines = wrapText(intro, fontSerif, 10, PW - MARGIN_X * 2);
    for (const line of introLines.slice(0, 12)) {
      page1.drawText(line, { x: MARGIN_X, y: cy, size: 10, font: fontSerif, color: rgb(0.15, 0.18, 0.24) });
      cy -= 14;
    }
    cy -= 8;

    // Closing
    page1.drawText("We remain,", { x: MARGIN_X, y: cy, size: 10, font: fontSerif });
    cy -= 14;
    page1.drawText("Sportingly yours,", { x: MARGIN_X, y: cy, size: 10, font: fontSerif });
    cy -= 22;
    page1.drawText(`For ${COMPANY_NAME}`, { x: MARGIN_X, y: cy, size: 10, font: fontSansBold });
    cy -= 36;

    // Signature
    if (q.signatureMode === "typed" && q.signatureData) {
      page1.drawText(q.signatureData, { x: MARGIN_X, y: cy, size: 16, font: fontSansBold, color: rgb(0.08, 0.14, 0.36) });
      cy -= 22;
    } else {
      // blank signature line
      page1.drawLine({ start: { x: MARGIN_X, y: cy }, end: { x: MARGIN_X + 140, y: cy }, thickness: 0.5, color: rgb(0.5, 0.5, 0.5) });
      cy -= 10;
    }

    const signerName = q.signatureName || DEFAULT_SIGNER_NAME;
    const signerDesig = q.signatureDesignation || DEFAULT_SIGNER_DESIGNATION;
    const signerMobile = q.signatureMobile || DEFAULT_SIGNER_MOBILE;
    const signerEmail = q.signatureEmail;
    const signerLines = [signerName, signerDesig, signerMobile, signerEmail].filter(Boolean) as string[];
    for (const line of signerLines) {
      page1.drawText(line, { x: MARGIN_X, y: cy, size: 9, font: fontSans });
      cy -= 12;
    }

    // Enclosures — anchored near bottom
    const encY = CONTENT_BOTTOM + 28;
    page1.drawText("Enclosed:", { x: MARGIN_X, y: encY + 14, size: 9.5, font: fontSansBold });
    page1.drawText("1)  Price Schedule", { x: MARGIN_X + 8, y: encY, size: 9, font: fontSans });
    page1.drawText("2)  Commercial Terms & Conditions", { x: MARGIN_X + 8, y: encY - 12, size: 9, font: fontSans });

    // ═══════════════════════════════════════════════════════════════
    // PAGE 2 — Price Schedule + Commercial Terms
    // ═══════════════════════════════════════════════════════════════
    let py = CONTENT_TOP - 8;

    // Section heading
    page2.drawText("1.  PRICE SCHEDULE:", { x: MARGIN_X, y: py, size: 11, font: fontSansBold, color: rgb(0.08, 0.16, 0.36) });
    py -= 32;

    // Build columns
    const columns = buildColumns(qtyKeys);
    const maxQtyDiv = Math.min(qtyKeys.length, 3);

    // Table header row
    const HDR_H = 22;
    for (const c of columns) {
      page2.drawRectangle({ x: c.x, y: py, width: c.w, height: HDR_H, borderWidth: 0.7, borderColor: rgb(0.72, 0.78, 0.88), color: rgb(0.9, 0.93, 0.97) });
      // Wrap long header text
      const hLines = wrapText(c.title, fontSansBold, 7.5, c.w - 4);
      const totalH = hLines.length * 9;
      let hy = py + (HDR_H - totalH) / 2 + (hLines.length - 1) * 9;
      for (const hl of hLines) {
        const hw = fontSansBold.widthOfTextAtSize(hl, 7.5);
        let hx: number;
        if (c.align === "right") hx = c.x + c.w - 3 - hw;
        else if (c.align === "center") hx = c.x + (c.w - hw) / 2;
        else hx = c.x + 3;
        page2.drawText(hl, { x: Math.max(c.x + 1, hx), y: hy, size: 7.5, font: fontSansBold, color: rgb(0.12, 0.18, 0.32) });
        hy -= 9;
      }
    }
    py -= HDR_H;

    // Table data rows — may overflow to page3
    let activePage: PDFPage = page2;
    const PAGE3_START_Y = CONTENT_TOP - 8;

    for (let idx = 0; idx < items.length; idx++) {
      const it = items[idx];
      const breakup = parseQtyBreakup(it.qtyBreakup);
      const totalQty = qtyKeys.length > 0 ? sumQtyBreakup(breakup) : Number(it.qty);

      // Estimate row height (description may wrap)
      const descCol = columns.find((c) => c.title === "Description of Materials");
      const descW = descCol ? descCol.w - 6 : 180;
      const descLines = wrapText(it.productName, fontSans, 8, descW);
      const rowH = Math.max(ROW_H, descLines.length * 11 + 6);

      // Page break?
      if (py - rowH < CONTENT_BOTTOM + 4 && activePage === page2 && page3) {
        activePage = page3;
        py = PAGE3_START_Y;
        // Repeat header row on page3
        for (const c of columns) {
          page3.drawRectangle({ x: c.x, y: py, width: c.w, height: HDR_H, borderWidth: 0.7, borderColor: rgb(0.72, 0.78, 0.88), color: rgb(0.9, 0.93, 0.97) });
          page3.drawText(c.title.split(" ")[0], { x: c.x + 2, y: py + 7, size: 7.5, font: fontSansBold, color: rgb(0.12, 0.18, 0.32) });
        }
        py -= HDR_H;
      }

      const rowBg = idx % 2 === 1 ? rgb(0.97, 0.98, 1.0) : rgb(1, 1, 1);
      for (const c of columns) {
        activePage.drawRectangle({ x: c.x, y: py - rowH + ROW_H, width: c.w, height: rowH, borderWidth: 0.5, borderColor: rgb(0.84, 0.87, 0.92), color: rowBg });
      }

      // Sr.
      const srCol = columns[0];
      cellText(srCol, String(idx + 1), py - rowH + ROW_H, rowH, fontSans, 8, activePage);

      // Description (multi-line)
      if (descCol) {
        let dy = py - rowH + ROW_H + rowH - 11 - 3;
        for (const dline of descLines) {
          activePage.drawText(dline, { x: descCol.x + 3, y: dy, size: 8, font: fontSans });
          dy -= 11;
        }
      }

      // Unit
      const unitCol = columns.find((c) => c.title === "Unit");
      if (unitCol) cellText(unitCol, it.unitName || "Nos", py - rowH + ROW_H, rowH, fontSans, 8, activePage);

      // Qty breakup columns
      if (qtyKeys.length > 0) {
        for (let qi = 0; qi < maxQtyDiv; qi++) {
          const qCol = columns.find((c) => c.title === qtyKeys[qi]);
          if (qCol) {
            const qv = breakup[qtyKeys[qi]] ?? 0;
            cellText(qCol, qv > 0 ? String(qv) : "-", py - rowH + ROW_H, rowH, fontSans, 8, activePage);
          }
        }
        const totalQtyCol = columns.find((c) => c.title === "Total Qty");
        if (totalQtyCol) cellText(totalQtyCol, totalQty > 0 ? String(totalQty) : "-", py - rowH + ROW_H, rowH, fontSansBold, 8, activePage);
      } else {
        const qtyCol = columns.find((c) => c.title === "Qty");
        if (qtyCol) cellText(qtyCol, Number(it.qty).toFixed(2), py - rowH + ROW_H, rowH, fontSans, 8, activePage);
      }

      // Price per Unit
      const priceCol = columns.find((c) => c.title === "Price per Unit");
      if (priceCol) cellText(priceCol, money(it.unitPrice, q.currency), py - rowH + ROW_H, rowH, fontSans, 8, activePage);

      // Amount
      const amtCol = columns.find((c) => c.title === "Amount");
      if (amtCol) cellText(amtCol, money(it.lineTotal, q.currency), py - rowH + ROW_H, rowH, fontSansBold, 8, activePage);

      py -= rowH;
    }

    // Totals block (right-aligned)
    py -= 8;
    const totalRows: Array<[string, string, boolean]> = [
      ["Sub Total", money(q.subtotal, q.currency), false],
      ["Discount", money(q.discountAmount, q.currency), false],
      ["Taxable Amount", money(q.taxableAmount, q.currency), false],
      ["GST", money(q.gstAmount, q.currency), false],
      ["Freight", money(q.freightAmount, q.currency), false],
      ["Grand Total", money(q.grandTotal, q.currency), true],
    ];

    // find last price-per-unit col x to align totals
    const priceColForTotals = columns.find((c) => c.title === "Price per Unit");
    const amtColForTotals = columns.find((c) => c.title === "Amount");
    const labelX = priceColForTotals ? priceColForTotals.x : PW - MARGIN_X - 180;
    const valueX = amtColForTotals ? amtColForTotals.x : PW - MARGIN_X - 90;
    const valueW = amtColForTotals ? amtColForTotals.w : 90;

    // Check if we need page overflow for totals
    if (py - totalRows.length * 14 - 4 < CONTENT_BOTTOM + 30 && activePage === page2 && page3) {
      activePage = page3;
      py = PAGE3_START_Y;
    }

    activePage.drawLine({ start: { x: labelX, y: py }, end: { x: PW - MARGIN_X, y: py }, thickness: 0.5, color: rgb(0.8, 0.84, 0.9) });
    py -= 4;
    for (const [label, value, bold] of totalRows) {
      const font = bold ? fontSansBold : fontSans;
      const sz = bold ? 9.5 : 8.5;
      activePage.drawText(label, { x: labelX + 3, y: py, size: sz, font });
      const vw = font.widthOfTextAtSize(value, sz);
      activePage.drawText(value, { x: valueX + valueW - 3 - vw, y: py, size: sz, font });
      if (bold) {
        activePage.drawLine({ start: { x: labelX, y: py - 3 }, end: { x: PW - MARGIN_X, y: py - 3 }, thickness: 0.8, color: rgb(0.2, 0.3, 0.55) });
      }
      py -= 14;
    }

    // ── Commercial Terms ──
    py -= 16;
    if (py < CONTENT_BOTTOM + 40 && activePage === page2 && page3) {
      activePage = page3;
      py = PAGE3_START_Y;
    }

    activePage.drawText("2.)  COMMERCIAL TERMS AND CONDITIONS:", { x: MARGIN_X, y: py, size: 10.5, font: fontSansBold, color: rgb(0.08, 0.16, 0.36) });
    py -= 18;

    const termsText = buildTermsText(q.termsConditions);
    const termLines = termsText.split(/\r?\n/).filter(Boolean);

    for (const tline of termLines) {
      if (py < CONTENT_BOTTOM + 14) {
        // overflow — skip remaining (practical cap)
        break;
      }
      const wrapped = wrapText(tline, fontSans, 8.5, PW - MARGIN_X * 2);
      for (const wl of wrapped) {
        activePage.drawText(wl, { x: MARGIN_X, y: py, size: 8.5, font: fontSans, color: rgb(0.15, 0.18, 0.26) });
        py -= 12;
        if (py < CONTENT_BOTTOM + 14) break;
      }
      py -= 2; // extra gap between paragraphs
    }

    // ── Closing on last page ──
    if (py > CONTENT_BOTTOM + 60) {
      py -= 12;
      activePage.drawText("We Remain,", { x: MARGIN_X, y: py, size: 9.5, font: fontSerif });
      py -= 13;
      activePage.drawText("Sportingly yours.", { x: MARGIN_X, y: py, size: 9.5, font: fontSerif });
      py -= 18;
      activePage.drawText(`For ${COMPANY_NAME}`, { x: MARGIN_X, y: py, size: 10, font: fontSansBold });
      py -= 30;
      if (q.signatureMode === "typed" && q.signatureData) {
        activePage.drawText(q.signatureData, { x: MARGIN_X, y: py, size: 14, font: fontSansBold, color: rgb(0.08, 0.14, 0.36) });
        py -= 18;
      }
      const sig2Lines = [
        q.signatureName || DEFAULT_SIGNER_NAME,
        q.signatureDesignation || DEFAULT_SIGNER_DESIGNATION,
        q.signatureMobile || DEFAULT_SIGNER_MOBILE,
      ];
      for (const sl of sig2Lines) {
        activePage.drawText(sl, { x: MARGIN_X, y: py, size: 9, font: fontSans });
        py -= 12;
      }
    }

    const pdfBytes = await pdf.save();
    const filename = `${q.quotationNo}.pdf`;

    return new Response(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    return errorToResponse(err);
  }
}
