import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { bomItems, bomMaster, products } from "@/lib/db/schema";
import { ApiError, errorToResponse, jsonOk, parseJson, parseSearch, requireSession } from "@/lib/api";
import { bomMasterSchema, listQuerySchema } from "@/lib/schemas";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    await requireSession();
    const { q, limit, offset } = parseSearch(new URL(req.url), listQuerySchema);

    const where = q
      ? or(ilike(bomMaster.bomCode, `%${q}%`), ilike(products.name, `%${q}%`), ilike(products.sku, `%${q}%`))
      : undefined;

    const rows = await db
      .select({
        id: bomMaster.id,
        bomCode: bomMaster.bomCode,
        version: bomMaster.version,
        isActive: bomMaster.isActive,
        laborCost: bomMaster.laborCost,
        overheadCost: bomMaster.overheadCost,
        createdAt: bomMaster.createdAt,
        productId: products.id,
        productName: products.name,
        productSku: products.sku,
      })
      .from(bomMaster)
      .innerJoin(products, eq(bomMaster.productId, products.id))
      .where(where)
      .orderBy(desc(bomMaster.updatedAt))
      .limit(limit)
      .offset(offset);

    const ids = rows.map((r) => r.id);
    let counts: Record<number, number> = {};
    if (ids.length > 0) {
      const itemCounts = await db
        .select({ bomId: bomItems.bomId, count: sql<number>`count(*)::int` })
        .from(bomItems)
        .where(sql`${bomItems.bomId} in (${sql.join(ids.map((id) => sql`${id}`), sql`,`)})`)
        .groupBy(bomItems.bomId);
      counts = Object.fromEntries(itemCounts.map((r) => [r.bomId, r.count]));
    }

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(bomMaster)
      .innerJoin(products, eq(bomMaster.productId, products.id))
      .where(where);

    return jsonOk({
      rows: rows.map((r) => ({ ...r, itemCount: counts[r.id] || 0 })),
      total: count,
      limit,
      offset,
    });
  } catch (err) {
    return errorToResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    if (session.role === "viewer") throw new ApiError(403, "Only sales/admin users can create BOM");
    const data = await parseJson(req, bomMasterSchema);

    const row = await db.transaction(async (tx) => {
      if (data.isActive) {
        await tx
          .update(bomMaster)
          .set({ isActive: false, updatedAt: new Date() })
          .where(eq(bomMaster.productId, data.productId));
      }

      const [master] = await tx
        .insert(bomMaster)
        .values({
          productId: data.productId,
          bomCode: data.bomCode,
          version: data.version,
          isActive: data.isActive,
          laborCost: data.laborCost.toString(),
          overheadCost: data.overheadCost.toString(),
          notes: data.notes,
          createdBy: session.userId,
        })
        .returning();

      await tx.insert(bomItems).values(
        data.items.map((it) => ({
          bomId: master.id,
          rawMaterialId: it.rawMaterialId,
          qtyPerUnit: it.qtyPerUnit.toString(),
          unitName: it.unitName,
          wastagePercent: it.wastagePercent.toString(),
          notes: it.notes,
        })),
      );

      return master;
    });

    return jsonOk(row, { status: 201 });
  } catch (err) {
    return errorToResponse(err);
  }
}
