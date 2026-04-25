import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { units } from "@/lib/db/schema";
import {
  ApiError,
  errorToResponse,
  jsonOk,
  parseId,
  parseJson,
  requireSession,
} from "@/lib/api";
import { unitSchema } from "@/lib/schemas";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, ctx: Ctx) {
  try {
    await requireSession();
    const id = parseId((await ctx.params).id);
    const data = await parseJson(req, unitSchema);
    const [row] = await db.update(units).set(data).where(eq(units.id, id)).returning();
    if (!row) throw new ApiError(404, "Unit not found");
    return jsonOk(row);
  } catch (err) {
    return errorToResponse(err);
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    await requireSession();
    const id = parseId((await ctx.params).id);
    const [row] = await db.delete(units).where(eq(units.id, id)).returning();
    if (!row) throw new ApiError(404, "Unit not found");
    return jsonOk({ ok: true });
  } catch (err) {
    return errorToResponse(err);
  }
}
