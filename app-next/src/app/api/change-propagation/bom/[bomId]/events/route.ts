import { NextRequest, NextResponse } from "next/server";
import { requireSession, ApiError } from "@/lib/api";
import { changePropagationService } from "@/lib/change-propagation";

type RouteParams = { params: Promise<{ bomId: string }> };

/**
 * GET /api/change-propagation/bom/[bomId]/events
 * List all change propagation events for a BOM.
 */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireSession();
    void session;
    const { bomId } = await params;
    const id = parseInt(bomId, 10);
    if (isNaN(id)) throw new ApiError(400, "Invalid bomId");

    const events = await changePropagationService.listEvents("default", id);
    return NextResponse.json({ events });
  } catch (err) {
    if (err instanceof ApiError)
      return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[GET /api/change-propagation/bom/events]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
