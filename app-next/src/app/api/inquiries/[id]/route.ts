import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { inquiries, inquiryItems } from "@/lib/db/schema";
import {
  ApiError,
  errorToResponse,
  jsonOk,
  parseId,
  parseJson,
  requireSession,
} from "@/lib/api";
import { inquirySchema } from "@/lib/schemas";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    await requireSession();
    const id = parseId((await ctx.params).id);
    const [row] = await db
      .select({
        id: inquiries.id,
        inquiryNo: inquiries.inquiryNo,
        customerId: inquiries.customerId,
        customerName: inquiries.customerName,
        source: inquiries.source,
        priority: inquiries.priority,
        status: inquiries.status,
        requirement: inquiries.requirement,
        expectedClosure: inquiries.expectedClosure,
        assignedTo: inquiries.assignedTo,
        createdAt: inquiries.createdAt,
        updatedAt: inquiries.updatedAt,
      })
      .from(inquiries)
      .where(eq(inquiries.id, id));
    if (!row) throw new ApiError(404, "Inquiry not found");
    const items = await db
      .select()
      .from(inquiryItems)
      .where(eq(inquiryItems.inquiryId, id));
    return jsonOk({ ...row, items });
  } catch (err) {
    return errorToResponse(err);
  }
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  try {
    await requireSession();
    const id = parseId((await ctx.params).id);
    const data = await parseJson(req, inquirySchema);
    const { items, ...rest } = data;
    const [row] = await db
      .update(inquiries)
      .set({ ...rest, updatedAt: new Date() })
      .where(eq(inquiries.id, id))
      .returning();
    if (!row) throw new ApiError(404, "Inquiry not found");
    await db.delete(inquiryItems).where(eq(inquiryItems.inquiryId, id));
    if (items.length) {
      await db.insert(inquiryItems).values(
        items.map((it) => ({
          inquiryId: id,
          productId: it.productId ?? null,
          productName: it.productName,
          qty: String(it.qty),
          remarks: it.remarks ?? null,
        })),
      );
    }
    return jsonOk(row);
  } catch (err) {
    return errorToResponse(err);
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    await requireSession();
    const id = parseId((await ctx.params).id);
    const [row] = await db.delete(inquiries).where(eq(inquiries.id, id)).returning();
    if (!row) throw new ApiError(404, "Inquiry not found");
    return jsonOk({ ok: true });
  } catch (err) {
    return errorToResponse(err);
  }
}
