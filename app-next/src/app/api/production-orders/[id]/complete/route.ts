import { and, eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { productionOrders, productionOutput, stockItems, stockMovements } from "@/lib/db/schema";
import { ApiError, errorToResponse, jsonOk, parseId, parseJson, requireSession } from "@/lib/api";
import { productionCompleteSchema } from "@/lib/schemas";

type Ctx = { params: Promise<{ id: string }> };

export const runtime = "nodejs";

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireSession();
    if (session.role === "viewer") throw new ApiError(403, "Only sales/admin users can complete production");
    const id = parseId((await ctx.params).id);
    const data = await parseJson(req, productionCompleteSchema);

    const row = await db.transaction(async (tx) => {
      const [order] = await tx.select().from(productionOrders).where(eq(productionOrders.id, id));
      if (!order) throw new ApiError(404, "Production order not found");
      if (order.status !== "in_progress") throw new ApiError(409, "Only in-progress orders can be completed");

      const qty = Number(data.qtyProduced);
      const [stock] = await tx
        .select()
        .from(stockItems)
        .where(and(eq(stockItems.productId, order.productId), eq(stockItems.warehouseId, order.warehouseId)));

      if (stock) {
        await tx
          .update(stockItems)
          .set({
            qtyOnHand: (Number(stock.qtyOnHand) + qty).toString(),
            qtyAvailable: (Number(stock.qtyAvailable) + qty).toString(),
            updatedAt: new Date(),
          })
          .where(eq(stockItems.id, stock.id));
      } else {
        await tx.insert(stockItems).values({
          productId: order.productId,
          warehouseId: order.warehouseId,
          binLocation: null,
          reorderLevel: "0",
          qtyOnHand: qty.toString(),
          qtyAvailable: qty.toString(),
        });
      }

      await tx.insert(stockMovements).values({
        productId: order.productId,
        warehouseId: order.warehouseId,
        movementType: "in",
        qty: qty.toString(),
        referenceType: "production",
        referenceId: String(order.id),
        remarks: data.remarks || `Production output for ${order.productionNumber}`,
        createdBy: session.userId,
      });

      await tx.insert(productionOutput).values({
        productionId: order.id,
        productId: order.productId,
        warehouseId: order.warehouseId,
        qtyProduced: qty.toString(),
        remarks: data.remarks,
        createdBy: session.userId,
      });

      const [updated] = await tx
        .update(productionOrders)
        .set({
          producedQty: (Number(order.producedQty) + qty).toString(),
          status: "completed",
          endDate: new Date().toISOString().slice(0, 10),
          updatedBy: session.userId,
          updatedAt: new Date(),
        })
        .where(eq(productionOrders.id, order.id))
        .returning();

      return updated;
    });

    return jsonOk(row);
  } catch (err) {
    return errorToResponse(err);
  }
}
