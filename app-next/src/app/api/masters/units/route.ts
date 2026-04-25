import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { units } from "@/lib/db/schema";
import {
  ApiError,
  errorToResponse,
  jsonOk,
  parseJson,
  requireSession,
} from "@/lib/api";
import { unitSchema } from "@/lib/schemas";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireSession();
    const rows = await db.select().from(units);
    return jsonOk({ rows });
  } catch (err) {
    return errorToResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireSession();
    const data = await parseJson(req, unitSchema);
    const exists = await db.select({ id: units.id }).from(units).where(eq(units.code, data.code)).limit(1);
    if (exists.length) throw new ApiError(409, `Unit code "${data.code}" already exists`);
    const [row] = await db.insert(units).values(data).returning();
    return jsonOk(row, { status: 201 });
  } catch (err) {
    return errorToResponse(err);
  }
}
