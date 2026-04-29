import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { stockItems } from "@/lib/db/schema";
import {
  ApiError,
  errorToResponse,
  jsonOk,
  parseId,
  parseJson,
  requireSession,
} from "@/lib/api";
import { stockItemSchema } from "@/lib/schemas";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, ctx: Ctx) {
  try {
    await requireSession();
    const id = parseId((await ctx.params).id);
    const data = await parseJson(req, stockItemSchema);

    const [row] = await db
      .update(stockItems)
      .set({
        binLocation: data.binLocation,
        reorderLevel: data.reorderLevel.toString(),
        updatedAt: new Date(),
      })
      .where(eq(stockItems.id, id))
      .returning();

    if (!row) throw new ApiError(404, "Stock item not found");
    return jsonOk(row);
  } catch (err) {
    return errorToResponse(err);
  }
}
