import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { productionOrders } from "@/lib/db/schema";
import { ApiError, errorToResponse, jsonOk, parseId, requireSession } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

export const runtime = "nodejs";

export async function POST(_req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireSession();
    if (session.role === "viewer") throw new ApiError(403, "Only sales/admin users can start production");
    const id = parseId((await ctx.params).id);

    const [order] = await db.select().from(productionOrders).where(eq(productionOrders.id, id));
    if (!order) throw new ApiError(404, "Production order not found");
    if (order.status !== "draft") throw new ApiError(409, "Only draft orders can be started");

    const today = new Date().toISOString().slice(0, 10);
    const [row] = await db
      .update(productionOrders)
      .set({ status: "in_progress", startDate: today, updatedBy: session.userId, updatedAt: new Date() })
      .where(eq(productionOrders.id, id))
      .returning();

    return jsonOk(row);
  } catch (err) {
    return errorToResponse(err);
  }
}
