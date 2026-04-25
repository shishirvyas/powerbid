import { NextResponse } from "next/server";
import { ZodError, type ZodSchema } from "zod";
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
  if (err instanceof ZodError) return jsonError(400, "Validation failed", err.flatten());
  // eslint-disable-next-line no-console
  console.error("[api]", err);
  const message = err instanceof Error ? err.message : "Internal Server Error";
  return jsonError(500, message);
}

export async function parseJson<T>(req: Request, schema: ZodSchema<T>): Promise<T> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new ApiError(400, "Invalid JSON body");
  }
  return schema.parse(body);
}

export function parseSearch<T>(url: URL, schema: ZodSchema<T>): T {
  const obj: Record<string, string> = {};
  for (const [k, v] of url.searchParams.entries()) obj[k] = v;
  return schema.parse(obj);
}

export function parseId(value: string): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, "Invalid id");
  return id;
}
