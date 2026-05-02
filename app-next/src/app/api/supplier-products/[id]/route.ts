import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { supplierProducts } from "@/lib/db/schema";
import {
  ApiError,
  errorToResponse,
  jsonOk,
  parseId,
  parseJson,
  requireSession,
} from "@/lib/api";
import { supplierProductSchema } from "@/lib/schemas";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    await requireSession();
    const id = parseId((await ctx.params).id);
    const [row] = await db
      .select()
      .from(supplierProducts)
      .where(eq(supplierProducts.id, id));
    if (!row) throw new ApiError(404, "Supplier product not found");
    return jsonOk(row);
  } catch (err) {
    return errorToResponse(err);
  }
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireSession();
    if (session.role === "viewer") throw new ApiError(403, "Insufficient permissions");

    const id = parseId((await ctx.params).id);
    const data = await parseJson(req, supplierProductSchema);

    const [row] = await db
      .update(supplierProducts)
      .set({
        supplierId: data.supplierId ?? null,
        name: data.name,
        description: data.description ?? null,
        unitName: data.unitName ?? null,
        standardPrice: String(data.standardPrice ?? 0),
        leadDays: data.leadDays ?? 0,
        hsnCode: data.hsnCode ?? null,
        isActive: data.isActive ?? true,
        updatedAt: new Date(),
      })
      .where(eq(supplierProducts.id, id))
      .returning();

    if (!row) throw new ApiError(404, "Supplier product not found");
    return jsonOk(row);
  } catch (err) {
    return errorToResponse(err);
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireSession();
    if (session.role === "viewer") throw new ApiError(403, "Insufficient permissions");

    const id = parseId((await ctx.params).id);
    const [row] = await db
      .delete(supplierProducts)
      .where(eq(supplierProducts.id, id))
      .returning();

    if (!row) throw new ApiError(404, "Supplier product not found");
    return jsonOk({ ok: true });
  } catch (err) {
    return errorToResponse(err);
  }
}
