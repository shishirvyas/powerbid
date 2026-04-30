import { and, asc, desc, eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { calcQuotation } from "@/lib/calc";
import { db } from "@/lib/db";
import { customers, dispatchOrders, salesOrderItems, salesOrders, warehouses } from "@/lib/db/schema";
import { ApiError, errorToResponse, jsonOk, parseId, parseJson, requireSession } from "@/lib/api";
import { salesOrderSchema } from "@/lib/schemas";

type Ctx = { params: Promise<{ id: string }> };

export const runtime = "nodejs";

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    await requireSession();
    const id = parseId((await ctx.params).id);

    const [order] = await db
      .select({
        id: salesOrders.id,
        soNumber: salesOrders.soNumber,
        orderDate: salesOrders.orderDate,
        quotationId: salesOrders.quotationId,
        customerId: salesOrders.customerId,
        status: salesOrders.status,
        currency: salesOrders.currency,
        subtotal: salesOrders.subtotal,
        discountAmount: salesOrders.discountAmount,
        taxableAmount: salesOrders.taxableAmount,
        gstAmount: salesOrders.gstAmount,
        freightAmount: salesOrders.freightAmount,
        grandTotal: salesOrders.grandTotal,
        notes: salesOrders.notes,
        createdAt: salesOrders.createdAt,
        customerName: customers.name,
        customerCode: customers.code,
      })
      .from(salesOrders)
      .leftJoin(customers, eq(salesOrders.customerId, customers.id))
      .where(eq(salesOrders.id, id));
    if (!order) throw new ApiError(404, "Sales order not found");

    const items = await db
      .select()
      .from(salesOrderItems)
      .where(eq(salesOrderItems.soId, id))
      .orderBy(asc(salesOrderItems.sortOrder));

    const dispatches = await db
      .select({
        id: dispatchOrders.id,
        dispatchNumber: dispatchOrders.dispatchNumber,
        dispatchDate: dispatchOrders.dispatchDate,
        status: dispatchOrders.status,
        warehouseName: warehouses.name,
        trackingNumber: dispatchOrders.trackingNumber,
        transporterName: dispatchOrders.transporterName,
      })
      .from(dispatchOrders)
      .leftJoin(warehouses, eq(dispatchOrders.warehouseId, warehouses.id))
      .where(eq(dispatchOrders.soId, id))
      .orderBy(desc(dispatchOrders.createdAt));

    return jsonOk({ ...order, items, dispatches });
  } catch (err) {
    return errorToResponse(err);
  }
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireSession();
    if (session.role === "viewer") throw new ApiError(403, "Only sales/admin users can update sales orders");
    const id = parseId((await ctx.params).id);
    const data = await parseJson(req, salesOrderSchema);

    const [existing] = await db
      .select({ status: salesOrders.status })
      .from(salesOrders)
      .where(eq(salesOrders.id, id));
    if (!existing) throw new ApiError(404, "Sales order not found");
    if (existing.status !== "draft" && existing.status !== "confirmed") {
      throw new ApiError(409, "Only draft/confirmed orders can be edited");
    }

    const calc = calcQuotation({
      items: data.items.map((i) => ({
        productId: i.productId ?? 0,
        productName: i.productName,
        unitName: i.unitName || null,
        qty: i.qty,
        unitPrice: i.unitPrice,
        gstRate: i.gstRate,
        gstSlabId: null,
      })),
      discountType: "percent",
      discountValue: 0,
      freightAmount: 0,
    });

    await db.transaction(async (tx) => {
      await tx
        .update(salesOrders)
        .set({
          orderDate: data.orderDate,
          quotationId: data.quotationId || null,
          customerId: data.customerId,
          status: data.status,
          subtotal: String(calc.subtotal),
          discountAmount: String(calc.discountAmount),
          taxableAmount: String(calc.taxableAmount),
          gstAmount: String(calc.gstAmount),
          freightAmount: String(calc.freightAmount),
          grandTotal: String(calc.grandTotal),
          notes: data.notes,
          updatedBy: session.userId,
          updatedAt: new Date(),
        })
        .where(eq(salesOrders.id, id));

      await tx.delete(salesOrderItems).where(eq(salesOrderItems.soId, id));
      await tx.insert(salesOrderItems).values(
        calc.lines.map((line, idx) => ({
          soId: id,
          productId: line.productId || null,
          productName: line.productName,
          unitName: line.unitName || null,
          qty: String(line.qty),
          dispatchedQty: "0",
          unitPrice: String(line.unitPrice),
          gstRate: String(line.gstRate),
          lineSubtotal: String(line.lineSubtotal),
          lineGst: String(line.lineGst),
          lineTotal: String(line.lineTotal),
          sortOrder: idx,
        })),
      );
    });

    return jsonOk({ ok: true });
  } catch (err) {
    return errorToResponse(err);
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireSession();
    if (session.role === "viewer") throw new ApiError(403, "Only sales/admin users can delete sales orders");
    const id = parseId((await ctx.params).id);

    const [existing] = await db
      .select({ status: salesOrders.status })
      .from(salesOrders)
      .where(eq(salesOrders.id, id));
    if (!existing) throw new ApiError(404, "Sales order not found");
    if (existing.status === "dispatched" || existing.status === "partially_dispatched") {
      throw new ApiError(409, "Cannot delete dispatched sales order");
    }

    await db.delete(salesOrders).where(eq(salesOrders.id, id));
    return jsonOk({ ok: true });
  } catch (err) {
    return errorToResponse(err);
  }
}
