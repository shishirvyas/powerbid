import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { purchaseOrders } from "@/lib/db/schema";
import { ApiError, errorToResponse, jsonOk, parseId, requireSession } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function scanDir(poId: number) {
  return path.join(process.cwd(), "storage", "po-approval-scans", String(poId));
}

export const runtime = "nodejs";

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    await requireSession();
    const id = parseId((await ctx.params).id);
    const [po] = await db
      .select({
        id: purchaseOrders.id,
        selfApprovalScanName: purchaseOrders.selfApprovalScanName,
        selfApprovalScanPath: purchaseOrders.selfApprovalScanPath,
      })
      .from(purchaseOrders)
      .where(eq(purchaseOrders.id, id));

    if (!po) throw new ApiError(404, "Purchase Order not found");
    return jsonOk({
      fileName: po.selfApprovalScanName,
      filePath: po.selfApprovalScanPath,
      uploaded: !!po.selfApprovalScanPath,
    });
  } catch (err) {
    return errorToResponse(err);
  }
}

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireSession();
    if (session.role === "viewer") throw new ApiError(403, "Viewer users cannot upload approval scan");

    const id = parseId((await ctx.params).id);
    const [po] = await db
      .select({ id: purchaseOrders.id, status: purchaseOrders.status, selfApprovalScanPath: purchaseOrders.selfApprovalScanPath })
      .from(purchaseOrders)
      .where(eq(purchaseOrders.id, id));

    if (!po) throw new ApiError(404, "Purchase Order not found");
    if (po.status === "sent" || po.status === "partial_received" || po.status === "closed" || po.status === "cancelled") {
      throw new ApiError(409, "Cannot upload approval scan for closed/sent purchase order");
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new ApiError(400, "File is required");
    if (file.size <= 0) throw new ApiError(400, "File cannot be empty");

    const dir = scanDir(id);
    await mkdir(dir, { recursive: true });

    const safeName = sanitizeFileName(file.name || "approval-scan");
    const storedName = `${Date.now()}_${safeName}`;
    const relativePath = path.join("storage", "po-approval-scans", String(id), storedName);
    const absolutePath = path.join(process.cwd(), relativePath);
    const bytes = new Uint8Array(await file.arrayBuffer());
    await writeFile(absolutePath, bytes);

    if (po.selfApprovalScanPath) {
      const oldAbs = path.join(process.cwd(), po.selfApprovalScanPath);
      await unlink(oldAbs).catch(() => {});
    }

    await db
      .update(purchaseOrders)
      .set({
        selfApprovalScanName: file.name,
        selfApprovalScanPath: relativePath,
        selfApprovalScanUploadedBy: session.userId,
        updatedAt: new Date(),
        updatedBy: session.userId,
      })
      .where(eq(purchaseOrders.id, id));

    return jsonOk({ ok: true, fileName: file.name, filePath: relativePath });
  } catch (err) {
    return errorToResponse(err);
  }
}
