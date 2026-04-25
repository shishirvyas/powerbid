import { Hono } from "hono";
import { SignJWT } from "jose";
import { eq } from "drizzle-orm";
import { loginInput, registerInput } from "@powerbid/shared";
import type { AppEnv } from "../../index";
import { getDb, schema } from "../../db/client";
import { hashPassword, verifyPassword } from "../../services/crypto";
import { parseJson } from "../../lib/validate";
import { conflict, unauthorized } from "../../lib/errors";

export const authRoutes = new Hono<AppEnv>();

authRoutes.post("/login", async (c) => {
  const body = await parseJson(c.req.raw, loginInput);
  const db = getDb(c.env.DB);
  const user = await db.query.users.findFirst({ where: eq(schema.users.email, body.email) });
  if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
    throw unauthorized("Invalid credentials");
  }
  const secret = new TextEncoder().encode(c.env.JWT_SECRET);
  const token = await new SignJWT({ email: user.email, role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(c.env.JWT_ISSUER)
    .setSubject(String(user.id))
    .setIssuedAt()
    .setExpirationTime("1d")
    .sign(secret);
  return c.json({
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  });
});

authRoutes.post("/register", async (c) => {
  const body = await parseJson(c.req.raw, registerInput);
  const db = getDb(c.env.DB);
  const existing = await db.query.users.findFirst({ where: eq(schema.users.email, body.email) });
  if (existing) throw conflict("Email already registered");
  const passwordHash = await hashPassword(body.password);
  const [created] = await db
    .insert(schema.users)
    .values({ email: body.email, name: body.name, passwordHash })
    .returning();
  return c.json({ id: created.id }, 201);
});
