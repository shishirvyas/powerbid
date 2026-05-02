import { NextResponse } from "next/server";
import { ZodError, type ZodTypeAny, type z } from "zod";
import { getSession, type SessionPayload } from "@/lib/auth";

export type ApiContext = { session: SessionPayload };

export class ApiError extends Error {
  status: number;
  details?: unknown;
  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

/** Like jsonOk but adds stale-while-revalidate cache headers for list GETs */
export function jsonList<T>(data: T, maxAge = 10, swr = 30) {
  return NextResponse.json(data, {
    headers: {
      "Cache-Control": `private, max-age=${maxAge}, stale-while-revalidate=${swr}`,
    },
  });
}

export function jsonError(status: number, message: string, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status });
}

export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) throw new ApiError(401, "Unauthorized");
  return session;
}

export function handleApi<T>(fn: (ctx: ApiContext) => Promise<T>): () => Promise<Response> {
  return async () => {
    try {
      const session = await requireSession();
      const result = await fn({ session });
      return jsonOk(result);
    } catch (err) {
      return errorToResponse(err);
    }
  };
}

export function errorToResponse(err: unknown): Response {
  if (err instanceof ApiError) return jsonError(err.status, err.message, err.details);
  if (err instanceof ZodError) {
    const flattened = err.flatten();
    return jsonError(400, "Validation failed", {
      fieldErrors: flattened.fieldErrors,
      formErrors: flattened.formErrors,
      issues: err.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }
  // eslint-disable-next-line no-console
  console.error("[api]", err);
  const message = err instanceof Error ? err.message : "Internal Server Error";
  return jsonError(500, message);
}

export async function parseJson<S extends ZodTypeAny>(
  req: Request,
  schema: S,
): Promise<z.infer<S>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new ApiError(400, "Invalid JSON body");
  }
  return schema.parse(body);
}

export function parseSearch<S extends ZodTypeAny>(url: URL, schema: S): z.infer<S> {
  const obj: Record<string, string> = {};
  for (const [k, v] of url.searchParams.entries()) obj[k] = v;
  return schema.parse(obj);
}

export function parseId(value: string): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, "Invalid id");
  return id;
}
