import { NextRequest, NextResponse } from "next/server";
import { requireSession, ApiError } from "@/lib/api";
import { changePropagationService } from "@/lib/change-propagation";
import { z } from "zod";

const PropagateBody = z.object({
  bomId: z.number().int().positive(),
  newVersionId: z.number().int().positive().optional(),
});

/**
 * POST /api/change-propagation/propagate
 * Trigger change propagation for a BOM version change.
 *
 * Body: { bomId: number, newVersionId?: number }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const body = PropagateBody.parse(await req.json());

    const result = await changePropagationService.propagateBomChange(
      "default",
      body.bomId,
      body.newVersionId ?? null,
      session.userId,
    );

    return NextResponse.json({ ok: true, result }, { status: 202 });
  } catch (err) {
    if (err instanceof ApiError)
      return NextResponse.json({ error: err.message }, { status: err.status });
    if (err instanceof z.ZodError)
      return NextResponse.json({ error: err.errors }, { status: 422 });
    console.error("[POST /api/change-propagation/propagate]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
