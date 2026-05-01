import { NextRequest, NextResponse } from "next/server";
import { requireSession, ApiError } from "@/lib/api";
import { changePropagationService } from "@/lib/change-propagation";
import { z } from "zod";

/**
 * GET /api/change-propagation/notifications
 * Fetch unread notifications for the current user's role.
 *
 * Query params: ?role=production|procurement|...
 */
export async function GET(req: NextRequest) {
  try {
    const session = await requireSession();
    const role = req.nextUrl.searchParams.get("role") ?? session.role;

    const notifications = await changePropagationService.getUnreadNotifications(
      "default",
      session.userId,
      role,
    );
    return NextResponse.json({ notifications });
  } catch (err) {
    if (err instanceof ApiError)
      return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[GET /api/change-propagation/notifications]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

const ReadBody = z.object({ notificationId: z.number().int().positive() });

/**
 * POST /api/change-propagation/notifications
 * Mark a notification as read.
 *
 * Body: { notificationId: number }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    void session;
    const body = ReadBody.parse(await req.json());
    const updated = await changePropagationService.markNotificationRead(body.notificationId);
    return NextResponse.json({ notification: updated });
  } catch (err) {
    if (err instanceof ApiError)
      return NextResponse.json({ error: err.message }, { status: err.status });
    if (err instanceof z.ZodError)
      return NextResponse.json({ error: err.errors }, { status: 422 });
    console.error("[POST /api/change-propagation/notifications]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
