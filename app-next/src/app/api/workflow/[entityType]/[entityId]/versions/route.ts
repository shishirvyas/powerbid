import { NextRequest } from "next/server";
import { errorToResponse, jsonOk, parseId, parseJson, requireSession } from "@/lib/api";
import { createVersionSchema } from "@/lib/workflow/schemas";
import { workflowService } from "@/lib/workflow";

type Ctx = { params: Promise<{ entityType: string; entityId: string }> };

export const runtime = "nodejs";

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireSession();
    const { entityType, entityId } = await ctx.params;
    const parsedEntityId = parseId(entityId);
    const data = await parseJson(req, createVersionSchema);

    const version = await workflowService.createVersion({
      tenantId: data.tenantId,
      entityType,
      entityId: parsedEntityId,
      actorUserId: session.userId,
      snapshot: data.snapshot,
    });

    return jsonOk(version, { status: 201 });
  } catch (err) {
    return errorToResponse(err);
  }
}
