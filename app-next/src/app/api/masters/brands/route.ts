import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { brands } from "@/lib/db/schema";
import {
  ApiError,
  errorToResponse,
  jsonOk,
  parseId,
  parseJson,
  requireSession,
} from "@/lib/api";
import { brandSchema } from "@/lib/schemas";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireSession();
    const rows = await db.select().from(brands);
    return jsonOk({ rows });
  } catch (err) {
    return errorToResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireSession();
    const data = await parseJson(req, brandSchema);
    const exists = await db.select({ id: brands.id }).from(brands).where(eq(brands.name, data.name)).limit(1);
    if (exists.length) throw new ApiError(409, `Brand "${data.name}" already exists`);
    const [row] = await db.insert(brands).values(data).returning();
    return jsonOk(row, { status: 201 });
  } catch (err) {
    return errorToResponse(err);
  }
}
