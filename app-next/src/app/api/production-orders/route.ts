import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { bomItems, bomMaster, productionConsumption, productionOrders, products, warehouses } from "@/lib/db/schema";
import { ApiError, errorToResponse, jsonOk, parseJson, parseSearch, requireSession } from "@/lib/api";
import { listQuerySchema, productionOrderSchema } from "@/lib/schemas";

export const runtime = "nodejs";

async function nextProductionNumber() {
  const year = new Date().getFullYear();
  const prefix = `PROD-${year}-`;
  const rows = await db
    .select({ max: sql<string | null>`max(${productionOrders.productionNumber})` })
    .from(productionOrders)
    .where(ilike(productionOrders.productionNumber, `${prefix}%`));
  const max = rows[0]?.max ?? null;
  const lastNum = max ? Number(max.slice(prefix.length)) : 0;
  const next = String((Number.isFinite(lastNum) ? lastNum : 0) + 1).padStart(4, "0");
  return `${prefix}${next}`;
}

export async function GET(req: NextRequest) {
  try {
    await requireSession();
    const { q, limit, offset } = parseSearch(new URL(req.url), listQuerySchema);

    const where = q
      ? or(
          ilike(productionOrders.productionNumber, `%${q}%`),
          ilike(products.name, `%${q}%`),
          ilike(warehouses.name, `%${q}%`),
        )
      : undefined;

    const rows = await db
      .select({
        id: productionOrders.id,
        productionNumber: productionOrders.productionNumber,
        status: productionOrders.status,
        plannedQty: productionOrders.plannedQty,
        producedQty: productionOrders.producedQty,
        startDate: productionOrders.startDate,
        endDate: productionOrders.endDate,
        createdAt: productionOrders.createdAt,
        productId: productionOrders.productId,
        productName: products.name,
        productSku: products.sku,
        warehouseId: productionOrders.warehouseId,
        warehouseName: warehouses.name,
        bomId: productionOrders.bomId,
        bomCode: bomMaster.bomCode,
      })
      .from(productionOrders)
      .innerJoin(products, eq(productionOrders.productId, products.id))
      .innerJoin(warehouses, eq(productionOrders.warehouseId, warehouses.id))
      .leftJoin(bomMaster, eq(productionOrders.bomId, bomMaster.id))
      .where(where)
      .orderBy(desc(productionOrders.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(productionOrders)
      .innerJoin(products, eq(productionOrders.productId, products.id))
      .innerJoin(warehouses, eq(productionOrders.warehouseId, warehouses.id))
      .leftJoin(bomMaster, eq(productionOrders.bomId, bomMaster.id))
      .where(where);

    return jsonOk({ rows, total: count, limit, offset });
  } catch (err) {
    return errorToResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    if (session.role === "viewer") throw new ApiError(403, "Only sales/admin users can create production orders");
    const data = await parseJson(req, productionOrderSchema);

    const row = await db.transaction(async (tx) => {
      let bomPlanItems: Array<{ rawMaterialId: number; qtyPerUnit: string; wastagePercent: string }> = [];
      if (data.bomId) {
        const [bom] = await tx
          .select({ id: bomMaster.id, productId: bomMaster.productId })
          .from(bomMaster)
          .where(eq(bomMaster.id, data.bomId));
        if (!bom) throw new ApiError(400, "BOM not found");
        if (bom.productId !== data.productId) throw new ApiError(400, "Selected BOM does not match product");
        bomPlanItems = await tx
          .select({
            rawMaterialId: bomItems.rawMaterialId,
            qtyPerUnit: bomItems.qtyPerUnit,
            wastagePercent: bomItems.wastagePercent,
          })
          .from(bomItems)
          .where(eq(bomItems.bomId, data.bomId));
      }

      const [order] = await tx
        .insert(productionOrders)
        .values({
          productionNumber: await nextProductionNumber(),
          bomId: data.bomId || null,
          productId: data.productId,
          warehouseId: data.warehouseId,
          status: "draft",
          plannedQty: data.plannedQty.toString(),
          notes: data.notes,
          createdBy: session.userId,
          updatedBy: session.userId,
        })
        .returning();

      if (bomPlanItems.length > 0) {
        await tx.insert(productionConsumption).values(
          bomPlanItems.map((item) => {
            const qty = Number(item.qtyPerUnit) * Number(data.plannedQty || 0);
            const planned = qty * (1 + Number(item.wastagePercent) / 100);
            return {
              productionId: order.id,
              rawMaterialId: item.rawMaterialId,
              qtyPlanned: planned.toString(),
              qtyConsumed: "0",
            };
          }),
        );
      }

      return order;
    });

    return jsonOk(row, { status: 201 });
  } catch (err) {
    return errorToResponse(err);
  }
}
