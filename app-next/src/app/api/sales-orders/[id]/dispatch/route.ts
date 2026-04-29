import { and, eq, ilike, sql } from "drizzle-orm";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  dispatchItems,
  dispatchOrders,
  salesOrderItems,
  salesOrders,
  stockItems,
  stockMovements,
} from "@/lib/db/schema";
import { ApiError, errorToResponse, jsonOk, parseId, parseJson, requireSession } from "@/lib/api";
import { salesDispatchSchema } from "@/lib/schemas";

type Ctx = { params: Promise<{ id: string }> };

export const runtime = "nodejs";

async function nextDispatchNumber() {
  const year = new Date().getFullYear();
  const prefix = `DO-${year}-`;
  const rows = await db
    .select({ max: sql<string | null>`max(${dispatchOrders.dispatchNumber})` })
    .from(dispatchOrders)
    .where(ilike(dispatchOrders.dispatchNumber, `${prefix}%`));
  const max = rows[0]?.max ?? null;
  const last = max ? Number(max.slice(prefix.length)) : 0;
  const next = String((Number.isFinite(last) ? last : 0) + 1).padStart(4, "0");
  return `${prefix}${next}`;
}

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireSession();
    if (session.role === "viewer") throw new ApiError(403, "Only sales/admin users can dispatch orders");
    const soId = parseId((await ctx.params).id);
    const data = await parseJson(req, salesDispatchSchema);

    const row = await db.transaction(async (tx) => {
      const [order] = await tx.select().from(salesOrders).where(eq(salesOrders.id, soId));
      if (!order) throw new ApiError(404, "Sales order not found");
      if (order.status === "cancelled") throw new ApiError(409, "Cannot dispatch cancelled order");

      const soLines = await tx.select().from(salesOrderItems).where(eq(salesOrderItems.soId, soId));
      const lineMap = new Map(soLines.map((line) => [line.id, line]));

      for (const item of data.items) {
        const line = lineMap.get(item.soItemId);
        if (!line) throw new ApiError(400, "Invalid sales order line in dispatch payload");
        if (!line.productId) throw new ApiError(400, `Product mapping missing for ${line.productName}`);

        const pending = Number(line.qty) - Number(line.dispatchedQty);
        if (item.qty > pending) throw new ApiError(400, `Dispatch qty exceeds pending qty for ${line.productName}`);

        const [stock] = await tx
          .select()
          .from(stockItems)
          .where(and(eq(stockItems.productId, line.productId), eq(stockItems.warehouseId, data.warehouseId)));
        if (!stock) throw new ApiError(400, `No stock found in selected warehouse for ${line.productName}`);
        if (Number(stock.qtyAvailable) < item.qty) throw new ApiError(400, `Insufficient stock for ${line.productName}`);
      }

      const [dispatch] = await tx
        .insert(dispatchOrders)
        .values({
          dispatchNumber: await nextDispatchNumber(),
          soId,
          warehouseId: data.warehouseId,
          dispatchDate: data.dispatchDate,
          status: "dispatched",
          transporterName: data.transporterName,
          vehicleNumber: data.vehicleNumber,
          trackingNumber: data.trackingNumber,
          notes: data.notes,
          createdBy: session.userId,
        })
        .returning();

      for (const item of data.items) {
        const line = lineMap.get(item.soItemId)!;
        const [stock] = await tx
          .select()
          .from(stockItems)
          .where(and(eq(stockItems.productId, line.productId!), eq(stockItems.warehouseId, data.warehouseId)));

        await tx
          .update(stockItems)
          .set({
            qtyOnHand: (Number(stock.qtyOnHand) - item.qty).toString(),
            qtyAvailable: (Number(stock.qtyAvailable) - item.qty).toString(),
            updatedAt: new Date(),
          })
          .where(eq(stockItems.id, stock.id));

        await tx.insert(stockMovements).values({
          productId: line.productId!,
          warehouseId: data.warehouseId,
          movementType: "out",
          qty: String(item.qty),
          referenceType: "dispatch",
          referenceId: String(dispatch.id),
          remarks: `Dispatch against ${order.soNumber}`,
          createdBy: session.userId,
        });

        await tx.insert(dispatchItems).values({
          dispatchId: dispatch.id,
          soItemId: line.id,
          productId: line.productId,
          qty: String(item.qty),
        });

        await tx
          .update(salesOrderItems)
          .set({
            dispatchedQty: (Number(line.dispatchedQty) + item.qty).toString(),
          })
          .where(eq(salesOrderItems.id, line.id));
      }

      const updatedLines = await tx.select().from(salesOrderItems).where(eq(salesOrderItems.soId, soId));
      const allDispatched = updatedLines.every((line) => Number(line.dispatchedQty) >= Number(line.qty));
      const anyDispatched = updatedLines.some((line) => Number(line.dispatchedQty) > 0);

      await tx
        .update(salesOrders)
        .set({
          status: allDispatched ? "dispatched" : anyDispatched ? "partially_dispatched" : order.status,
          updatedBy: session.userId,
          updatedAt: new Date(),
        })
        .where(eq(salesOrders.id, soId));

      return dispatch;
    });

    return jsonOk(row, { status: 201 });
  } catch (err) {
    return errorToResponse(err);
  }
}
