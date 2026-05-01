import { NextRequest, NextResponse } from "next/server";
import { requireSession, ApiError } from "@/lib/api";
import { changePropagationService } from "@/lib/change-propagation";

type RouteParams = { params: Promise<{ eventId: string }> };

/**
 * GET /api/change-propagation/events/[eventId]/impacts
 * List all impact records for a given propagation event.
 */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireSession();
    void session;
    const { eventId } = await params;
    const id = parseInt(eventId, 10);
    if (isNaN(id)) throw new ApiError(400, "Invalid eventId");

    const impacts = await changePropagationService.listImpacts("default", id);
    return NextResponse.json({ impacts });
  } catch (err) {
    if (err instanceof ApiError)
      return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[GET /api/change-propagation/events/impacts]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
