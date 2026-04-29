import { and, desc, eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { stockItems, stockMovements, warehouses } from "@/lib/db/schema";
import { ApiError, errorToResponse, jsonOk, parseId, parseJson, requireSession } from "@/lib/api";
import { stockMovementTxnSchema } from "@/lib/schemas";

type Ctx = { params: Promise<{ id: string }> };

export const runtime = "nodejs";

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    await requireSession();
    const id = parseId((await ctx.params).id);

    const [item] = await db
      .select({ productId: stockItems.productId, warehouseId: stockItems.warehouseId })
      .from(stockItems)
      .where(eq(stockItems.id, id));
    if (!item) throw new ApiError(404, "Stock item not found");

    const rows = await db
      .select({
        id: stockMovements.id,
        movementType: stockMovements.movementType,
        qty: stockMovements.qty,
        referenceType: stockMovements.referenceType,
        referenceId: stockMovements.referenceId,
        remarks: stockMovements.remarks,
        createdAt: stockMovements.createdAt,
        warehouseName: warehouses.name,
      })
      .from(stockMovements)
      .innerJoin(warehouses, eq(stockMovements.warehouseId, warehouses.id))
      .where(and(eq(stockMovements.productId, item.productId), eq(stockMovements.warehouseId, item.warehouseId)))
      .orderBy(desc(stockMovements.createdAt))
      .limit(100);

    return jsonOk(rows);
  } catch (err) {
    return errorToResponse(err);
  }
}

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireSession();
    if (session.role === "viewer") throw new ApiError(403, "Only sales/admin users can post stock movements");

    const id = parseId((await ctx.params).id);
    const data = await parseJson(req, stockMovementTxnSchema);

    const row = await db.transaction(async (tx) => {
      const [source] = await tx
        .select()
        .from(stockItems)
        .where(eq(stockItems.id, id));
      if (!source) throw new ApiError(404, "Stock item not found");

      const qty = Number(data.qty);
      const sourceOnHand = Number(source.qtyOnHand);
      const sourceAvailable = Number(source.qtyAvailable);

      if ((data.movementType === "out" || data.movementType === "transfer") && sourceAvailable < qty) {
        throw new ApiError(400, "Insufficient available stock");
      }

      if (data.movementType === "in") {
        await tx
          .update(stockItems)
          .set({
            qtyOnHand: (sourceOnHand + qty).toString(),
            qtyAvailable: (sourceAvailable + qty).toString(),
            updatedAt: new Date(),
          })
          .where(eq(stockItems.id, source.id));

        const [movement] = await tx
          .insert(stockMovements)
          .values({
            productId: source.productId,
            warehouseId: source.warehouseId,
            movementType: "in",
            qty: qty.toString(),
            referenceType: data.referenceType,
            referenceId: data.referenceId,
            remarks: data.remarks,
            createdBy: session.userId,
          })
          .returning();
        return movement;
      }

      if (data.movementType === "out") {
        await tx
          .update(stockItems)
          .set({
            qtyOnHand: (sourceOnHand - qty).toString(),
            qtyAvailable: (sourceAvailable - qty).toString(),
            updatedAt: new Date(),
          })
          .where(eq(stockItems.id, source.id));

        const [movement] = await tx
          .insert(stockMovements)
          .values({
            productId: source.productId,
            warehouseId: source.warehouseId,
            movementType: "out",
            qty: qty.toString(),
            referenceType: data.referenceType,
            referenceId: data.referenceId,
            remarks: data.remarks,
            createdBy: session.userId,
          })
          .returning();
        return movement;
      }

      if (!data.targetWarehouseId || data.targetWarehouseId === source.warehouseId) {
        throw new ApiError(400, "Select a different target warehouse for transfer");
      }

      await tx
        .update(stockItems)
        .set({
          qtyOnHand: (sourceOnHand - qty).toString(),
          qtyAvailable: (sourceAvailable - qty).toString(),
          updatedAt: new Date(),
        })
        .where(eq(stockItems.id, source.id));

      const [target] = await tx
        .select()
        .from(stockItems)
        .where(and(eq(stockItems.productId, source.productId), eq(stockItems.warehouseId, data.targetWarehouseId)))
        .limit(1);

      if (target) {
        await tx
          .update(stockItems)
          .set({
            qtyOnHand: (Number(target.qtyOnHand) + qty).toString(),
            qtyAvailable: (Number(target.qtyAvailable) + qty).toString(),
            updatedAt: new Date(),
          })
          .where(eq(stockItems.id, target.id));
      } else {
        await tx.insert(stockItems).values({
          productId: source.productId,
          warehouseId: data.targetWarehouseId,
          binLocation: null,
          reorderLevel: "0",
          qtyOnHand: qty.toString(),
          qtyAvailable: qty.toString(),
        });
      }

      await tx.insert(stockMovements).values({
        productId: source.productId,
        warehouseId: source.warehouseId,
        movementType: "transfer",
        qty: qty.toString(),
        referenceType: data.referenceType || "transfer",
        referenceId: data.referenceId,
        remarks: data.remarks,
        createdBy: session.userId,
      });

      const [movement] = await tx
        .insert(stockMovements)
        .values({
          productId: source.productId,
          warehouseId: data.targetWarehouseId,
          movementType: "in",
          qty: qty.toString(),
          referenceType: data.referenceType || "transfer",
          referenceId: data.referenceId,
          remarks: data.remarks ? `${data.remarks} (transfer in)` : "Transfer in",
          createdBy: session.userId,
        })
        .returning();

      return movement;
    });

    return jsonOk(row, { status: 201 });
  } catch (err) {
    return errorToResponse(err);
  }
}
