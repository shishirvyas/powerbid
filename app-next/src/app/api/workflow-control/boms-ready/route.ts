import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { bomItems, bomMaster, products, purchaseOrders, salesOrders } from "@/lib/db/schema";
import { errorToResponse, jsonList, parseSearch, requireSession } from "@/lib/api";
import { listQuerySchema } from "@/lib/schemas";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    await requireSession();
    const { q, limit, offset } = parseSearch(new URL(req.url), listQuerySchema);

    const where = q
      ? or(
          ilike(bomMaster.bomCode, `%${q}%`),
          ilike(products.name, `%${q}%`),
          ilike(products.sku, `%${q}%`),
          ilike(salesOrders.soNumber, `%${q}%`),
        )
      : undefined;

    const rows = await db
      .select({
        id: bomMaster.id,
        bomCode: bomMaster.bomCode,
        version: bomMaster.version,
        isActive: bomMaster.isActive,
        soId: bomMaster.soId,
        soNumber: salesOrders.soNumber,
        productName: products.name,
        productSku: products.sku,
        createdAt: bomMaster.createdAt,
      })
      .from(bomMaster)
      .innerJoin(products, eq(bomMaster.productId, products.id))
      .leftJoin(salesOrders, eq(bomMaster.soId, salesOrders.id))
      .where(where)
      .orderBy(desc(bomMaster.updatedAt))
      .limit(limit)
      .offset(offset);

    const ids = rows.map((r) => r.id);
    let itemCounts: Record<number, number> = {};
    let supplierReadyCounts: Record<number, number> = {};
    let openPoCounts: Record<number, number> = {};

    if (ids.length > 0) {
      const counts = await db
        .select({ bomId: bomItems.bomId, count: sql<number>`count(*)::int` })
        .from(bomItems)
        .where(inArray(bomItems.bomId, ids))
        .groupBy(bomItems.bomId);
      itemCounts = Object.fromEntries(counts.map((r) => [r.bomId, r.count]));

      const supplierReady = await db
        .select({ bomId: bomItems.bomId, count: sql<number>`count(*)::int` })
        .from(bomItems)
        .where(and(inArray(bomItems.bomId, ids), sql`${bomItems.supplierProductId} is not null`))
        .groupBy(bomItems.bomId);
      supplierReadyCounts = Object.fromEntries(supplierReady.map((r) => [r.bomId, r.count]));

      const openCounts = await db
        .select({ bomId: purchaseOrders.bomId, count: sql<number>`count(*)::int` })
        .from(purchaseOrders)
        .where(
          and(
            inArray(purchaseOrders.bomId, ids),
            sql`${purchaseOrders.bomId} is not null`,
            sql`${purchaseOrders.status} not in ('closed', 'cancelled')`,
          ),
        )
        .groupBy(purchaseOrders.bomId);
      openPoCounts = Object.fromEntries(openCounts.map((r) => [Number(r.bomId), r.count]));
    }

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(bomMaster)
      .innerJoin(products, eq(bomMaster.productId, products.id))
      .leftJoin(salesOrders, eq(bomMaster.soId, salesOrders.id))
      .where(where);

    return jsonList({
      rows: rows.map((r) => ({
        ...r,
        itemCount: itemCounts[r.id] || 0,
        supplierReadyCount: supplierReadyCounts[r.id] || 0,
        openPoCount: openPoCounts[r.id] || 0,
      })),
      total: count,
      limit,
      offset,
    });
  } catch (err) {
    return errorToResponse(err);
  }
}
