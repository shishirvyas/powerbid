import { and, eq, like, or, sql, desc } from "drizzle-orm";
import type { CustomerInput, CustomerListQuery } from "@powerbid/shared";
import type { DB } from "../../db/client";
import { customers } from "../../db/schema";
import { conflict, notFound } from "../../lib/errors";

export const customersService = {
  async list(db: DB, q: CustomerListQuery) {
    const where = [eq(customers.isActive, true)];
    if (q.q) {
      const term = `%${q.q}%`;
      where.push(
        or(like(customers.name, term), like(customers.code, term), like(customers.gstin, term))!,
      );
    }
    const rows = await db
      .select()
      .from(customers)
      .where(and(...where))
      .orderBy(desc(customers.updatedAt))
      .limit(q.limit)
      .offset(q.offset);
    const [{ count = 0 } = {}] = await db
      .select({ count: sql<number>`count(*)` })
      .from(customers)
      .where(and(...where));
    return { items: rows, total: Number(count), limit: q.limit, offset: q.offset };
  },

  async get(db: DB, id: number) {
    const [row] = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
    if (!row) throw notFound("Customer not found");
    return row;
  },

  async create(db: DB, input: CustomerInput, userId: number | null) {
    const [existing] = await db
      .select({ id: customers.id })
      .from(customers)
      .where(eq(customers.code, input.code))
      .limit(1);
    if (existing) throw conflict(`Customer code "${input.code}" already exists`);

    const [created] = await db
      .insert(customers)
      .values({ ...input, createdBy: userId, updatedBy: userId })
      .returning();
    return created;
  },

  async update(db: DB, id: number, input: CustomerInput, userId: number | null) {
    const [existing] = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
    if (!existing) throw notFound("Customer not found");
    if (existing.code !== input.code) {
      const [dup] = await db
        .select({ id: customers.id })
        .from(customers)
        .where(eq(customers.code, input.code))
        .limit(1);
      if (dup && dup.id !== id) throw conflict(`Customer code "${input.code}" already in use`);
    }
    const [updated] = await db
      .update(customers)
      .set({ ...input, updatedBy: userId, updatedAt: new Date().toISOString() })
      .where(eq(customers.id, id))
      .returning();
    return updated;
  },

  async deactivate(db: DB, id: number, userId: number | null) {
    const result = await db
      .update(customers)
      .set({ isActive: false, updatedBy: userId, updatedAt: new Date().toISOString() })
      .where(eq(customers.id, id))
      .returning({ id: customers.id });
    if (result.length === 0) throw notFound("Customer not found");
    return { id };
  },
};
