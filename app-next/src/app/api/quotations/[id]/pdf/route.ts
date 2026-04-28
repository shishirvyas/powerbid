import { NextRequest } from "next/server";
import { asc, eq } from "drizzle-orm";
import { PDFDocument, PDFImage, PDFPage, StandardFonts, rgb } from "pdf-lib";
import { readFile } from "fs/promises";
import path from "path";
import { db } from "@/lib/db";
import { customers, quotationItems, quotations } from "@/lib/db/schema";
import { ApiError, errorToResponse, parseId, requireSession } from "@/lib/api";
import {
  DEFAULT_SIGNER_DESIGNATION,
  DEFAULT_SIGNER_MOBILE,
  DEFAULT_SIGNER_NAME,
} from "@/lib/branding";
import { listAttachments } from "@/lib/attachment-store";

type Ctx = { params: Promise<{ id: string }> };

const PW = 595.28;
const PH = 841.89;
const MARGIN_X = 50;
const PAGE_BOTTOM = 112;
const PAGE1_TOP = 620;
const PAGE_OTHER_TOP = 700;

function htmlToPlain(html: string | null | undefined): string {
  if (!html) return "";
  if (!/<\/?[a-z]/i.test(html)) return html.trim();
  let s = html
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|blockquote)>/gi, "\n\n")
    .replace(/<li[^>]*>/gi, "- ")
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
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function wrapText(text: string, font: import("pdf-lib").PDFFont, size: number, maxWidth: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function drawUnderline(page: PDFPage, x: number, y: number, width: number, color = rgb(0.05, 0.08, 0.16)) {
  page.drawLine({ start: { x, y: y - 1.5 }, end: { x: x + width, y: y - 1.5 }, thickness: 0.7, color });
}

function money(value: string | number | null | undefined, currency = "INR") {
  const n = Number(value ?? 0);
  return `${currency} ${Number.isFinite(n) ? n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}`;
}

function formatOrdinalDate(input: string | null | undefined): string {
  if (!input) return "";
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return input;
  const day = d.getDate();
  const suffix =
    day % 100 >= 11 && day % 100 <= 13
      ? "th"
      : day % 10 === 1
      ? "st"
      : day % 10 === 2
      ? "nd"
      : day % 10 === 3
      ? "rd"
      : "th";
  const month = d.toLocaleString("en-GB", { month: "long" });
  const year = d.getFullYear();
  return `${day}${suffix} ${month} ${year}`;
}

async function loadImageFromCandidates(candidates: string[]) {
  for (const candidate of candidates) {
    try {
      const bytes = await readFile(candidate);
      return { bytes, ext: path.extname(candidate).toLowerCase() };
    } catch {
      // keep trying
    }
  }
  return null;
}

async function loadLogoAsset() {
  const configured = process.env.QUOTATION_LOGO_PATH || "public/brand/lan-logo.png";
  const relative = configured.replace(/^[/\\]+/, "");
  const candidates = path.isAbsolute(configured)
    ? [configured]
    : [path.join(process.cwd(), relative), path.join(process.cwd(), "app-next", relative)];
  return loadImageFromCandidates(candidates);
}

async function loadTemplateAsset() {
  const configured = process.env.QUOTATION_LETTER_TEMPLATE_PATH || "public/brand/Letter-Template.png";
  const relative = configured.replace(/^[/\\]+/, "");
  const candidates = path.isAbsolute(configured)
    ? [configured]
    : [path.join(process.cwd(), relative), path.join(process.cwd(), "app-next", relative)];
  return loadImageFromCandidates(candidates);
}

async function embedImage(pdf: PDFDocument, asset: { bytes: Buffer; ext: string } | null): Promise<PDFImage | null> {
  if (!asset) return null;
  try {
    return asset.ext === ".jpg" || asset.ext === ".jpeg"
      ? await pdf.embedJpg(asset.bytes)
      : await pdf.embedPng(asset.bytes);
  } catch {
    return null;
  }
}

function drawBackground(page: PDFPage, templateImage: PDFImage | null) {
  if (!templateImage) return;
  page.drawImage(templateImage, { x: 0, y: 0, width: PW, height: PH });
}

function drawFooter(_page: PDFPage, _font: import("pdf-lib").PDFFont) {
  // Footer artwork/address is already present in the letter template image.
}

function drawHeaderPage1(
  page: PDFPage,
  logo: PDFImage | null,
  fonts: { sans: import("pdf-lib").PDFFont; sansBold: import("pdf-lib").PDFFont; italic: import("pdf-lib").PDFFont },
  refNo: string,
  dateStr: string,
) {
  const { sans, sansBold, italic } = fonts;

  const title = "Price Quotation";
  const titleSize = 17;
  const tw = italic.widthOfTextAtSize(title, titleSize);
  const tx = (PW - tw) / 2;
  const ty = 636;
  page.drawText(title, { x: tx, y: ty, size: titleSize, font: italic, color: rgb(0.08, 0.12, 0.22) });
  drawUnderline(page, tx, ty, tw, rgb(0.08, 0.12, 0.22));

  page.drawText(`Ref: ${refNo}`, { x: MARGIN_X, y: 663, size: 10, font: sansBold, color: rgb(0.08, 0.12, 0.22) });
  const dateLabel = `Date: ${dateStr}`;
  const dw = sans.widthOfTextAtSize(dateLabel, 10);
  page.drawText(dateLabel, { x: PW - MARGIN_X - dw, y: 663, size: 10, font: sans, color: rgb(0.2, 0.24, 0.3) });
  page.drawLine({ start: { x: MARGIN_X, y: 655 }, end: { x: PW - MARGIN_X, y: 655 }, thickness: 0.7, color: rgb(0.76, 0.8, 0.86) });
}

function drawHeaderPageStandard(
  page: PDFPage,
  logo: PDFImage | null,
  fonts: { sans: import("pdf-lib").PDFFont; sansBold: import("pdf-lib").PDFFont },
  refNo: string,
  dateStr: string,
) {
  const { sans, sansBold } = fonts;
  void logo;
  void sansBold;
  void refNo;

  const dateLabel = `Date: ${dateStr}`;
  const dw = sans.widthOfTextAtSize(dateLabel, 10);
  page.drawText(dateLabel, { x: PW - MARGIN_X - dw, y: 663, size: 10, font: sans, color: rgb(0.2, 0.24, 0.3) });
  page.drawLine({ start: { x: MARGIN_X, y: 655 }, end: { x: PW - MARGIN_X, y: 655 }, thickness: 0.7, color: rgb(0.76, 0.8, 0.86) });
}

function drawJustifiedParagraph(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  width: number,
  lineHeight: number,
  font: import("pdf-lib").PDFFont,
  size: number,
) {
  const lines = wrapText(text, font, size, width);
  let cy = y;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const isLast = i === lines.length - 1;
    if (isLast || !line.includes(" ")) {
      page.drawText(line, { x, y: cy, size, font, color: rgb(0.14, 0.17, 0.25) });
      cy -= lineHeight;
      continue;
    }

    const words = line.split(/\s+/).filter(Boolean);
    const wordsWidth = words.reduce((sum, w) => sum + font.widthOfTextAtSize(w, size), 0);
    const gaps = words.length - 1;
    const extraSpace = Math.max(0, (width - wordsWidth) / gaps);

    let cx = x;
    for (let wIdx = 0; wIdx < words.length; wIdx++) {
      const word = words[wIdx]!;
      page.drawText(word, { x: cx, y: cy, size, font, color: rgb(0.14, 0.17, 0.25) });
      cx += font.widthOfTextAtSize(word, size);
      if (wIdx < words.length - 1) cx += extraSpace;
    }
    cy -= lineHeight;
  }

  return cy;
}

