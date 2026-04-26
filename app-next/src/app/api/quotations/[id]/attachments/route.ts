import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { quotations } from "@/lib/db/schema";
import { addAttachments, listAttachments } from "@/lib/attachment-store";
import { ApiError, errorToResponse, jsonOk, parseId, requireSession } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

async function ensureQuotation(id: number) {
  const [row] = await db.select({ id: quotations.id }).from(quotations).where(eq(quotations.id, id));
  if (!row) throw new ApiError(404, "Quotation not found");
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    await requireSession();
    const id = parseId((await ctx.params).id);
    await ensureQuotation(id);
    return jsonOk(listAttachments("quotations", id));
  } catch (err) {
    return errorToResponse(err);
  }
}

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    await requireSession();
    const id = parseId((await ctx.params).id);
    await ensureQuotation(id);
    const form = await req.formData();
    const files = form.getAll("files").filter((value): value is File => value instanceof File);
    if (files.length === 0) throw new ApiError(400, "At least one file is required");
    const saved = await Promise.all(
      files.map(async (file) => ({
        fileName: file.name,
        contentType: file.type || "application/octet-stream",
        size: file.size,
        bytes: new Uint8Array(await file.arrayBuffer()),
      })),
    );
    return jsonOk(addAttachments("quotations", id, saved), { status: 201 });
  } catch (err) {
    return errorToResponse(err);
  }
}