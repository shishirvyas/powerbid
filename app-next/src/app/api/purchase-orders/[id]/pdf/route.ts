import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { db } from "@/lib/db";
import { purchaseOrderItems, purchaseOrders, suppliers } from "@/lib/db/schema";
import { ApiError, errorToResponse, parseId, requireSession } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

function money(value: string | number | null | undefined) {
  const n = Number(value ?? 0);
  return `INR ${Number.isFinite(n) ? n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}`;
}

function dateLabel(input: string | null | undefined) {
  if (!input) return "—";
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return input;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export const runtime = "nodejs";

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    await requireSession();
    const id = parseId((await ctx.params).id);

    const [po] = await db
      .select({
        id: purchaseOrders.id,
        poNumber: purchaseOrders.poNumber,
        expectedDate: purchaseOrders.expectedDate,
        status: purchaseOrders.status,
        subtotal: purchaseOrders.subtotal,
        gstAmount: purchaseOrders.gstAmount,
        grandTotal: purchaseOrders.grandTotal,
        remarks: purchaseOrders.remarks,
        paymentTerms: purchaseOrders.paymentTerms,
        supplierName: suppliers.companyName,
        supplierEmail: suppliers.email,
        supplierPhone: suppliers.phone,
      })
      .from(purchaseOrders)
      .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
      .where(eq(purchaseOrders.id, id));

    if (!po) throw new ApiError(404, "Purchase Order not found");

    const items = await db
      .select({
        productName: purchaseOrderItems.productName,
        unitName: purchaseOrderItems.unitName,
        qty: purchaseOrderItems.qty,
        unitPrice: purchaseOrderItems.unitPrice,
        gstRate: purchaseOrderItems.gstRate,
        lineTotal: purchaseOrderItems.lineTotal,
      })
      .from(purchaseOrderItems)
      .where(eq(purchaseOrderItems.poId, id));

    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595.28, 841.89]);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

    let y = 800;
    page.drawText("PURCHASE ORDER", { x: 50, y, size: 18, font: bold, color: rgb(0.05, 0.1, 0.2) });
    y -= 24;
    page.drawText(`PO Number: ${po.poNumber}`, { x: 50, y, size: 10, font: bold });
    page.drawText(`Date: ${dateLabel(po.expectedDate)}`, { x: 380, y, size: 10, font });
    y -= 18;
    page.drawText(`Supplier: ${po.supplierName || "—"}`, { x: 50, y, size: 10, font });
    y -= 14;
    page.drawText(`Email: ${po.supplierEmail || "—"}`, { x: 50, y, size: 10, font });
    y -= 14;
    page.drawText(`Phone: ${po.supplierPhone || "—"}`, { x: 50, y, size: 10, font });
    y -= 14;
    page.drawText(`Status: ${po.status.replace("_", " ").toUpperCase()}`, { x: 50, y, size: 10, font: bold });

    y -= 24;
    page.drawLine({ start: { x: 50, y }, end: { x: 545, y }, thickness: 1, color: rgb(0.75, 0.78, 0.85) });
    y -= 16;
    page.drawText("#", { x: 50, y, size: 10, font: bold });
    page.drawText("Item", { x: 75, y, size: 10, font: bold });
    page.drawText("Qty", { x: 300, y, size: 10, font: bold });
    page.drawText("Unit Price", { x: 350, y, size: 10, font: bold });
    page.drawText("GST%", { x: 440, y, size: 10, font: bold });
    page.drawText("Total", { x: 485, y, size: 10, font: bold });
    y -= 10;
    page.drawLine({ start: { x: 50, y }, end: { x: 545, y }, thickness: 0.7, color: rgb(0.8, 0.82, 0.88) });

    y -= 16;
    items.forEach((item, idx) => {
      if (y < 160) return;
      page.drawText(String(idx + 1), { x: 50, y, size: 9, font });
      page.drawText(item.productName, { x: 75, y, size: 9, font });
      page.drawText(String(Number(item.qty)), { x: 300, y, size: 9, font });
      page.drawText(money(item.unitPrice), { x: 350, y, size: 9, font });
      page.drawText(String(Number(item.gstRate).toFixed(2)), { x: 440, y, size: 9, font });
      page.drawText(money(item.lineTotal), { x: 485, y, size: 9, font });
      y -= 14;
    });

    y = Math.max(130, y - 8);
    page.drawLine({ start: { x: 50, y }, end: { x: 545, y }, thickness: 0.7, color: rgb(0.8, 0.82, 0.88) });
    y -= 18;

    page.drawText(`Subtotal: ${money(po.subtotal)}`, { x: 360, y, size: 10, font });
    y -= 14;
    page.drawText(`GST: ${money(po.gstAmount)}`, { x: 360, y, size: 10, font });
    y -= 16;
    page.drawText(`Grand Total: ${money(po.grandTotal)}`, { x: 360, y, size: 11, font: bold });

    y -= 26;
    page.drawText("Payment Terms:", { x: 50, y, size: 10, font: bold });
    y -= 14;
    page.drawText((po.paymentTerms || "—").replace(/<[^>]+>/g, " ").slice(0, 180), { x: 50, y, size: 9, font });

    y -= 24;
    page.drawText("Remarks:", { x: 50, y, size: 10, font: bold });
    y -= 14;
    page.drawText((po.remarks || "—").replace(/<[^>]+>/g, " ").slice(0, 220), { x: 50, y, size: 9, font });

    const bytes = await pdf.save();

    return new Response(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename=\"${po.poNumber}.pdf\"`,
        "Cache-Control": "private, max-age=0, must-revalidate",
      },
    });
  } catch (err) {
    return errorToResponse(err);
  }
}
