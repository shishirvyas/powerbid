import { and, asc, eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { productionConsumption, productionOrders, productionOutput, products, warehouses } from "@/lib/db/schema";
import { ApiError, errorToResponse, jsonOk, parseId, parseJson, requireSession } from "@/lib/api";
import { productionOrderSchema } from "@/lib/schemas";

type Ctx = { params: Promise<{ id: string }> };

export const runtime = "nodejs";

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    await requireSession();
    const id = parseId((await ctx.params).id);

    const [order] = await db
      .select({
        id: productionOrders.id,
        productionNumber: productionOrders.productionNumber,
        status: productionOrders.status,
        plannedQty: productionOrders.plannedQty,
        producedQty: productionOrders.producedQty,
        startDate: productionOrders.startDate,
        endDate: productionOrders.endDate,
        notes: productionOrders.notes,
        bomId: productionOrders.bomId,
        productId: productionOrders.productId,
        productName: products.name,
        productSku: products.sku,
        warehouseId: productionOrders.warehouseId,
        warehouseName: warehouses.name,
        createdAt: productionOrders.createdAt,
      })
      .from(productionOrders)
      .innerJoin(products, eq(productionOrders.productId, products.id))
      .innerJoin(warehouses, eq(productionOrders.warehouseId, warehouses.id))
      .where(eq(productionOrders.id, id));

    if (!order) throw new ApiError(404, "Production order not found");

    const consumption = await db
      .select({
        id: productionConsumption.id,
        rawMaterialId: productionConsumption.rawMaterialId,
        rawMaterialName: products.name,
        rawMaterialSku: products.sku,
        qtyPlanned: productionConsumption.qtyPlanned,
        qtyConsumed: productionConsumption.qtyConsumed,
        notes: productionConsumption.notes,
      })
      .from(productionConsumption)
      .innerJoin(products, eq(productionConsumption.rawMaterialId, products.id))
      .where(eq(productionConsumption.productionId, id))
      .orderBy(asc(productionConsumption.id));

    const outputs = await db
      .select({
        id: productionOutput.id,
        qtyProduced: productionOutput.qtyProduced,
        remarks: productionOutput.remarks,
        createdAt: productionOutput.createdAt,
      })
      .from(productionOutput)
      .where(eq(productionOutput.productionId, id))
      .orderBy(asc(productionOutput.id));

    return jsonOk({ ...order, consumption, outputs });
  } catch (err) {
    return errorToResponse(err);
  }
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireSession();
    if (session.role === "viewer") throw new ApiError(403, "Only sales/admin users can update production orders");
    const id = parseId((await ctx.params).id);
    const data = await parseJson(req, productionOrderSchema);

    const [existing] = await db
      .select({ status: productionOrders.status })
      .from(productionOrders)
      .where(eq(productionOrders.id, id));
    if (!existing) throw new ApiError(404, "Production order not found");
    if (existing.status !== "draft") throw new ApiError(409, "Only draft production orders can be edited");

    const [row] = await db
      .update(productionOrders)
      .set({
        bomId: data.bomId || null,
        productId: data.productId,
        warehouseId: data.warehouseId,
        plannedQty: data.plannedQty.toString(),
        notes: data.notes,
        updatedBy: session.userId,
        updatedAt: new Date(),
      })
      .where(eq(productionOrders.id, id))
      .returning();

    return jsonOk(row);
  } catch (err) {
    return errorToResponse(err);
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireSession();
    if (session.role === "viewer") throw new ApiError(403, "Only sales/admin users can delete production orders");
    const id = parseId((await ctx.params).id);

    const [existing] = await db
      .select({ status: productionOrders.status })
      .from(productionOrders)
      .where(eq(productionOrders.id, id));
    if (!existing) throw new ApiError(404, "Production order not found");
    if (existing.status !== "draft" && existing.status !== "cancelled") {
      throw new ApiError(409, "Only draft/cancelled production orders can be deleted");
    }

    await db.delete(productionOrders).where(eq(productionOrders.id, id));
    return jsonOk({ ok: true });
  } catch (err) {
    return errorToResponse(err);
  }
}
