import { NextRequest } from "next/server";
import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { customers } from "@/lib/db/schema";
import {
  ApiError,
  errorToResponse,
  jsonOk, jsonList,
  parseJson,
  parseSearch,
  requireSession,
} from "@/lib/api";
import { customerSchema, listQuerySchema } from "@/lib/schemas";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    await requireSession();
    const { q, limit, offset } = parseSearch(new URL(req.url), listQuerySchema);
    const where = q
      ? or(
          ilike(customers.name, `%${q}%`),
          ilike(customers.code, `%${q}%`),
          ilike(customers.email, `%${q}%`),
          ilike(customers.phone, `%${q}%`),
        )
      : undefined;
    const rows = await db
      .select({
        id: customers.id,
        code: customers.code,
        name: customers.name,
        contactPerson: customers.contactPerson,
        email: customers.email,
        phone: customers.phone,
        gstin: customers.gstin,
        pan: customers.pan,
        addressLine1: customers.addressLine1,
        addressLine2: customers.addressLine2,
        city: customers.city,
        state: customers.state,
        pincode: customers.pincode,
        country: customers.country,
        notes: customers.notes,
        isActive: customers.isActive,
        createdAt: customers.createdAt,
        updatedAt: customers.updatedAt,
      })
      .from(customers)
      .where(where)
      .orderBy(desc(customers.createdAt))
      .limit(limit)
      .offset(offset);
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(customers)
      .where(where);
    return jsonList({ rows, total: count, limit, offset });
  } catch (err) {
    return errorToResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireSession();
    const data = await parseJson(req, customerSchema);
    const exists = await db.select({ id: customers.id }).from(customers).where(eq(customers.code, data.code)).limit(1);
    if (exists.length) throw new ApiError(409, `Customer code "${data.code}" already exists`);
    const [row] = await db.insert(customers).values(data).returning();
    return jsonOk(row, { status: 201 });
  } catch (err) {
    return errorToResponse(err);
  }
}
