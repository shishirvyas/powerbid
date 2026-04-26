import { and, eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { communicationTemplates } from "@/lib/db/schema";
import { errorToResponse, jsonOk, parseJson, requireSession } from "@/lib/api";
import { communicationTemplateSchema } from "@/lib/schemas";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireSession();
    const rows = await db.select().from(communicationTemplates);
    return jsonOk({ rows });
  } catch (err) {
    return errorToResponse(err);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await requireSession();
    const payload = await parseJson(req, communicationTemplateSchema);

    const [existing] = await db
      .select()
      .from(communicationTemplates)
      .where(and(eq(communicationTemplates.channel, payload.channel), eq(communicationTemplates.templateKey, payload.templateKey)));

    if (existing) {
      const [row] = await db
        .update(communicationTemplates)
        .set({
          name: payload.name,
          subject: payload.subject,
          body: payload.body,
          isActive: payload.isActive,
          updatedBy: session.userId,
          updatedAt: new Date(),
        })
        .where(eq(communicationTemplates.id, existing.id))
        .returning();
      return jsonOk(row);
    }

    const [row] = await db
      .insert(communicationTemplates)
      .values({
        channel: payload.channel,
        templateKey: payload.templateKey,
        name: payload.name,
        subject: payload.subject,
        body: payload.body,
        isActive: payload.isActive,
        updatedBy: session.userId,
      })
      .returning();
    return jsonOk(row);
  } catch (err) {
    return errorToResponse(err);
  }
}
