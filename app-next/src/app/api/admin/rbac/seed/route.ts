import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api";
import { ApiError } from "@/lib/api";
import { seedRbac } from "@/lib/rbac/seed";

/**
 * POST /api/admin/rbac/seed
 *
 * Bootstrap (or re-seed) default roles, departments, and workflow action
 * permissions for the default tenant.
 *
 * Requires: admin session role.
 * Idempotent: safe to run multiple times.
 */
export async function POST() {
  try {
    const session = await requireSession();
    if (session.role !== "admin") {
      throw new ApiError(403, "Admin role required to seed RBAC");
    }

    await seedRbac();

    return NextResponse.json({ ok: true, message: "RBAC bootstrap complete" });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[POST /api/admin/rbac/seed]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
