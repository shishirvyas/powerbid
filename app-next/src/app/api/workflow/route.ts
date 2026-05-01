import { NextRequest } from "next/server";
import { errorToResponse, jsonOk, parseJson, requireSession } from "@/lib/api";
import { createWorkflowSchema } from "@/lib/workflow/schemas";
import { workflowService } from "@/lib/workflow";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const data = await parseJson(req, createWorkflowSchema);

    const workflow = await workflowService.createWorkflow({
      tenantId: data.tenantId,
      entityType: data.entityType,
      entityId: data.entityId,
      actorUserId: session.userId,
    });

    return jsonOk(workflow, { status: 201 });
  } catch (err) {
    return errorToResponse(err);
  }
}
