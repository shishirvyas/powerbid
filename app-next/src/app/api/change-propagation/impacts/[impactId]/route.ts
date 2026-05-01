import { NextRequest, NextResponse } from "next/server";
import { requireSession, ApiError } from "@/lib/api";
import { changePropagationService } from "@/lib/change-propagation";
import { z } from "zod";

const ResolveBody = z.object({
  action: z.enum(["acknowledge", "resolve"]),
  resolutionNote: z.string().optional(),
});

type RouteParams = { params: Promise<{ impactId: string }> };

/**
 * PATCH /api/change-propagation/impacts/[impactId]
 * Acknowledge or resolve an impact record.
 *
 * Body: { action: "acknowledge" | "resolve", resolutionNote?: string }
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireSession();
    const { impactId } = await params;
    const id = parseInt(impactId, 10);
    if (isNaN(id)) throw new ApiError(400, "Invalid impactId");

    const body = ResolveBody.parse(await req.json());

    let updated;
    if (body.action === "acknowledge") {
      updated = await changePropagationService.acknowledgeImpact(id, session.userId);
    } else {
      updated = await changePropagationService.resolveImpact(
        id,
        session.userId,
        body.resolutionNote ?? "",
      );
    }

    return NextResponse.json({ impact: updated });
  } catch (err) {
    if (err instanceof ApiError)
      return NextResponse.json({ error: err.message }, { status: err.status });
    if (err instanceof z.ZodError)
      return NextResponse.json({ error: err.errors }, { status: 422 });
    console.error("[PATCH /api/change-propagation/impacts]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
