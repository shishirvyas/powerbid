import { NextRequest } from "next/server";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { products, units } from "@/lib/db/schema";
import {
  ApiError,
  errorToResponse,
  jsonOk,
  parseJson,
  parseSearch,
  requireSession,
} from "@/lib/api";
import { listQuerySchema, productSchema } from "@/lib/schemas";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    await requireSession();
    const { q, limit, offset } = parseSearch(new URL(req.url), listQuerySchema);
    const where = q
      ? or(ilike(products.name, `%${q}%`), ilike(products.sku, `%${q}%`))
      : undefined;
    const rows = await db
      .select({
        id: products.id,
        sku: products.sku,
        name: products.name,
        description: products.description,
        unitId: products.unitId,
        hsmCode: products.hsmCode,
        createdAt: products.createdAt,
        unitCode: units.code,
        unitName: units.name,
      })
      .from(products)
      .leftJoin(units, eq(products.unitId, units.id))
      .where(where)
      .orderBy(desc(products.createdAt))
      .limit(limit)
      .offset(offset);
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(products)
      .where(where);
    return jsonOk({ rows, total: count, limit, offset });
  } catch (err) {
    return errorToResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireSession();
    const data = await parseJson(req, productSchema);
    if (data.sku) {
      const exists = await db.select({ id: products.id }).from(products).where(eq(products.sku, data.sku)).limit(1);
      if (exists.length) throw new ApiError(409, `SKU "${data.sku}" already exists`);
    }
    const [row] = await db.insert(products).values(data).returning();
    return jsonOk(row, { status: 201 });
  } catch (err) {
    return errorToResponse(err);
  }
}
