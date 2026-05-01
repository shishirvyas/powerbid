import { NextRequest } from "next/server";
import { errorToResponse, jsonOk, parseId, parseSearch, requireSession } from "@/lib/api";
import { z } from "zod";
import { workflowService } from "@/lib/workflow";

type Ctx = { params: Promise<{ entityType: string; entityId: string }> };

const historyQuerySchema = z.object({
  tenantId: z.string().trim().optional().default("default"),
});

export const runtime = "nodejs";

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    await requireSession();
    const { entityType, entityId } = await ctx.params;
    const parsedEntityId = parseId(entityId);
    const { tenantId } = parseSearch(new URL(req.url), historyQuerySchema);

    const history = await workflowService.getWorkflowHistory(tenantId, entityType, parsedEntityId);
    return jsonOk(history);
  } catch (err) {
    return errorToResponse(err);
  }
}
