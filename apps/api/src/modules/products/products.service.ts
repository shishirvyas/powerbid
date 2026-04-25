import { and, eq, like, or, sql, desc } from "drizzle-orm";
import type { ProductInput, ProductListQuery } from "@powerbid/shared";
import type { DB } from "../../db/client";
import { products, brands, units, gstSlabs } from "../../db/schema";
import { conflict, notFound } from "../../lib/errors";

export const productsService = {
  async list(db: DB, q: ProductListQuery) {
    const where = [eq(products.isActive, true)];
    if (q.q) {
      const term = `%${q.q}%`;
      where.push(or(like(products.name, term), like(products.sku, term))!);
    }
    if (q.brandId) where.push(eq(products.brandId, q.brandId));

    const rows = await db
      .select({
        id: products.id,
        sku: products.sku,
        name: products.name,
        description: products.description,
        basePrice: products.basePrice,
        brandId: products.brandId,
        brandName: brands.name,
        unitId: products.unitId,
        unitName: units.name,
        gstSlabId: products.gstSlabId,
        gstRate: gstSlabs.rate,
        updatedAt: products.updatedAt,
      })
      .from(products)
      .leftJoin(brands, eq(brands.id, products.brandId))
      .leftJoin(units, eq(units.id, products.unitId))
      .leftJoin(gstSlabs, eq(gstSlabs.id, products.gstSlabId))
      .where(and(...where))
      .orderBy(desc(products.updatedAt))
      .limit(q.limit)
      .offset(q.offset);

    const [{ count = 0 } = {}] = await db
      .select({ count: sql<number>`count(*)` })
      .from(products)
      .where(and(...where));
    return { items: rows, total: Number(count), limit: q.limit, offset: q.offset };
  },

  async get(db: DB, id: number) {
    const [row] = await db.select().from(products).where(eq(products.id, id)).limit(1);
    if (!row) throw notFound("Product not found");
    return row;
  },

  async create(db: DB, input: ProductInput, userId: number | null) {
    const [dup] = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.sku, input.sku))
      .limit(1);
    if (dup) throw conflict(`SKU "${input.sku}" already exists`);
    const [created] = await db
      .insert(products)
      .values({ ...input, createdBy: userId, updatedBy: userId })
      .returning();
    return created;
  },

  async update(db: DB, id: number, input: ProductInput, userId: number | null) {
    const [existing] = await db.select().from(products).where(eq(products.id, id)).limit(1);
    if (!existing) throw notFound("Product not found");
    if (existing.sku !== input.sku) {
      const [dup] = await db
        .select({ id: products.id })
        .from(products)
        .where(eq(products.sku, input.sku))
        .limit(1);
      if (dup && dup.id !== id) throw conflict(`SKU "${input.sku}" already in use`);
    }
    const [updated] = await db
      .update(products)
      .set({ ...input, updatedBy: userId, updatedAt: new Date().toISOString() })
      .where(eq(products.id, id))
      .returning();
    return updated;
  },

  async deactivate(db: DB, id: number, userId: number | null) {
    const r = await db
      .update(products)
      .set({ isActive: false, updatedBy: userId, updatedAt: new Date().toISOString() })
      .where(eq(products.id, id))
      .returning({ id: products.id });
    if (!r.length) throw notFound("Product not found");
    return { id };
  },
};
