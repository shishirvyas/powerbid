import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { purchaseOrders, purchaseOrderItems, suppliers } from "@/lib/db/schema";
import {
  ApiError,
  errorToResponse,
  jsonOk,
  parseId,
  parseJson,
  requireSession,
} from "@/lib/api";
import { purchaseOrderSchema } from "@/lib/schemas";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    await requireSession();
    const id = parseId((await ctx.params).id);

    const [po] = await db
      .select({
        id: purchaseOrders.id,
        poNumber: purchaseOrders.poNumber,
        soId: purchaseOrders.soId,
        bomId: purchaseOrders.bomId,
        expectedDate: purchaseOrders.expectedDate,
        status: purchaseOrders.status,
        approvalMode: purchaseOrders.approvalMode,
        approvedBy: purchaseOrders.approvedBy,
        approvedAt: purchaseOrders.approvedAt,
        selfApprovalScanName: purchaseOrders.selfApprovalScanName,
        selfApprovalScanPath: purchaseOrders.selfApprovalScanPath,
        currency: purchaseOrders.currency,
        discountType: purchaseOrders.discountType,
        discountValue: purchaseOrders.discountValue,
        discountAmount: purchaseOrders.discountAmount,
        subtotal: purchaseOrders.subtotal,
        taxableAmount: purchaseOrders.taxableAmount,
        gstAmount: purchaseOrders.gstAmount,
        freightAmount: purchaseOrders.freightAmount,
        grandTotal: purchaseOrders.grandTotal,
        remarks: purchaseOrders.remarks,
        termsConditions: purchaseOrders.termsConditions,
        paymentTerms: purchaseOrders.paymentTerms,
        createdAt: purchaseOrders.createdAt,
        supplier: {
          id: suppliers.id,
          code: suppliers.code,
          companyName: suppliers.companyName,
          email: suppliers.email,
          phone: suppliers.phone,
        },
      })
      .from(purchaseOrders)
      .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
      .where(eq(purchaseOrders.id, id));

    if (!po) throw new ApiError(404, "Purchase Order not found");

    const items = await db
      .select()
      .from(purchaseOrderItems)
      .where(eq(purchaseOrderItems.poId, id))
      .orderBy(purchaseOrderItems.sortOrder);

    return jsonOk({ ...po, items });
  } catch (err) {
    return errorToResponse(err);
  }
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireSession();
    const id = parseId((await ctx.params).id);
    const data = await parseJson(req, purchaseOrderSchema);
    if (data.status === "approved" || data.status === "sent") {
      throw new ApiError(400, "Use approval and dispatch actions to move PO to approved/sent");
    }

    const { calcPurchaseOrder } = await import("@/lib/calc");
    const calc = calcPurchaseOrder(data);

    const row = await db.transaction(async (tx) => {
      const [po] = await tx
        .update(purchaseOrders)
        .set({
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
          updatedBy: session.userId,
          updatedAt: new Date(),
        })
        .where(eq(purchaseOrders.id, id))
        .returning();

      if (!po) throw new ApiError(404, "Purchase Order not found");

      await tx.delete(purchaseOrderItems).where(eq(purchaseOrderItems.poId, id));

      if (calc.lines.length > 0) {
        await tx.insert(purchaseOrderItems).values(
          calc.lines.map((l, i) => ({
            poId: id,
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
          }))
        );
      }
      return po;
    });

    return jsonOk(row);
  } catch (err) {
    return errorToResponse(err);
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    await requireSession();
    const id = parseId((await ctx.params).id);
    const [row] = await db.delete(purchaseOrders).where(eq(purchaseOrders.id, id)).returning();
    if (!row) throw new ApiError(404, "Purchase Order not found");
    return jsonOk({ ok: true });
  } catch (err) {
    return errorToResponse(err);
  }
}
