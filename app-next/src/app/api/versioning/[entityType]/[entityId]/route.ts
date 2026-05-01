import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/api";
import { ApiError } from "@/lib/api";
import { entityVersioningService } from "@/lib/versioning";
import { z } from "zod";

const CreateVersionBody = z.object({
  snapshot: z.record(z.unknown()),
  label: z.string().optional(),
});

type RouteParams = { params: Promise<{ entityType: string; entityId: string }> };

/**
 * GET /api/versioning/[entityType]/[entityId]
 * List all versions for an entity (newest first).
 */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireSession();
    const { entityType, entityId } = await params;
    const id = parseInt(entityId, 10);
    if (isNaN(id)) throw new ApiError(400, "Invalid entityId");

    void session;
    const versions = await entityVersioningService.listVersions(
      "default",
      entityType,
      id,
    );
    return NextResponse.json({ versions });
  } catch (err) {
    if (err instanceof ApiError)
      return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[GET /api/versioning]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/versioning/[entityType]/[entityId]
 * Create a new version snapshot for an entity.
 *
 * Body: { snapshot: Record<string, unknown>, label?: string }
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireSession();
    const { entityType, entityId } = await params;
    const id = parseInt(entityId, 10);
    if (isNaN(id)) throw new ApiError(400, "Invalid entityId");

    const body = CreateVersionBody.parse(await req.json());

    const version = await entityVersioningService.createVersion({
      tenantId: "default",
      entityType,
      entityId: id,
      snapshot: body.snapshot,
      label: body.label,
      createdBy: session.userId,
    });

    return NextResponse.json({ version }, { status: 201 });
  } catch (err) {
    if (err instanceof ApiError)
      return NextResponse.json({ error: err.message }, { status: err.status });
    if (err instanceof z.ZodError)
      return NextResponse.json({ error: err.errors }, { status: 422 });
    console.error("[POST /api/versioning]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
