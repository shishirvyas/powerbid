import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { purchaseApprovals, purchaseOrders, users } from "@/lib/db/schema";
import { ApiError, errorToResponse, jsonOk, parseId, parseJson, requireSession } from "@/lib/api";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

const createSchema = z.object({
  approverIds: z.array(z.number().int().positive()).min(1, "At least one approver is required"),
  comments: z.string().trim().max(500).optional().or(z.literal("")),
});

const actionSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  comments: z.string().trim().max(500).optional().or(z.literal("")),
});

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireSession();
    const id = parseId((await ctx.params).id);

    const [po] = await db
      .select({ id: purchaseOrders.id, status: purchaseOrders.status })
      .from(purchaseOrders)
      .where(eq(purchaseOrders.id, id));
    if (!po) throw new ApiError(404, "Purchase Order not found");

    const approvals = await db
      .select({
        id: purchaseApprovals.id,
        poId: purchaseApprovals.poId,
        approverId: purchaseApprovals.approverId,
        approverName: users.name,
        approverEmail: users.email,
        status: purchaseApprovals.status,
        comments: purchaseApprovals.comments,
        approvedAt: purchaseApprovals.approvedAt,
        createdAt: purchaseApprovals.createdAt,
      })
      .from(purchaseApprovals)
      .leftJoin(users, eq(purchaseApprovals.approverId, users.id))
      .where(eq(purchaseApprovals.poId, id))
      .orderBy(asc(purchaseApprovals.id));

    const approvers = await db
      .select({ id: users.id, name: users.name, email: users.email, role: users.role })
      .from(users)
      .where(and(eq(users.isActive, true), inArray(users.role, ["admin", "sales"])))
      .orderBy(asc(users.name));

    return jsonOk({
      po,
      approvals,
      approvers,
      me: session.userId,
      meRole: session.role,
    });
  } catch (err) {
    return errorToResponse(err);
  }
}

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireSession();
    if (session.role === "viewer") throw new ApiError(403, "Only sales/admin users can submit approvals");
    const id = parseId((await ctx.params).id);
    const payload = await parseJson(req, createSchema);

    const [po] = await db
      .select({ id: purchaseOrders.id })
      .from(purchaseOrders)
      .where(eq(purchaseOrders.id, id));
    if (!po) throw new ApiError(404, "Purchase Order not found");

    const ids = Array.from(new Set(payload.approverIds));
    const found = await db
      .select({ id: users.id })
      .from(users)
      .where(and(inArray(users.id, ids), eq(users.isActive, true)));
    if (found.length !== ids.length) throw new ApiError(400, "One or more approvers are invalid");

    await db.transaction(async (tx) => {
      await tx.delete(purchaseApprovals).where(eq(purchaseApprovals.poId, id));
      await tx.insert(purchaseApprovals).values(
        ids.map((approverId) => ({
          poId: id,
          approverId,
          status: "pending",
          comments: payload.comments || null,
        })),
      );

      await tx
        .update(purchaseOrders)
        .set({ status: "pending_approval", updatedAt: new Date(), updatedBy: session.userId })
        .where(eq(purchaseOrders.id, id));
    });

    return jsonOk({ ok: true });
  } catch (err) {
    return errorToResponse(err);
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireSession();
    if (session.role === "viewer") throw new ApiError(403, "Viewer users cannot action approvals");
    const id = parseId((await ctx.params).id);
    const payload = await parseJson(req, actionSchema);

    const [myApproval] = await db
      .select({
        id: purchaseApprovals.id,
        status: purchaseApprovals.status,
      })
      .from(purchaseApprovals)
      .where(and(eq(purchaseApprovals.poId, id), eq(purchaseApprovals.approverId, session.userId)))
      .limit(1);

    if (!myApproval) throw new ApiError(403, "You are not part of approval matrix for this PO");
    if (myApproval.status !== "pending") throw new ApiError(409, "Approval already actioned");

    await db.transaction(async (tx) => {
      await tx
        .update(purchaseApprovals)
        .set({ status: payload.status, comments: payload.comments || null, approvedAt: new Date() })
        .where(eq(purchaseApprovals.id, myApproval.id));

      const rows = await tx
        .select({ status: purchaseApprovals.status })
        .from(purchaseApprovals)
        .where(eq(purchaseApprovals.poId, id));

      const statuses = rows.map((r) => r.status);
      let poStatus: string | null = null;
      if (statuses.includes("rejected")) poStatus = "draft";
      else if (statuses.length > 0 && statuses.every((s) => s === "approved")) poStatus = "approved";

      if (poStatus) {
        await tx
          .update(purchaseOrders)
          .set({ status: poStatus, updatedAt: new Date(), updatedBy: session.userId })
          .where(eq(purchaseOrders.id, id));
      }
    });

    return jsonOk({ ok: true });
  } catch (err) {
    return errorToResponse(err);
  }
}
