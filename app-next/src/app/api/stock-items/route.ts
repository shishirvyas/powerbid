import { NextRequest } from "next/server";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { stockItems, products, warehouses, stockMovements } from "@/lib/db/schema";
import {
  ApiError,
  errorToResponse,
  jsonOk, jsonList,
  parseJson,
  parseSearch,
  requireSession,
} from "@/lib/api";
import { stockItemSchema, listQuerySchema } from "@/lib/schemas";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    await requireSession();
    const { q, limit, offset } = parseSearch(new URL(req.url), listQuerySchema);
    
    const where = q
      ? or(
          ilike(products.name, `%${q}%`),
          ilike(products.sku, `%${q}%`),
          ilike(warehouses.name, `%${q}%`)
        )
      : undefined;

    const rows = await db
      .select({
        id: stockItems.id,
        productId: stockItems.productId,
        productName: products.name,
        productSku: products.sku,
        warehouseId: stockItems.warehouseId,
        warehouseName: warehouses.name,
        qtyOnHand: stockItems.qtyOnHand,
        qtyReserved: stockItems.qtyReserved,
        qtyAvailable: stockItems.qtyAvailable,
        binLocation: stockItems.binLocation,
        reorderLevel: stockItems.reorderLevel,
      })
      .from(stockItems)
      .innerJoin(products, eq(stockItems.productId, products.id))
      .innerJoin(warehouses, eq(stockItems.warehouseId, warehouses.id))
      .where(where)
      .orderBy(desc(stockItems.updatedAt))
      .limit(limit)
      .offset(offset);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(stockItems)
      .innerJoin(products, eq(stockItems.productId, products.id))
      .innerJoin(warehouses, eq(stockItems.warehouseId, warehouses.id))
      .where(where);

    return jsonList({ rows, total: count, limit, offset });
  } catch (err) {
    return errorToResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const data = await parseJson(req, stockItemSchema);

    const exists = await db
      .select({ id: stockItems.id })
      .from(stockItems)
      .where(and(eq(stockItems.productId, data.productId), eq(stockItems.warehouseId, data.warehouseId)))
      .limit(1);

    if (exists.length) {
      throw new ApiError(409, "Stock item already tracking in this warehouse.");
    }

    const row = await db.transaction(async (tx) => {
      const [item] = await tx
        .insert(stockItems)
        .values({
          productId: data.productId,
          warehouseId: data.warehouseId,
          binLocation: data.binLocation,
          reorderLevel: data.reorderLevel.toString(),
          qtyOnHand: (data.initialQty || 0).toString(),
          qtyAvailable: (data.initialQty || 0).toString(),
        })
        .returning();

      if (data.initialQty && data.initialQty > 0) {
        await tx.insert(stockMovements).values({
          productId: data.productId,
          warehouseId: data.warehouseId,
          movementType: "in",
          qty: data.initialQty.toString(),
          referenceType: "adjustment",
          remarks: "Initial stock creation",
          createdBy: session.userId,
        });
      }

      return item;
    });

    return jsonOk(row, { status: 201 });
  } catch (err) {
    return errorToResponse(err);
  }
}
