import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { inquiries } from "@/lib/db/schema";
import { addAttachments, listAttachments } from "@/lib/attachment-store";
import { ApiError, errorToResponse, jsonOk, parseId, requireSession } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

async function ensureInquiry(id: number) {
  const [row] = await db.select({ id: inquiries.id }).from(inquiries).where(eq(inquiries.id, id));
  if (!row) throw new ApiError(404, "Inquiry not found");
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    await requireSession();
    const id = parseId((await ctx.params).id);
    await ensureInquiry(id);
    return jsonOk(listAttachments("inquiries", id));
  } catch (err) {
    return errorToResponse(err);
  }
}

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    await requireSession();
    const id = parseId((await ctx.params).id);
    await ensureInquiry(id);
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
    return jsonOk(addAttachments("inquiries", id, saved), { status: 201 });
  } catch (err) {
    return errorToResponse(err);
  }
}