import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { verifyPassword } from "@/lib/crypto";
import { signSession, setSessionCookie } from "@/lib/auth";

export const runtime = "nodejs";

const Body = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  let parsed;
  try {
    parsed = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const [u] = await db.select().from(users).where(eq(users.email, parsed.email)).limit(1);
  if (!u || !u.isActive) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }
  const ok = await verifyPassword(parsed.password, u.passwordHash);
  if (!ok) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const token = await signSession({
    userId: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
  });
  await setSessionCookie(token);

  return NextResponse.json({
    user: { id: u.id, email: u.email, name: u.name, role: u.role },
  });
}
