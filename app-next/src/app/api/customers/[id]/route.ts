import { NextRequest } from "next/server";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { customers } from "@/lib/db/schema";
import {
  ApiError,
  errorToResponse,
  jsonOk,
  parseId,
  parseJson,
  requireSession,
} from "@/lib/api";
import { customerSchema } from "@/lib/schemas";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    await requireSession();
    const id = parseId((await ctx.params).id);
    const [row] = await db.select().from(customers).where(eq(customers.id, id));
    if (!row) throw new ApiError(404, "Customer not found");
    return jsonOk(row);
  } catch (err) {
    return errorToResponse(err);
  }
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  try {
    await requireSession();
    const id = parseId((await ctx.params).id);
    const data = await parseJson(req, customerSchema);
    const dup = await db
      .select({ id: customers.id })
      .from(customers)
      .where(and(eq(customers.code, data.code), ne(customers.id, id)))
      .limit(1);
    if (dup.length) throw new ApiError(409, `Customer code "${data.code}" already exists`);
    const [row] = await db
      .update(customers)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(customers.id, id))
      .returning();
    if (!row) throw new ApiError(404, "Customer not found");
    return jsonOk(row);
  } catch (err) {
    return errorToResponse(err);
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    await requireSession();
    const id = parseId((await ctx.params).id);
    const [row] = await db.delete(customers).where(eq(customers.id, id)).returning();
    if (!row) throw new ApiError(404, "Customer not found");
    return jsonOk({ ok: true });
  } catch (err) {
    return errorToResponse(err);
  }
}
