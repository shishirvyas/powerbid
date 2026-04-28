import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { readFile, unlink } from "fs/promises";
import path from "path";
import { db } from "@/lib/db";
import { quotationAttachments, quotations } from "@/lib/db/schema";
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
    const attachmentDbId = parseId(attachmentId);
    await ensureQuotation(quotationId);

    const [attachment] = await db
      .select({
        id: quotationAttachments.id,
        quotationId: quotationAttachments.quotationId,
        fileName: quotationAttachments.fileName,
        filePath: quotationAttachments.filePath,
        fileSize: quotationAttachments.fileSize,
        mimeType: quotationAttachments.mimeType,
      })
      .from(quotationAttachments)
      .where(eq(quotationAttachments.id, attachmentDbId));

    if (!attachment || attachment.quotationId !== quotationId) throw new ApiError(404, "Attachment not found");

    const absolutePath = path.join(process.cwd(), attachment.filePath);
    const bytes = await readFile(absolutePath);

    return new Response(Buffer.from(bytes), {
      headers: {
        "Content-Type": attachment.mimeType || "application/octet-stream",
        "Content-Length": String(attachment.fileSize ?? bytes.length),
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
    const attachmentDbId = parseId(attachmentId);
    await ensureQuotation(quotationId);

    const [attachment] = await db
      .select({
        id: quotationAttachments.id,
        quotationId: quotationAttachments.quotationId,
        filePath: quotationAttachments.filePath,
      })
      .from(quotationAttachments)
      .where(eq(quotationAttachments.id, attachmentDbId));

    if (!attachment || attachment.quotationId !== quotationId) throw new ApiError(404, "Attachment not found");

    await db.delete(quotationAttachments).where(eq(quotationAttachments.id, attachmentDbId));
    try {
      await unlink(path.join(process.cwd(), attachment.filePath));
    } catch {
      // File may already be missing; DB row has already been removed.
    }

    return jsonOk({ ok: true });
  } catch (err) {
    return errorToResponse(err);
  }
}