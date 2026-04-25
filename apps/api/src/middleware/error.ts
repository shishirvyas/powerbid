import type { Context } from "hono";
import { ZodError } from "zod";
import type { AppEnv } from "../index";
import { HttpError } from "../lib/errors";

export function errorHandler(err: Error, c: Context<AppEnv>) {
  if (err instanceof HttpError) {
    return c.json(
      { error: err.message, code: err.code, details: err.details },
      err.status as 400 | 401 | 403 | 404 | 409 | 500,
    );
  }
  if (err instanceof ZodError) {
    return c.json(
      {
        error: "Validation failed",
        code: "validation",
        details: {
          issues: err.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
          })),
        },
      },
      400,
    );
  }
  console.error("[api:error]", err);
  return c.json({ error: "Internal Server Error", code: "internal" }, 500);
}