function ensureSpace(
  currentPage: PDFPage,
  currentY: number,
  needed: number,
  topY: number,
  createPage: () => PDFPage,
): { page: PDFPage; y: number } {
  if (currentY - needed >= PAGE_BOTTOM) return { page: currentPage, y: currentY };
  return { page: createPage(), y: topY };
}

export const runtime = "nodejs";

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    await requireSession();
    const id = parseId((await ctx.params).id);

    const [q] = await db
      .select({
        id: quotations.id,
        quotationNo: quotations.quotationNo,
        referenceNo: quotations.referenceNo,
        quotationDate: quotations.quotationDate,
        subject: quotations.subject,
        projectName: quotations.projectName,
        customerAttention: quotations.customerAttention,
        introText: quotations.introText,
        termsConditions: quotations.termsConditions,
        signatureMode: quotations.signatureMode,
        signatureData: quotations.signatureData,
        signatureName: quotations.signatureName,
        signatureDesignation: quotations.signatureDesignation,
        signatureMobile: quotations.signatureMobile,
        signatureEmail: quotations.signatureEmail,
        currency: quotations.currency,
        subtotal: quotations.subtotal,
        taxableAmount: quotations.taxableAmount,
        gstAmount: quotations.gstAmount,
        grandTotal: quotations.grandTotal,
        customerId: quotations.customerId,
      })
      .from(quotations)
      .where(eq(quotations.id, id));

    if (!q) throw new ApiError(404, "Quotation not found");

    const items = await db
      .select()
      .from(quotationItems)
      .where(eq(quotationItems.quotationId, id))
      .orderBy(asc(quotationItems.sortOrder));

    const [customer] = await db
      .select({
        name: customers.name,
        addressLine1: customers.addressLine1,
        addressLine2: customers.addressLine2,
        city: customers.city,
        state: customers.state,
        pincode: customers.pincode,
      })
      .from(customers)
      .where(eq(customers.id, q.customerId));

    const pdf = await PDFDocument.create();
    const fontSans = await pdf.embedFont(StandardFonts.Helvetica);
    const fontSansBold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const fontSerif = await pdf.embedFont(StandardFonts.TimesRoman);
    const fontItalic = await pdf.embedFont(StandardFonts.TimesRomanItalic);

    const logoImage = await embedImage(pdf, await loadLogoAsset());
    const templateImage = await embedImage(pdf, await loadTemplateAsset());

    const refNo = q.referenceNo || q.quotationNo;
    const dateStr = formatOrdinalDate(q.quotationDate);

    const createPage1 = () => {
      const p = pdf.addPage([PW, PH]);
      drawBackground(p, templateImage);
      drawHeaderPage1(p, logoImage, { sans: fontSans, sansBold: fontSansBold, italic: fontItalic }, refNo, dateStr);
      drawFooter(p, fontSans);
      return p;
    };

    const createStandardPage = () => {
      const p = pdf.addPage([PW, PH]);
      drawBackground(p, templateImage);
      drawHeaderPageStandard(p, logoImage, { sans: fontSans, sansBold: fontSansBold }, refNo, dateStr);
      drawFooter(p, fontSans);
      return p;
    };

    // PAGE 1
    const page1 = createPage1();
    let y = PAGE1_TOP;

    page1.drawText("To,", { x: MARGIN_X, y, size: 10, font: fontSansBold });
    y -= 15;
    page1.drawText(`M/s ${customer?.name || "Customer"}`, { x: MARGIN_X, y, size: 10, font: fontSansBold });
    y -= 15;

    const addr = [customer?.addressLine1, customer?.addressLine2, customer?.city, customer?.state, customer?.pincode]
      .filter(Boolean)
      .join(", ");
    for (const line of wrapText(addr, fontSans, 9.2, PW - MARGIN_X * 2)) {
      page1.drawText(line, { x: MARGIN_X, y, size: 9.2, font: fontSans, color: rgb(0.18, 0.22, 0.3) });
      y -= 12;
    }
    y -= 4;

    const attn = `Kind Attn.: ${q.customerAttention || ""}`;
    page1.drawText(attn, { x: MARGIN_X, y, size: 9.5, font: fontSansBold });
    drawUnderline(page1, MARGIN_X, y, fontSansBold.widthOfTextAtSize(attn, 9.5));
    y -= 18;

    const subject = `Subject: ${q.subject || "Price Quotation"}${q.projectName ? ` - ${q.projectName}` : ""}`;
    const subjectLines = wrapText(subject, fontSansBold, 10, PW - MARGIN_X * 2);
    for (const line of subjectLines) {
      page1.drawText(line, { x: MARGIN_X, y, size: 10, font: fontSansBold });
      drawUnderline(page1, MARGIN_X, y, fontSansBold.widthOfTextAtSize(line, 10));
      y -= 14;
    }

    y -= 4;
    page1.drawText("Dear Sir,", { x: MARGIN_X, y, size: 10, font: fontSerif });
    y -= 16;

    const intro =
      htmlToPlain(q.introText) ||
      "We thankfully acknowledge the receipt of your inquiry and are pleased to submit our optimum offer for your kind consideration.";

    for (const paragraph of intro.split(/\n\n+/).map((p) => p.trim()).filter(Boolean)) {
      y = drawJustifiedParagraph(page1, paragraph, MARGIN_X, y, PW - MARGIN_X * 2, 14, fontSerif, 10);
      y -= 8;
    }

    y -= 6;
    page1.drawText("For LAN Engineering & Technologies", { x: MARGIN_X, y, size: 10, font: fontSansBold });
    y -= 28;
    if (q.signatureMode === "typed" && q.signatureData) {
      page1.drawText(q.signatureData, { x: MARGIN_X, y, size: 15, font: fontSansBold, color: rgb(0.08, 0.14, 0.35) });
      y -= 20;
    } else {
      page1.drawLine({ start: { x: MARGIN_X, y }, end: { x: MARGIN_X + 150, y }, thickness: 0.6, color: rgb(0.45, 0.45, 0.5) });
      y -= 12;
    }

    for (const line of [
      q.signatureName || DEFAULT_SIGNER_NAME,
      q.signatureDesignation || DEFAULT_SIGNER_DESIGNATION,
      q.signatureMobile || DEFAULT_SIGNER_MOBILE,
      q.signatureEmail || "",
    ].filter(Boolean)) {
      page1.drawText(line, { x: MARGIN_X, y, size: 9, font: fontSans });
      y -= 12;
    }

    const enclosedY = PAGE_BOTTOM + 54;
    page1.drawText("Enclosed:", { x: MARGIN_X, y: enclosedY + 20, size: 9.5, font: fontSansBold });
    page1.drawText("1) Price Schedule", { x: MARGIN_X + 8, y: enclosedY + 8, size: 9, font: fontSans });
    page1.drawText("2) Commercial Terms & Conditions", { x: MARGIN_X + 8, y: enclosedY - 4, size: 9, font: fontSans });

    // PAGE 2+ (schedule + terms with dynamic pagination)
    let page = createStandardPage();
    y = PAGE_OTHER_TOP;

    const scheduleTitle = "PRICE SCHEDULE";
    const stW = fontSansBold.widthOfTextAtSize(scheduleTitle, 11);
    page.drawText(scheduleTitle, { x: MARGIN_X, y, size: 11, font: fontSansBold, color: rgb(0.08, 0.16, 0.36) });
    drawUnderline(page, MARGIN_X, y, stW, rgb(0.08, 0.16, 0.36));
    y -= 22;

    const cols = {
      sr: { x: MARGIN_X, w: 26 },
      desc: { x: MARGIN_X + 26, w: 236 },
      unit: { x: MARGIN_X + 262, w: 42 },
      qty: { x: MARGIN_X + 304, w: 46 },
      price: { x: MARGIN_X + 350, w: 80 },
      amt: { x: MARGIN_X + 430, w: 82 },
    };

    const drawTableHeader = (p: PDFPage, yPos: number) => {
      const h = 22;
      const defs = [
        [cols.sr, "Sr"],
        [cols.desc, "Description"],
        [cols.unit, "Unit"],
        [cols.qty, "Qty"],
        [cols.price, "Price"],
        [cols.amt, "Amount"],
      ] as const;
      for (const [c, label] of defs) {
        p.drawRectangle({ x: c.x, y: yPos - h, width: c.w, height: h, color: rgb(0.93, 0.95, 0.98), borderWidth: 0.7, borderColor: rgb(0.72, 0.78, 0.88) });
        const lw = fontSansBold.widthOfTextAtSize(label, 8);
        p.drawText(label, { x: c.x + (c.w - lw) / 2, y: yPos - 14, size: 8, font: fontSansBold, color: rgb(0.1, 0.15, 0.28) });
      }
      return yPos - h;
    };

    y = drawTableHeader(page, y);

    for (let i = 0; i < items.length; i++) {
      const item = items[i]!;
      const descLines = wrapText(item.productName, fontSans, 8.4, cols.desc.w - 6);
      const rowH = Math.max(22, 8 + descLines.length * 10);

      ({ page, y } = ensureSpace(page, y, rowH + 2, PAGE_OTHER_TOP, () => {
        const np = createStandardPage();
        const tW = fontSansBold.widthOfTextAtSize(scheduleTitle, 11);
        np.drawText(scheduleTitle, { x: MARGIN_X, y: PAGE_OTHER_TOP, size: 11, font: fontSansBold, color: rgb(0.08, 0.16, 0.36) });
        drawUnderline(np, MARGIN_X, PAGE_OTHER_TOP, tW, rgb(0.08, 0.16, 0.36));
        const nextY = drawTableHeader(np, PAGE_OTHER_TOP - 22);
        y = nextY;
        return np;
      }));

      const defs = [cols.sr, cols.desc, cols.unit, cols.qty, cols.price, cols.amt] as const;
      for (const c of defs) {
        page.drawRectangle({ x: c.x, y: y - rowH, width: c.w, height: rowH, borderWidth: 0.55, borderColor: rgb(0.82, 0.86, 0.92) });
      }

      const srText = String(i + 1);
      page.drawText(srText, { x: cols.sr.x + (cols.sr.w - fontSans.widthOfTextAtSize(srText, 8.2)) / 2, y: y - rowH + 7, size: 8.2, font: fontSans });

      let dy = y - 11;
      for (const dl of descLines) {
        page.drawText(dl, { x: cols.desc.x + 3, y: dy, size: 8.4, font: fontSans });
        dy -= 10;
      }

      const unit = item.unitName || "Nos";
      page.drawText(unit, { x: cols.unit.x + 3, y: y - rowH + 7, size: 8.2, font: fontSans });

      const qty = Number(item.qty || 0).toString();
      page.drawText(qty, { x: cols.qty.x + cols.qty.w - 4 - fontSans.widthOfTextAtSize(qty, 8.2), y: y - rowH + 7, size: 8.2, font: fontSans });

      const price = money(item.unitPrice, q.currency);
      page.drawText(price, { x: cols.price.x + cols.price.w - 4 - fontSans.widthOfTextAtSize(price, 8.2), y: y - rowH + 7, size: 8.2, font: fontSans });

      const amount = money(item.lineTotal, q.currency);
      page.drawText(amount, { x: cols.amt.x + cols.amt.w - 4 - fontSansBold.widthOfTextAtSize(amount, 8.2), y: y - rowH + 7, size: 8.2, font: fontSansBold });

      y -= rowH;
    }

    y -= 8;
    const totals: Array<[string, string, boolean]> = [
      ["Subtotal", money(q.subtotal, q.currency), false],
      ["Taxable", money(q.taxableAmount, q.currency), false],
      ["GST", money(q.gstAmount, q.currency), false],
      ["Grand Total", money(q.grandTotal, q.currency), true],
    ];

    for (const [label, value, bold] of totals) {
      ({ page, y } = ensureSpace(page, y, 16, PAGE_OTHER_TOP, createStandardPage));
      const f = bold ? fontSansBold : fontSans;
      page.drawText(label, { x: cols.price.x, y, size: bold ? 9.2 : 8.6, font: f });
      page.drawText(value, {
        x: cols.amt.x + cols.amt.w - f.widthOfTextAtSize(value, bold ? 9.2 : 8.6),
        y,
        size: bold ? 9.2 : 8.6,
        font: f,
      });
      y -= 14;
    }

    y -= 6;
    const termsHeading = "COMMERCIAL TERMS";
    ({ page, y } = ensureSpace(page, y, 24, PAGE_OTHER_TOP, createStandardPage));
    page.drawText(termsHeading, { x: MARGIN_X, y, size: 10.5, font: fontSansBold, color: rgb(0.08, 0.16, 0.36) });
    drawUnderline(page, MARGIN_X, y, fontSansBold.widthOfTextAtSize(termsHeading, 10.5), rgb(0.08, 0.16, 0.36));
    y -= 18;

    const terms = htmlToPlain(q.termsConditions).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const numberedTerms = terms.length
      ? terms
      : [
          "Validity: Our offer is valid for 30 days from quotation date.",
          "GST: Applicable GST extra as per selected slab.",
          "Delivery: Delivery shall be as mutually agreed after order confirmation.",
          "Payment Terms: As per agreed commercial terms.",
        ];

    for (let i = 0; i < numberedTerms.length; i++) {
      const term = `${i + 1}. ${numberedTerms[i]}`;
      const lines = wrapText(term, fontSans, 8.6, PW - MARGIN_X * 2);
      const blockH = lines.length * 12 + 2;
      ({ page, y } = ensureSpace(page, y, blockH, PAGE_OTHER_TOP, createStandardPage));
      for (const line of lines) {
        page.drawText(line, { x: MARGIN_X, y, size: 8.6, font: fontSans, color: rgb(0.15, 0.18, 0.26) });
        y -= 12;
      }
      y -= 2;
    }

    const annexures = listAttachments("quotations", q.id);
    if (annexures.length > 0) {
      ({ page, y } = ensureSpace(page, y, 20 + annexures.length * 11, PAGE_OTHER_TOP, createStandardPage));
      page.drawText("Annexures", { x: MARGIN_X, y, size: 9.6, font: fontSansBold, color: rgb(0.08, 0.16, 0.36) });
      y -= 13;
      for (let i = 0; i < annexures.length; i++) {
        page.drawText(`${i + 1}. ${annexures[i]!.fileName}`, { x: MARGIN_X, y, size: 8.4, font: fontSans });
        y -= 11;
      }
    }

    // Signature again on last page
    ({ page, y } = ensureSpace(page, y, 90, PAGE_OTHER_TOP, createStandardPage));
    y -= 10;
    page.drawText("For LAN Engineering & Technologies", { x: MARGIN_X, y, size: 10, font: fontSansBold });
    y -= 26;
    if (q.signatureMode === "typed" && q.signatureData) {
      page.drawText(q.signatureData, { x: MARGIN_X, y, size: 14, font: fontSansBold, color: rgb(0.08, 0.14, 0.35) });
      y -= 18;
    } else {
      page.drawLine({ start: { x: MARGIN_X, y }, end: { x: MARGIN_X + 150, y }, thickness: 0.6, color: rgb(0.45, 0.45, 0.5) });
      y -= 12;
    }

    for (const line of [
      q.signatureName || DEFAULT_SIGNER_NAME,
      q.signatureDesignation || DEFAULT_SIGNER_DESIGNATION,
      q.signatureMobile || DEFAULT_SIGNER_MOBILE,
      q.signatureEmail || "",
    ].filter(Boolean)) {
      page.drawText(line, { x: MARGIN_X, y, size: 9, font: fontSans });
      y -= 11;
    }

    const pdfBytes = await pdf.save();
    const filename = `${q.quotationNo}.pdf`;
    const inline = req.nextUrl.searchParams.get("inline") === "1";

    return new Response(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${filename}"`,
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (err) {
    return errorToResponse(err);
  }
}
