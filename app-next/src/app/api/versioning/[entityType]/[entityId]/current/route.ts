import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/api";
import { ApiError } from "@/lib/api";
import { entityVersioningService } from "@/lib/versioning";

type RouteParams = { params: Promise<{ entityType: string; entityId: string }> };

/**
 * GET /api/versioning/[entityType]/[entityId]/current
 * Fetch the current (active) version snapshot for an entity.
 */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireSession();
    const { entityType, entityId } = await params;
    const id = parseInt(entityId, 10);
    if (isNaN(id)) throw new ApiError(400, "Invalid entityId");

    void session;
    const version = await entityVersioningService.getCurrentVersion(
      "default",
      entityType,
      id,
    );

    if (!version) {
      return NextResponse.json({ version: null }, { status: 200 });
    }
    return NextResponse.json({ version });
  } catch (err) {
    if (err instanceof ApiError)
      return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[GET /api/versioning/current]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
