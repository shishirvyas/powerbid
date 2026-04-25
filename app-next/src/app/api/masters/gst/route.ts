import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { gstSlabs } from "@/lib/db/schema";
import {
  ApiError,
  errorToResponse,
  jsonOk,
  parseJson,
  requireSession,
} from "@/lib/api";
import { gstSchema } from "@/lib/schemas";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireSession();
    const rows = await db.select().from(gstSlabs);
    return jsonOk({ rows });
  } catch (err) {
    return errorToResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireSession();
    const data = await parseJson(req, gstSchema);
    const [row] = await db.insert(gstSlabs).values(data).returning();
    return jsonOk(row, { status: 201 });
  } catch (err) {
    return errorToResponse(err);
  }
}
