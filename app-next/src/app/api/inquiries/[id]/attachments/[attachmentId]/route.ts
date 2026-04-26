import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { inquiries } from "@/lib/db/schema";
import { getAttachment, removeAttachment } from "@/lib/attachment-store";
import { ApiError, errorToResponse, jsonOk, parseId, requireSession } from "@/lib/api";

type Ctx = { params: Promise<{ id: string; attachmentId: string }> };

async function ensureInquiry(id: number) {
  const [row] = await db.select({ id: inquiries.id }).from(inquiries).where(eq(inquiries.id, id));
  if (!row) throw new ApiError(404, "Inquiry not found");
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    await requireSession();
    const { id, attachmentId } = await ctx.params;
    const inquiryId = parseId(id);
    await ensureInquiry(inquiryId);
    const attachment = getAttachment("inquiries", inquiryId, attachmentId);
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
    const inquiryId = parseId(id);
    await ensureInquiry(inquiryId);
    const removed = removeAttachment("inquiries", inquiryId, attachmentId);
    if (!removed) throw new ApiError(404, "Attachment not found");
    return jsonOk({ ok: true });
  } catch (err) {
    return errorToResponse(err);
  }
}