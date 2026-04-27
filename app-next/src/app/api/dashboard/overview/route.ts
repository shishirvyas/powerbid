import { NextRequest } from "next/server";
import { errorToResponse, jsonOk, parseSearch, requireSession } from "@/lib/api";
import { getDashboardOverview } from "@/lib/dashboard/metrics";
import { dashboardOverviewQuerySchema } from "@/lib/schemas";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    await requireSession();
    const filters = parseSearch(new URL(req.url), dashboardOverviewQuerySchema);
    const data = await getDashboardOverview(filters);
    return jsonOk(data);
  } catch (err) {
    return errorToResponse(err);
  }
}
