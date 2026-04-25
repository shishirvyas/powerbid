import type { z, ZodTypeAny } from "zod";
import { badRequest } from "./errors";

/** Parse a JSON body against a zod schema or throw a 400 with field issues. */
export async function parseJson<S extends ZodTypeAny>(
  req: Request,
  schema: S,
): Promise<z.infer<S>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw badRequest("Invalid JSON body");
  }
  const result = schema.safeParse(body);
  if (!result.success) {
    throw badRequest("Validation failed", {
      issues: result.error.issues.map((i) => ({
        path: i.path.join("."),
        code: i.code,
        message: i.message,
      })),
    });
  }
  return result.data;
}

/** Parse query params against a zod object schema. */
export function parseQuery<S extends ZodTypeAny>(req: Request, schema: S): z.infer<S> {
  const url = new URL(req.url);
  const params: Record<string, string> = {};
  url.searchParams.forEach((v, k) => (params[k] = v));
  const result = schema.safeParse(params);
  if (!result.success) {
    throw badRequest("Invalid query", {
      issues: result.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      })),
    });
  }
  return result.data;
}

/** Parse a positive integer route param ("id"). */
export function parseId(value: string | undefined, name = "id"): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw badRequest(`Invalid ${name}`);
  return n;
}
