import { NextRequest } from "next/server";
import { asc, eq } from "drizzle-orm";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { db } from "@/lib/db";
import { quotationAttachments, quotations } from "@/lib/db/schema";
import { ApiError, errorToResponse, jsonOk, parseId, requireSession } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

async function ensureQuotation(id: number) {
  const [row] = await db.select({ id: quotations.id }).from(quotations).where(eq(quotations.id, id));
  if (!row) throw new ApiError(404, "Quotation not found");
}

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function getAttachmentDir(quotationId: number) {
  return path.join(process.cwd(), "storage", "quotation-attachments", String(quotationId));
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    await requireSession();
    const id = parseId((await ctx.params).id);
    await ensureQuotation(id);
    const rows = await db
      .select({
        id: quotationAttachments.id,
        fileName: quotationAttachments.fileName,
        fileSize: quotationAttachments.fileSize,
        mimeType: quotationAttachments.mimeType,
        createdAt: quotationAttachments.createdAt,
      })
      .from(quotationAttachments)
      .where(eq(quotationAttachments.quotationId, id))
      .orderBy(asc(quotationAttachments.sortOrder), asc(quotationAttachments.id));

    return jsonOk(
      rows.map((row) => ({
        id: String(row.id),
        fileName: row.fileName,
        contentType: row.mimeType || "application/octet-stream",
        size: row.fileSize ?? 0,
        createdAt: row.createdAt.toISOString(),
      })),
    );
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

    const dir = getAttachmentDir(id);
    await mkdir(dir, { recursive: true });

    const payload = [] as Array<{
      quotationId: number;
      fileName: string;
      filePath: string;
      fileSize: number;
      mimeType: string;
      sortOrder: number;
    }>;

    for (let i = 0; i < files.length; i++) {
      const file = files[i]!;
      const safeName = sanitizeFileName(file.name || "attachment");
      const storedName = `${Date.now()}_${i}_${safeName}`;
      const relativePath = path.join("storage", "quotation-attachments", String(id), storedName);
      const absolutePath = path.join(process.cwd(), relativePath);
      const bytes = new Uint8Array(await file.arrayBuffer());
      await writeFile(absolutePath, bytes);

      payload.push({
        quotationId: id,
        fileName: file.name,
        filePath: relativePath,
        fileSize: file.size,
        mimeType: file.type || "application/octet-stream",
        sortOrder: i,
      });
    }

    const inserted = await db.insert(quotationAttachments).values(payload).returning({
      id: quotationAttachments.id,
      fileName: quotationAttachments.fileName,
      fileSize: quotationAttachments.fileSize,
      mimeType: quotationAttachments.mimeType,
      createdAt: quotationAttachments.createdAt,
    });

    return jsonOk(
      inserted.map((row) => ({
        id: String(row.id),
        fileName: row.fileName,
        contentType: row.mimeType || "application/octet-stream",
        size: row.fileSize ?? 0,
        createdAt: row.createdAt.toISOString(),
      })),
      { status: 201 },
    );
  } catch (err) {
    return errorToResponse(err);
  }
}