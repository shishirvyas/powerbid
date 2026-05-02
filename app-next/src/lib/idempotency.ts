import { and, eq } from "drizzle-orm";
import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiIdempotency } from "@/lib/db/schema";
import { ApiError } from "@/lib/api";

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function normalizePath(req: NextRequest): string {
  return new URL(req.url).pathname;
}

export interface IdempotentResult<T> {
  data: T;
  status?: number;
}

export interface IdempotencyOptions {
  req: NextRequest;
  userId: number;
  fingerprint?: unknown;
  actionType?: string | null;
}

/**
 * Execute a mutation with persistent idempotency semantics.
 *
 * If `Idempotency-Key` is absent, this behaves like a direct call.
 * If present and already completed, returns cached response.
 * If present and currently processing, rejects with 409.
 */
export async function runIdempotentMutation<T>(
  options: IdempotencyOptions,
  execute: () => Promise<IdempotentResult<T>>,
): Promise<Response> {
  const key = options.req.headers.get("Idempotency-Key")?.trim() ?? "";
  if (!key) {
    const { data, status } = await execute();
    return NextResponse.json(data, { status: status ?? 200 });
  }

  const method = options.req.method.toUpperCase();
  const path = normalizePath(options.req);
  const actionType = options.actionType ?? options.req.headers.get("X-Action-Type");
  const fingerprint =
    options.fingerprint == null ? null : digest(JSON.stringify(options.fingerprint));

  const [existing] = await db
    .select()
    .from(apiIdempotency)
    .where(
      and(
        eq(apiIdempotency.userId, options.userId),
        eq(apiIdempotency.method, method),
        eq(apiIdempotency.path, path),
        eq(apiIdempotency.key, key),
      ),
    )
    .limit(1);

  if (existing) {
    if (existing.fingerprint && fingerprint && existing.fingerprint !== fingerprint) {
      throw new ApiError(409, "Idempotency key reused with different payload");
    }
    if (existing.status === "completed" && existing.responseBody) {
      let payload: unknown;
      try {
        payload = JSON.parse(existing.responseBody);
      } catch {
        payload = { ok: true };
      }
      const res = NextResponse.json(payload, { status: existing.responseStatus ?? 200 });
      res.headers.set("X-Idempotent-Replay", "true");
      return res;
    }
    throw new ApiError(409, "Duplicate request is already processing");
  }

  await db.insert(apiIdempotency).values({
    userId: options.userId,
    method,
    path,
    actionType: actionType ?? null,
    key,
    fingerprint,
    status: "processing",
    updatedAt: new Date(),
  });

  try {
    const { data, status } = await execute();
    const statusCode = status ?? 200;
    await db
      .update(apiIdempotency)
      .set({
        status: "completed",
        responseStatus: statusCode,
        responseBody: JSON.stringify(data),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(apiIdempotency.userId, options.userId),
          eq(apiIdempotency.method, method),
          eq(apiIdempotency.path, path),
          eq(apiIdempotency.key, key),
        ),
      );

    return NextResponse.json(data, { status: statusCode });
  } catch (err) {
    await db
      .delete(apiIdempotency)
      .where(
        and(
          eq(apiIdempotency.userId, options.userId),
          eq(apiIdempotency.method, method),
          eq(apiIdempotency.path, path),
          eq(apiIdempotency.key, key),
        ),
      );
    throw err;
  }
}
