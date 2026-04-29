import { NextRequest } from "next/server";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { suppliers } from "@/lib/db/schema";
import {
  ApiError,
  errorToResponse,
  jsonOk,
  parseId,
  parseJson,
  requireSession,
} from "@/lib/api";
import { supplierSchema } from "@/lib/schemas";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    await requireSession();
    const id = parseId((await ctx.params).id);
    const [row] = await db
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
      .where(eq(suppliers.id, id));
    if (!row) throw new ApiError(404, "Supplier not found");
    return jsonOk(row);
  } catch (err) {
    return errorToResponse(err);
  }
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  try {
    await requireSession();
    const id = parseId((await ctx.params).id);
    const data = await parseJson(req, supplierSchema);

    const [current] = await db
      .select({ code: suppliers.code })
      .from(suppliers)
      .where(eq(suppliers.id, id))
      .limit(1);
    if (!current) throw new ApiError(404, "Supplier not found");

    const code = data.code ?? current.code;
    const dup = await db
      .select({ id: suppliers.id })
      .from(suppliers)
      .where(and(eq(suppliers.code, code), ne(suppliers.id, id)))
      .limit(1);
    if (dup.length) throw new ApiError(409, `Supplier code "${code}" already exists`);

    const [row] = await db
      .update(suppliers)
      .set({
        ...data,
        code,
        rating: data.rating == null ? null : String(data.rating),
        updatedAt: new Date(),
      })
      .where(eq(suppliers.id, id))
      .returning();
    if (!row) throw new ApiError(404, "Supplier not found");
    return jsonOk(row);
  } catch (err) {
    return errorToResponse(err);
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    await requireSession();
    const id = parseId((await ctx.params).id);
    const [row] = await db.delete(suppliers).where(eq(suppliers.id, id)).returning();
    if (!row) throw new ApiError(404, "Supplier not found");
    return jsonOk({ ok: true });
  } catch (err) {
    return errorToResponse(err);
  }
}
