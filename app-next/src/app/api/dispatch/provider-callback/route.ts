import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { communicationLogs } from "@/lib/db/schema";
import { ApiError, errorToResponse, jsonOk } from "@/lib/api";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const secret = process.env.DISPATCH_WEBHOOK_SECRET;
    if (!secret) throw new ApiError(500, "DISPATCH_WEBHOOK_SECRET is not configured");

    const incoming = req.headers.get("x-webhook-secret") || req.nextUrl.searchParams.get("secret");
    if (incoming !== secret) throw new ApiError(401, "Unauthorized callback");

    const body = (await req.json()) as {
      providerMessageId?: string;
      status?: string;
      error?: string | null;
      payload?: unknown;
      sentAt?: string;
    };

    if (!body.providerMessageId) throw new ApiError(400, "providerMessageId is required");

    const nextStatus = body.status === "failed" ? "failed" : body.status === "sent" ? "sent" : "queued";

    const [updated] = await db
      .update(communicationLogs)
      .set({
        status: nextStatus,
        error: body.error ?? null,
        providerPayload: JSON.stringify(body.payload ?? body),
        sentAt: body.sentAt ? new Date(body.sentAt) : nextStatus === "sent" ? new Date() : null,
      })
      .where(eq(communicationLogs.providerMessageId, body.providerMessageId))
      .returning();

    if (!updated) throw new ApiError(404, "Communication log not found");

    return jsonOk({ ok: true, id: updated.id, status: updated.status });
  } catch (err) {
    return errorToResponse(err);
  }
}
