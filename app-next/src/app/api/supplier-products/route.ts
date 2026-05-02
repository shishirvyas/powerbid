import { NextRequest } from "next/server";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { supplierProducts, suppliers } from "@/lib/db/schema";
import {
  ApiError,
  errorToResponse,
  jsonOk, jsonList,
  parseJson,
  parseSearch,
  requireSession,
} from "@/lib/api";
import { supplierProductSchema, listQuerySchema } from "@/lib/schemas";

export const runtime = "nodejs";

async function nextProductCode() {
  const rows = await db
    .select({ code: supplierProducts.code })
    .from(supplierProducts)
    .where(ilike(supplierProducts.code, "SP%"))
    .orderBy(desc(supplierProducts.id))
    .limit(500);

  let max = 0;
  for (const row of rows) {
    const m = /^SP(\d+)$/i.exec(row.code ?? "");
    if (!m) continue;
    const n = Number(m[1]);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return `SP${String(max + 1).padStart(4, "0")}`;
}

export async function GET(req: NextRequest) {
  try {
    await requireSession();
    const url = new URL(req.url);
    const { q, limit, offset } = parseSearch(url, listQuerySchema);
    const supplierId = url.searchParams.get("supplierId");

    const conditions = [];
    if (q) {
      conditions.push(
        or(
          ilike(supplierProducts.name, `%${q}%`),
          ilike(supplierProducts.code, `%${q}%`),
          ilike(supplierProducts.hsnCode, `%${q}%`),
        )
      );
    }
    if (supplierId) {
      conditions.push(eq(supplierProducts.supplierId, Number(supplierId)));
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db
      .select({
        id: supplierProducts.id,
        supplierId: supplierProducts.supplierId,
        supplierName: suppliers.companyName,
        code: supplierProducts.code,
        name: supplierProducts.name,
        description: supplierProducts.description,
        unitName: supplierProducts.unitName,
        standardPrice: supplierProducts.standardPrice,
        leadDays: supplierProducts.leadDays,
        hsnCode: supplierProducts.hsnCode,
        isActive: supplierProducts.isActive,
        createdAt: supplierProducts.createdAt,
        updatedAt: supplierProducts.updatedAt,
      })
      .from(supplierProducts)
      .leftJoin(suppliers, eq(supplierProducts.supplierId, suppliers.id))
      .where(where)
      .orderBy(desc(supplierProducts.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(supplierProducts)
      .where(where);

    return jsonList({ rows, total: count, limit, offset });
  } catch (err) {
    return errorToResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    if (session.role === "viewer") throw new ApiError(403, "Insufficient permissions");

    const data = await parseJson(req, supplierProductSchema);
    const code = data.code || (await nextProductCode());

    const [row] = await db
      .insert(supplierProducts)
      .values({
        supplierId: data.supplierId ?? null,
        code,
        name: data.name,
        description: data.description ?? null,
        unitName: data.unitName ?? null,
        standardPrice: String(data.standardPrice ?? 0),
        leadDays: data.leadDays ?? 0,
        hsnCode: data.hsnCode ?? null,
        isActive: data.isActive ?? true,
      })
      .returning();

    return jsonOk(row, { status: 201 });
  } catch (err) {
    return errorToResponse(err);
  }
}
