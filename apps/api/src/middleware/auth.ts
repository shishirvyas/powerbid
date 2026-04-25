import type { MiddlewareHandler } from "hono";
import { jwtVerify } from "jose";
import type { AppEnv } from "../index";

export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const auth = c.req.header("Authorization");
  if (!auth?.startsWith("Bearer ")) return c.json({ error: "Unauthorized" }, 401);
  try {
    const secret = new TextEncoder().encode(c.env.JWT_SECRET);
    const { payload } = await jwtVerify(auth.slice(7), secret, {
      issuer: c.env.JWT_ISSUER,
    });
    c.set("userId", Number(payload.sub));
    c.set("userEmail", String(payload.email ?? ""));
    await next();
  } catch {
    return c.json({ error: "Invalid token" }, 401);
  }
};
