import { Hono } from "hono";
import { z } from "zod";
import { SignJWT } from "jose";
import { eq } from "drizzle-orm";
import type { AppEnv } from "../../index";
import { getDb, schema } from "../../db/client";
import { hashPassword, verifyPassword } from "../../services/crypto";

export const authRoutes = new Hono<AppEnv>();

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(6) });

authRoutes.post("/login", async (c) => {
  const body = loginSchema.parse(await c.req.json());
  const db = getDb(c.env.DB);
  const user = await db.query.users.findFirst({ where: eq(schema.users.email, body.email) });
  if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
    return c.json({ error: "Invalid credentials" }, 401);
  }
  const secret = new TextEncoder().encode(c.env.JWT_SECRET);
  const token = await new SignJWT({ email: user.email, role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(c.env.JWT_ISSUER)
    .setSubject(String(user.id))
    .setIssuedAt()
    .setExpirationTime("1d")
    .sign(secret);
  return c.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
});

const registerSchema = loginSchema.extend({ name: z.string().min(2) });

authRoutes.post("/register", async (c) => {
  const body = registerSchema.parse(await c.req.json());
  const db = getDb(c.env.DB);
  const passwordHash = await hashPassword(body.password);
  const [created] = await db
    .insert(schema.users)
    .values({ email: body.email, name: body.name, passwordHash })
    .returning();
  return c.json({ id: created.id });
});
