import { NextRequest } from "next/server";
import { errorToResponse, jsonOk, parseId, parseJson, requireSession } from "@/lib/api";
import { transitionStateSchema } from "@/lib/workflow/schemas";
import { workflowService } from "@/lib/workflow";

type Ctx = { params: Promise<{ entityType: string; entityId: string }> };

export const runtime = "nodejs";

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireSession();
    const { entityType, entityId } = await ctx.params;
    const parsedEntityId = parseId(entityId);
    const departmentHeader = req.headers.get("x-department-id");
    const departmentId = departmentHeader ? Number(departmentHeader) : undefined;
    const data = await parseJson(req, transitionStateSchema);

    const result = await workflowService.transitionState({
      tenantId: data.tenantId,
      entityType,
      entityId: parsedEntityId,
      action: data.action,
      userRole: session.role,
      actorUserId: session.userId,
      departmentId: Number.isInteger(departmentId) ? departmentId : undefined,
      comment: data.comment,
      metadata: data.metadata,
    });

    return jsonOk(result);
  } catch (err) {
    return errorToResponse(err);
  }
}
