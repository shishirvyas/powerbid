import { NextRequest } from "next/server";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { suppliers } from "@/lib/db/schema";
import {
  ApiError,
  errorToResponse,
  jsonOk,
  parseJson,
  parseSearch,
  requireSession,
} from "@/lib/api";
import { supplierSchema, listQuerySchema } from "@/lib/schemas";

export const runtime = "nodejs";

async function nextSupplierCode() {
  const rows = await db
    .select({ code: suppliers.code })
    .from(suppliers)
    .where(ilike(suppliers.code, "SUP%"))
    .orderBy(desc(suppliers.id))
    .limit(500);

  let max = 0;
  for (const row of rows) {
    const m = /^SUP(\d+)$/i.exec(row.code ?? "");
    if (!m) continue;
    const n = Number(m[1]);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return `SUP${String(max + 1).padStart(4, "0")}`;
}

export async function GET(req: NextRequest) {
  try {
    await requireSession();
    const { q, limit, offset } = parseSearch(new URL(req.url), listQuerySchema);
    const where = q
      ? or(
          ilike(suppliers.companyName, `%${q}%`),
          ilike(suppliers.code, `%${q}%`),
          ilike(suppliers.email, `%${q}%`),
          ilike(suppliers.phone, `%${q}%`),
        )
      : undefined;
    const rows = await db
      .select({
        id: suppliers.id,
        code: suppliers.code,
        companyName: suppliers.companyName,
        gstin: suppliers.gstin,
        pan: suppliers.pan,
        msmeStatus: suppliers.msmeStatus,
        paymentTerms: suppliers.paymentTerms,
        email: suppliers.email,
        phone: suppliers.phone,
        rating: suppliers.rating,
        isActive: suppliers.isActive,
        createdAt: suppliers.createdAt,
        updatedAt: suppliers.updatedAt,
      })
      .from(suppliers)
      .where(where)
      .orderBy(desc(suppliers.createdAt))
      .limit(limit)
      .offset(offset);
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(suppliers)
      .where(where);
    return jsonOk({ rows, total: count, limit, offset });
  } catch (err) {
    return errorToResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireSession();
    const data = await parseJson(req, supplierSchema);

    let attempt = 0;
    let row: typeof suppliers.$inferSelect | null = null;
    while (!row && attempt < 3) {
      const code = data.code ?? (await nextSupplierCode());
      const exists = await db
        .select({ id: suppliers.id })
        .from(suppliers)
        .where(eq(suppliers.code, code))
        .limit(1);
      if (exists.length) {
        attempt += 1;
        continue;
      }

      [row] = await db
        .insert(suppliers)
        .values({
          ...data,
          code,
          rating: data.rating == null ? null : String(data.rating),
        })
        .returning();
    }

    if (!row) throw new ApiError(409, "Unable to generate unique supplier code. Please retry.");
    return jsonOk(row, { status: 201 });
  } catch (err) {
    return errorToResponse(err);
  }
}
