import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { subjectTemplates } from "@/lib/db/schema";
import {
  ApiError,
  errorToResponse,
  jsonOk,
  parseId,
  parseJson,
  requireSession,
} from "@/lib/api";
import { z } from "zod";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

const subjectTemplateSchema = z.object({
  name: z.string().min(1, "Name is required"),
  subjectText: z.string().min(1, "Subject text is required"),
  introParagraph: z.string().optional(),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    await requireSession();
    const id = parseId((await ctx.params).id);
    const [row] = await db
      .select()
      .from(subjectTemplates)
      .where(eq(subjectTemplates.id, id));
    if (!row) throw new ApiError(404, "Template not found");
    return jsonOk(row);
  } catch (err) {
    return errorToResponse(err);
  }
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  try {
    await requireSession();
    const id = parseId((await ctx.params).id);
    const data = await parseJson(req, subjectTemplateSchema);
    
    // If marking as default, unset others
    if (data.isDefault) {
      await db
        .update(subjectTemplates)
        .set({ isDefault: false })
        .where(eq(subjectTemplates.isDefault, true));
    }
    
    const [row] = await db
      .update(subjectTemplates)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(subjectTemplates.id, id))
      .returning();
    if (!row) throw new ApiError(404, "Template not found");
    return jsonOk(row);
  } catch (err) {
    return errorToResponse(err);
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    await requireSession();
    const id = parseId((await ctx.params).id);
    const [row] = await db
      .delete(subjectTemplates)
      .where(eq(subjectTemplates.id, id))
      .returning();
    if (!row) throw new ApiError(404, "Template not found");
    return jsonOk({ ok: true });
  } catch (err) {
    return errorToResponse(err);
  }
}
