import { NextRequest, NextResponse } from "next/server";
import { requireSession, ApiError } from "@/lib/api";
import { changePropagationService } from "@/lib/change-propagation";

/**
 * GET /api/change-propagation/open-impacts
 * List all open (unresolved) impact records for the tenant.
 * Useful for an operations dashboard to surface pending reviews.
 */
export async function GET(_req: NextRequest) {
  try {
    const session = await requireSession();
    void session;
    const impacts = await changePropagationService.listOpenImpacts("default");
    return NextResponse.json({ impacts });
  } catch (err) {
    if (err instanceof ApiError)
      return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[GET /api/change-propagation/open-impacts]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
