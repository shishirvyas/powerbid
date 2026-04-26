import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { quotations } from "@/lib/db/schema";
import { getAttachment, removeAttachment } from "@/lib/attachment-store";
import { ApiError, errorToResponse, jsonOk, parseId, requireSession } from "@/lib/api";

type Ctx = { params: Promise<{ id: string; attachmentId: string }> };

async function ensureQuotation(id: number) {
  const [row] = await db.select({ id: quotations.id }).from(quotations).where(eq(quotations.id, id));
  if (!row) throw new ApiError(404, "Quotation not found");
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    await requireSession();
    const { id, attachmentId } = await ctx.params;
    const quotationId = parseId(id);
    await ensureQuotation(quotationId);
    const attachment = getAttachment("quotations", quotationId, attachmentId);
    if (!attachment) throw new ApiError(404, "Attachment not found");
    return new Response(Buffer.from(attachment.bytes), {
      headers: {
        "Content-Type": attachment.contentType,
        "Content-Length": String(attachment.size),
        "Content-Disposition": `attachment; filename="${attachment.fileName.replace(/"/g, "")}"`,
      },
    });
  } catch (err) {
    return errorToResponse(err);
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    await requireSession();
    const { id, attachmentId } = await ctx.params;
    const quotationId = parseId(id);
    await ensureQuotation(quotationId);
    const removed = removeAttachment("quotations", quotationId, attachmentId);
    if (!removed) throw new ApiError(404, "Attachment not found");
    return jsonOk({ ok: true });
  } catch (err) {
    return errorToResponse(err);
  }
}