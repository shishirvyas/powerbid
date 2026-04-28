import { NextRequest } from "next/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { subjectTemplates } from "@/lib/db/schema";
import {
  ApiError,
  errorToResponse,
  jsonOk,
  parseJson,
  requireSession,
} from "@/lib/api";
import { z } from "zod";

export const runtime = "nodejs";

const subjectTemplateSchema = z.object({
  name: z.string().min(1, "Name is required"),
  subjectText: z.string().min(1, "Subject text is required"),
  introParagraph: z.string().optional(),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export async function GET(req: NextRequest) {
  try {
    await requireSession();
    const rows = await db
      .select()
      .from(subjectTemplates)
      .orderBy(desc(subjectTemplates.isDefault), desc(subjectTemplates.createdAt));
    return jsonOk({ rows });
  } catch (err) {
    return errorToResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireSession();
    const data = await parseJson(req, subjectTemplateSchema);
    
    // If marking as default, unset others
    if (data.isDefault) {
      await db
        .update(subjectTemplates)
        .set({ isDefault: false })
        .where(eq(subjectTemplates.isDefault, true));
    }
    
    const [row] = await db.insert(subjectTemplates).values(data).returning();
    return jsonOk(row, { status: 201 });
  } catch (err) {
    return errorToResponse(err);
  }
}
