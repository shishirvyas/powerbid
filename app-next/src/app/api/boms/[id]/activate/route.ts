import { and, eq, ne } from "drizzle-orm";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { bomMaster } from "@/lib/db/schema";
import { ApiError, errorToResponse, jsonOk, parseId, requireSession } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

export const runtime = "nodejs";

export async function POST(_req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireSession();
    if (session.role === "viewer") throw new ApiError(403, "Only sales/admin users can activate BOM revisions");
    const id = parseId((await ctx.params).id);

    await db.transaction(async (tx) => {
      const [target] = await tx.select().from(bomMaster).where(eq(bomMaster.id, id));
      if (!target) throw new ApiError(404, "BOM not found");

      await tx
        .update(bomMaster)
        .set({ isActive: false, updatedAt: new Date() })
        .where(and(eq(bomMaster.productId, target.productId), ne(bomMaster.id, target.id)));

      await tx
        .update(bomMaster)
        .set({ isActive: true, updatedAt: new Date() })
        .where(eq(bomMaster.id, target.id));
    });

    return jsonOk({ ok: true });
  } catch (err) {
    return errorToResponse(err);
  }
}
