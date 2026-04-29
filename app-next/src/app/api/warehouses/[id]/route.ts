import { NextRequest } from "next/server";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { warehouses } from "@/lib/db/schema";
import {
  ApiError,
  errorToResponse,
  jsonOk,
  parseId,
  parseJson,
  requireSession,
} from "@/lib/api";
import { warehouseSchema } from "@/lib/schemas";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    await requireSession();
    const id = parseId((await ctx.params).id);
    const [row] = await db.select().from(warehouses).where(eq(warehouses.id, id));
    if (!row) throw new ApiError(404, "Warehouse not found");
    return jsonOk(row);
  } catch (err) {
    return errorToResponse(err);
  }
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  try {
    await requireSession();
    const id = parseId((await ctx.params).id);
    const data = await parseJson(req, warehouseSchema);
    const dup = await db
      .select({ id: warehouses.id })
      .from(warehouses)
      .where(and(eq(warehouses.code, data.code), ne(warehouses.id, id)))
      .limit(1);
    if (dup.length) throw new ApiError(409, `Warehouse code "${data.code}" already exists`);
    const [row] = await db
      .update(warehouses)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(warehouses.id, id))
      .returning();
    if (!row) throw new ApiError(404, "Warehouse not found");
    return jsonOk(row);
  } catch (err) {
    return errorToResponse(err);
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    await requireSession();
    const id = parseId((await ctx.params).id);
    const [row] = await db.delete(warehouses).where(eq(warehouses.id, id)).returning();
    if (!row) throw new ApiError(404, "Warehouse not found");
    return jsonOk({ ok: true });
  } catch (err) {
    return errorToResponse(err);
  }
}
