import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/api";
import { ApiError } from "@/lib/api";
import { entityVersioningService } from "@/lib/versioning";
import { z } from "zod";

const LockBody = z.object({
  versionId: z.number().int().positive(),
});

type RouteParams = { params: Promise<{ entityType: string; entityId: string }> };

/**
 * GET /api/versioning/[entityType]/[entityId]/lock
 * Fetch the procurement version lock for an entity.
 */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireSession();
    const { entityType, entityId } = await params;
    const id = parseInt(entityId, 10);
    if (isNaN(id)) throw new ApiError(400, "Invalid entityId");

    void session;
    const lock = await entityVersioningService.getProcurementLock(
      "default",
      entityType,
      id,
    );
    return NextResponse.json({ lock });
  } catch (err) {
    if (err instanceof ApiError)
      return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[GET /api/versioning/lock]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/versioning/[entityType]/[entityId]/lock
 * Lock a procurement entity to a specific version.
 *
 * Body: { versionId: number }
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireSession();
    const { entityType, entityId } = await params;
    const id = parseInt(entityId, 10);
    if (isNaN(id)) throw new ApiError(400, "Invalid entityId");

    const body = LockBody.parse(await req.json());

    await entityVersioningService.lockProcurementVersion({
      tenantId: "default",
      procurementEntityType: entityType,
      procurementEntityId: id,
      versionId: body.versionId,
      lockedBy: session.userId,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ApiError)
      return NextResponse.json({ error: err.message }, { status: err.status });
    if (err instanceof z.ZodError)
      return NextResponse.json({ error: err.errors }, { status: 422 });
    console.error("[POST /api/versioning/lock]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
