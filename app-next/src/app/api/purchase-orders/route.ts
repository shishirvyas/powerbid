import { NextRequest } from "next/server";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { purchaseOrders, suppliers } from "@/lib/db/schema";
import {
  ApiError,
  errorToResponse,
  jsonOk, jsonList,
  parseJson,
  parseSearch,
  requireSession,
} from "@/lib/api";
import { purchaseOrderSchema, listQuerySchema } from "@/lib/schemas";

export const runtime = "nodejs";

async function nextPoNumber() {
  const year = new Date().getFullYear();
  const prefix = `PO-${year}-`;
  const rows = await db
    .select({ max: sql<string | null>`max(${purchaseOrders.poNumber})` })
    .from(purchaseOrders)
    .where(ilike(purchaseOrders.poNumber, `${prefix}%`));
  const max = rows[0]?.max ?? null;
  const last = max ? Number(max.slice(prefix.length)) : 0;
  const next = String((Number.isFinite(last) ? last : 0) + 1).padStart(4, "0");
  return `${prefix}${next}`;
}

export async function GET(req: NextRequest) {
  try {
    await requireSession();
    const { q, limit, offset } = parseSearch(new URL(req.url), listQuerySchema);
    
    // Simple join search
    const where = q
      ? or(
          ilike(purchaseOrders.poNumber, `%${q}%`),
          ilike(suppliers.companyName, `%${q}%`),
        )
      : undefined;

    const rows = await db
      .select({
        id: purchaseOrders.id,
        poNumber: purchaseOrders.poNumber,
        supplierName: suppliers.companyName,
        supplierId: purchaseOrders.supplierId,
        soId: purchaseOrders.soId,
        bomId: purchaseOrders.bomId,
        expectedDate: purchaseOrders.expectedDate,
        status: purchaseOrders.status,
        grandTotal: purchaseOrders.grandTotal,
        currency: purchaseOrders.currency,
        createdAt: purchaseOrders.createdAt,
      })
      .from(purchaseOrders)
      .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
      .where(where)
      .orderBy(desc(purchaseOrders.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(purchaseOrders)
      .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
      .where(where);

    return jsonList({ rows, total: count, limit, offset });
  } catch (err) {
    return errorToResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const data = await parseJson(req, purchaseOrderSchema);
    
    // Calculate totals on backend too to ensure integrity
    const { calcPurchaseOrder } = await import("@/lib/calc");
    const calc = calcPurchaseOrder(data);

    const { purchaseOrderItems } = await import("@/lib/db/schema");

    let row: Awaited<ReturnType<typeof db.transaction>> | null = null;
    let lastErr: unknown = null;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        const poNumber = await nextPoNumber();
        row = await db.transaction(async (tx) => {
          const [po] = await tx
            .insert(purchaseOrders)
            .values({
              poNumber,
              supplierId: data.supplierId,
              soId: data.soId ?? null,
              bomId: data.bomId ?? null,
              expectedDate: data.expectedDate,
              status: data.status,
              currency: data.currency,
              discountType: data.discountType,
              discountValue: data.discountValue.toString(),
              freightAmount: calc.freightAmount.toString(),
              subtotal: calc.subtotal.toString(),
              discountAmount: calc.discountAmount.toString(),
              taxableAmount: calc.taxableAmount.toString(),
              gstAmount: calc.gstAmount.toString(),
              grandTotal: calc.grandTotal.toString(),
              remarks: data.remarks,
              termsConditions: data.termsConditions,
              paymentTerms: data.paymentTerms,
              createdBy: session.userId,
              updatedBy: session.userId,
            })
            .returning();

          if (calc.lines.length > 0) {
            await tx.insert(purchaseOrderItems).values(
              calc.lines.map((l, i) => ({
                poId: po.id,
                productId: l.productId,
                productName: l.productName,
                unitName: l.unitName,
                qty: l.qty.toString(),
                unitPrice: l.unitPrice.toString(),
                discountPercent: l.discountPercent.toString(),
                gstRate: l.gstRate.toString(),
                gstSlabId: l.gstSlabId,
                lineSubtotal: l.lineSubtotal.toString(),
                lineGst: l.lineGst.toString(),
                lineTotal: l.lineTotal.toString(),
                sortOrder: i,
              })),
            );
          }
          return po;
        });
        break;
      } catch (err) {
        lastErr = err;
        const message = err instanceof Error ? err.message.toLowerCase() : "";
        if (!message.includes("duplicate") && !message.includes("unique")) {
          throw err;
        }
      }
    }

    if (!row) throw (lastErr instanceof Error ? lastErr : new ApiError(500, "Failed to create PO"));

    return jsonOk(row, { status: 201 });
  } catch (err) {
    return errorToResponse(err);
  }
}
