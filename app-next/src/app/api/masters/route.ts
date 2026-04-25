import { NextRequest } from "next/server";
import { asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { brands, units, gstSlabs } from "@/lib/db/schema";
import { errorToResponse, jsonOk, requireSession } from "@/lib/api";

export const runtime = "nodejs";

export async function GET(_req: NextRequest) {
  try {
    await requireSession();
    const [brandRows, unitRows, gstRows] = await Promise.all([
      db.select().from(brands).orderBy(asc(brands.name)),
      db.select().from(units).orderBy(asc(units.code)),
      db.select().from(gstSlabs).orderBy(asc(gstSlabs.rate)),
    ]);
    return jsonOk({ brands: brandRows, units: unitRows, gstSlabs: gstRows });
  } catch (err) {
    return errorToResponse(err);
  }
}
