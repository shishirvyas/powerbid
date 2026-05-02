import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { NextRequest } from "next/server";
import { calcBomRollup } from "@/lib/calc";
import { db } from "@/lib/db";
import { bomItems, bomMaster, products, purchaseOrderItems, salesOrders, supplierProducts } from "@/lib/db/schema";
import { ApiError, errorToResponse, jsonOk, parseId, parseJson, requireSession } from "@/lib/api";
import { bomMasterSchema } from "@/lib/schemas";

type Ctx = { params: Promise<{ id: string }> };

export const runtime = "nodejs";

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    await requireSession();
    const id = parseId((await ctx.params).id);

    const [master] = await db
      .select({
        id: bomMaster.id,
        productId: bomMaster.productId,
        soId: bomMaster.soId,
        soNumber: salesOrders.soNumber,
        bomCode: bomMaster.bomCode,
        version: bomMaster.version,
        isActive: bomMaster.isActive,
        laborCost: bomMaster.laborCost,
        overheadCost: bomMaster.overheadCost,
        notes: bomMaster.notes,
        createdAt: bomMaster.createdAt,
        updatedAt: bomMaster.updatedAt,
        productName: products.name,
        productSku: products.sku,
      })
      .from(bomMaster)
      .innerJoin(products, eq(bomMaster.productId, products.id))
      .leftJoin(salesOrders, eq(bomMaster.soId, salesOrders.id))
      .where(eq(bomMaster.id, id));

    if (!master) throw new ApiError(404, "BOM not found");

    // Items: left-join both products (raw material) and supplier_products
    const itemsAlias = db
      .select({
        id: bomItems.id,
        rawMaterialId: bomItems.rawMaterialId,
        supplierProductId: bomItems.supplierProductId,
        supplierProductName: supplierProducts.name,
        supplierProductCode: supplierProducts.code,
        qtyPerUnit: bomItems.qtyPerUnit,
        unitName: bomItems.unitName,
        unitPrice: bomItems.unitPrice,
        notes: bomItems.notes,
        rawMaterialName: products.name,
        rawMaterialSku: products.sku,
      })
      .from(bomItems)
      .leftJoin(products, eq(bomItems.rawMaterialId, products.id))
      .leftJoin(supplierProducts, eq(bomItems.supplierProductId, supplierProducts.id))
      .where(eq(bomItems.bomId, id))
      .orderBy(desc(bomItems.id));

    const items = await itemsAlias;

    const rawMaterialIds = Array.from(new Set(items.map((it) => it.rawMaterialId).filter((id): id is number => id != null)));
    let rates: Record<number, number> = {};
    if (rawMaterialIds.length > 0) {
      const latestRates = await db
        .select({
          productId: purchaseOrderItems.productId,
          estimatedRate: sql<string>`max(${purchaseOrderItems.unitPrice}::numeric)::text`,
        })
        .from(purchaseOrderItems)
        .where(and(inArray(purchaseOrderItems.productId, rawMaterialIds), sql`${purchaseOrderItems.productId} is not null`))
        .groupBy(purchaseOrderItems.productId);
      rates = Object.fromEntries(latestRates.map((r) => [Number(r.productId || 0), Number(r.estimatedRate || 0)]));
    }

    const rollup = calcBomRollup({
      lines: items.map((it) => ({
        rawMaterialId: it.rawMaterialId ?? 0,
        rawMaterialName: it.rawMaterialName ?? "Unknown material",
        qtyPerUnit: Number(it.qtyPerUnit),
        unitPrice: Number(it.unitPrice),
        estimatedRate: rates[it.rawMaterialId ?? 0] || 0,
      })),
      laborCost: Number(master.laborCost),
      overheadCost: Number(master.overheadCost),
    });

    return jsonOk({
      ...master,
      items: items.map((it) => ({ ...it, estimatedRate: rates[it.rawMaterialId ?? 0] || 0 })),
      rollup,
    });
  } catch (err) {
    return errorToResponse(err);
  }
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireSession();
    if (session.role === "viewer") throw new ApiError(403, "Only sales/admin users can update BOM");
    const id = parseId((await ctx.params).id);
    const data = await parseJson(req, bomMasterSchema);

    const row = await db.transaction(async (tx) => {
      const [current] = await tx.select().from(bomMaster).where(eq(bomMaster.id, id));
      if (!current) throw new ApiError(404, "BOM not found");

      if (data.isActive) {
        await tx
          .update(bomMaster)
          .set({ isActive: false, updatedAt: new Date() })
          .where(and(eq(bomMaster.productId, data.productId), ne(bomMaster.id, id)));
      }

      const [updated] = await tx
        .update(bomMaster)
        .set({
          productId: data.productId,
          soId: data.soId ?? null,
          bomCode: data.bomCode,
          version: data.version,
          isActive: data.isActive,
          laborCost: data.laborCost.toString(),
          overheadCost: data.overheadCost.toString(),
          notes: data.notes,
          updatedAt: new Date(),
        })
        .where(eq(bomMaster.id, id))
        .returning();

      await tx.delete(bomItems).where(eq(bomItems.bomId, id));
      await tx.insert(bomItems).values(
        data.items.map((it) => ({
          bomId: id,
          rawMaterialId: it.rawMaterialId ?? null,
          supplierProductId: it.supplierProductId ?? null,
          qtyPerUnit: it.qtyPerUnit.toString(),
          unitName: it.unitName,
          unitPrice: it.unitPrice.toString(),
          notes: it.notes,
        })),
      );

      return updated;
    });

    return jsonOk(row);
  } catch (err) {
    return errorToResponse(err);
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireSession();
    if (session.role === "viewer") throw new ApiError(403, "Only sales/admin users can delete BOM");
    const id = parseId((await ctx.params).id);
    const [row] = await db.delete(bomMaster).where(eq(bomMaster.id, id)).returning();
    if (!row) throw new ApiError(404, "BOM not found");
    return jsonOk({ ok: true });
  } catch (err) {
    return errorToResponse(err);
  }
}
