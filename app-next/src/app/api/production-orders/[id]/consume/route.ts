import { and, eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { productionConsumption, productionOrders, stockItems, stockMovements } from "@/lib/db/schema";
import { ApiError, errorToResponse, jsonOk, parseId, parseJson, requireSession } from "@/lib/api";
import { productionConsumeSchema } from "@/lib/schemas";

type Ctx = { params: Promise<{ id: string }> };

export const runtime = "nodejs";

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireSession();
    if (session.role === "viewer") throw new ApiError(403, "Only sales/admin users can consume material");
    const id = parseId((await ctx.params).id);
    const data = await parseJson(req, productionConsumeSchema);

    const row = await db.transaction(async (tx) => {
      const [order] = await tx.select().from(productionOrders).where(eq(productionOrders.id, id));
      if (!order) throw new ApiError(404, "Production order not found");
      if (order.status !== "in_progress") throw new ApiError(409, "Production order must be in progress");

      const [consumption] = await tx
        .select()
        .from(productionConsumption)
        .where(and(eq(productionConsumption.productionId, id), eq(productionConsumption.rawMaterialId, data.rawMaterialId)));
      if (!consumption) throw new ApiError(404, "Material line not found in BOM consumption plan");

      const nextConsumed = Number(consumption.qtyConsumed) + Number(data.qty);
      if (nextConsumed > Number(consumption.qtyPlanned)) {
        throw new ApiError(400, "Consumption exceeds planned quantity");
      }

      const [stock] = await tx
        .select()
        .from(stockItems)
        .where(and(eq(stockItems.productId, data.rawMaterialId), eq(stockItems.warehouseId, order.warehouseId)));
      if (!stock) throw new ApiError(400, "No stock item found for selected material in production warehouse");

      const qty = Number(data.qty);
      if (Number(stock.qtyAvailable) < qty) throw new ApiError(400, "Insufficient available stock");

      await tx
        .update(stockItems)
        .set({
          qtyOnHand: (Number(stock.qtyOnHand) - qty).toString(),
          qtyAvailable: (Number(stock.qtyAvailable) - qty).toString(),
          updatedAt: new Date(),
        })
        .where(eq(stockItems.id, stock.id));

      await tx.insert(stockMovements).values({
        productId: data.rawMaterialId,
        warehouseId: order.warehouseId,
        movementType: "out",
        qty: qty.toString(),
        referenceType: "production",
        referenceId: String(order.id),
        remarks: data.remarks || `Consumed in ${order.productionNumber}`,
        createdBy: session.userId,
      });

      const [updated] = await tx
        .update(productionConsumption)
        .set({
          qtyConsumed: nextConsumed.toString(),
          notes: data.remarks || consumption.notes,
          updatedAt: new Date(),
        })
        .where(eq(productionConsumption.id, consumption.id))
        .returning();

      return updated;
    });

    return jsonOk(row);
  } catch (err) {
    return errorToResponse(err);
  }
}
