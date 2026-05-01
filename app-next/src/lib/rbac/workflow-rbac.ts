import { and, count, eq, inArray, isNull, or } from "drizzle-orm";
import { ApiError } from "@/lib/api";
import { db } from "@/lib/db";
import {
  rbacDecisionAudit,
  roles,
  userRoleBindings,
  workflowActionPermissions,
} from "@/lib/db/schema";

/**
 * When RBAC_STRICT_MODE=true, the fallback-allow path is replaced with a deny.
 * This prevents transitions when no explicit policy row exists.
 * Set this env var in production after seeding roles and permissions.
 */
const STRICT_MODE = process.env.RBAC_STRICT_MODE === "true";

type AuthorizeTransitionInput = {
  tenantId: string;
  workflowType: string;
  entityId: number;
  currentState: string;
  actionCode: string;
  targetState: string;
  actorUserId?: number;
  sessionRole: string;
  departmentId?: number;
};

async function resolveActorRoles(tenantId: string, actorUserId: number | undefined, sessionRole: string) {
  const roleSet = new Set<string>([sessionRole.trim().toLowerCase()]);
  if (!actorUserId) return Array.from(roleSet);

  const rows = await db
    .select({ roleCode: roles.code })
    .from(userRoleBindings)
    .innerJoin(roles, eq(userRoleBindings.roleId, roles.id))
    .where(
      and(
        eq(userRoleBindings.tenantId, tenantId),
        eq(userRoleBindings.userId, actorUserId),
        eq(userRoleBindings.isActive, true),
        eq(roles.isActive, true),
      ),
    );

  for (const row of rows) roleSet.add(row.roleCode.trim().toLowerCase());
  return Array.from(roleSet);
}

async function writeAudit(input: {
  tenantId: string;
  workflowType: string;
  entityId: number;
  currentState: string;
  actionCode: string;
  targetState: string;
  actorUserId?: number;
  actorRole: string;
  departmentId?: number;
  decision: "allow" | "deny";
  reason: string;
}) {
  await db.insert(rbacDecisionAudit).values({
    tenantId: input.tenantId,
    workflowType: input.workflowType,
    entityId: input.entityId,
    currentState: input.currentState,
    actionCode: input.actionCode,
    targetState: input.targetState,
    actorUserId: input.actorUserId,
    actorRole: input.actorRole,
    departmentId: input.departmentId,
    decision: input.decision,
    reason: input.reason,
  });
}

export async function authorizeWorkflowTransition(input: AuthorizeTransitionInput) {
  const workflowType = input.workflowType.toUpperCase();
  const actorRoles = await resolveActorRoles(input.tenantId, input.actorUserId, input.sessionRole);

  const [policyCountRow] = await db
    .select({ count: count() })
    .from(workflowActionPermissions)
    .where(
      and(
        eq(workflowActionPermissions.tenantId, input.tenantId),
        eq(workflowActionPermissions.workflowType, workflowType),
        eq(workflowActionPermissions.fromState, input.currentState),
        eq(workflowActionPermissions.actionCode, input.actionCode),
        or(isNull(workflowActionPermissions.toState), eq(workflowActionPermissions.toState, input.targetState)),
        eq(workflowActionPermissions.isActive, true),
      ),
    );

  if ((policyCountRow?.count ?? 0) === 0) {
    if (STRICT_MODE) {
      await writeAudit({
        tenantId: input.tenantId,
        workflowType,
        entityId: input.entityId,
        currentState: input.currentState,
        actionCode: input.actionCode,
        targetState: input.targetState,
        actorUserId: input.actorUserId,
        actorRole: input.sessionRole,
        departmentId: input.departmentId,
        decision: "deny",
        reason: "No explicit policy found; strict mode — deny by default",
      });
      throw new ApiError(403, "Transition denied: no policy configured for this action");
    }
    await writeAudit({
      tenantId: input.tenantId,
      workflowType,
      entityId: input.entityId,
      currentState: input.currentState,
      actionCode: input.actionCode,
      targetState: input.targetState,
      actorUserId: input.actorUserId,
      actorRole: input.sessionRole,
      departmentId: input.departmentId,
      decision: "allow",
      reason: "No explicit policy found; fallback allow (set RBAC_STRICT_MODE=true for production)",
    });
    return;
  }

  const rows = await db
    .select({
      effect: workflowActionPermissions.effect,
      roleCode: roles.code,
      departmentId: workflowActionPermissions.departmentId,
    })
    .from(workflowActionPermissions)
    .innerJoin(roles, eq(workflowActionPermissions.roleId, roles.id))
    .where(
      and(
        eq(workflowActionPermissions.tenantId, input.tenantId),
        eq(workflowActionPermissions.workflowType, workflowType),
        eq(workflowActionPermissions.fromState, input.currentState),
        eq(workflowActionPermissions.actionCode, input.actionCode),
        or(isNull(workflowActionPermissions.toState), eq(workflowActionPermissions.toState, input.targetState)),
        eq(workflowActionPermissions.isActive, true),
        eq(roles.isActive, true),
        inArray(roles.code, actorRoles),
      ),
    );

  const scopedRows = rows.filter((row) => {
    if (row.departmentId == null) return true;
    return input.departmentId != null && row.departmentId === input.departmentId;
  });

  const hasDeny = scopedRows.some((row) => row.effect.toLowerCase() === "deny");
  if (hasDeny) {
    await writeAudit({
      tenantId: input.tenantId,
      workflowType,
      entityId: input.entityId,
      currentState: input.currentState,
      actionCode: input.actionCode,
      targetState: input.targetState,
      actorUserId: input.actorUserId,
      actorRole: input.sessionRole,
      departmentId: input.departmentId,
      decision: "deny",
      reason: "Denied by explicit RBAC policy",
    });
    throw new ApiError(403, "Transition denied by RBAC policy");
  }

  const hasAllow = scopedRows.some((row) => row.effect.toLowerCase() === "allow");
  if (!hasAllow) {
    await writeAudit({
      tenantId: input.tenantId,
      workflowType,
      entityId: input.entityId,
      currentState: input.currentState,
      actionCode: input.actionCode,
      targetState: input.targetState,
      actorUserId: input.actorUserId,
      actorRole: input.sessionRole,
      departmentId: input.departmentId,
      decision: "deny",
      reason: "No matching allow policy for actor role/scope",
    });
    throw new ApiError(403, "Transition not permitted for current role/scope");
  }

  await writeAudit({
    tenantId: input.tenantId,
    workflowType,
    entityId: input.entityId,
    currentState: input.currentState,
    actionCode: input.actionCode,
    targetState: input.targetState,
    actorUserId: input.actorUserId,
    actorRole: input.sessionRole,
    departmentId: input.departmentId,
    decision: "allow",
    reason: "Allowed by RBAC policy",
  });
}
