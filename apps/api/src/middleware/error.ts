import type { Context } from "hono";
import type { AppEnv } from "../index";

export function errorHandler(err: Error, c: Context<AppEnv>) {
  console.error("[api]", err);
  const status = (err as { status?: number }).status ?? 500;
  return c.json({ error: err.message || "Internal Server Error" }, status as 500);
}
