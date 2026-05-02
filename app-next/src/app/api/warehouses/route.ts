import { NextRequest } from "next/server";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { warehouses } from "@/lib/db/schema";
import {
  ApiError,
  errorToResponse,
  jsonOk, jsonList,
  parseJson,
  parseSearch,
  requireSession,
} from "@/lib/api";
import { warehouseSchema, listQuerySchema } from "@/lib/schemas";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    await requireSession();
    const { q, limit, offset } = parseSearch(new URL(req.url), listQuerySchema);
    const where = q
      ? or(
          ilike(warehouses.name, `%${q}%`),
          ilike(warehouses.code, `%${q}%`),
          ilike(warehouses.location, `%${q}%`)
        )
      : undefined;
    const rows = await db
      .select()
      .from(warehouses)
      .where(where)
      .orderBy(desc(warehouses.createdAt))
      .limit(limit)
      .offset(offset);
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(warehouses)
      .where(where);
    return jsonList({ rows, total: count, limit, offset });
  } catch (err) {
    return errorToResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireSession();
    const data = await parseJson(req, warehouseSchema);
    const exists = await db.select({ id: warehouses.id }).from(warehouses).where(eq(warehouses.code, data.code)).limit(1);
    if (exists.length) throw new ApiError(409, `Warehouse code "${data.code}" already exists`);
    const [row] = await db.insert(warehouses).values(data).returning();
    return jsonOk(row, { status: 201 });
  } catch (err) {
    return errorToResponse(err);
  }
}
