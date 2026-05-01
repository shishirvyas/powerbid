/**
 * RBAC Bootstrap Seed
 *
 * Seeds default roles, departments, and workflow action permission policies
 * for the "default" tenant. Safe to run multiple times (upsert-style via ON CONFLICT).
 *
 * Roles:   admin, sales, procurement, production, stores, qa
 * Departments: SALES, PROCUREMENT, PRODUCTION, QA
 *
 * Permission matrix (deny-wins — an explicit deny always overrides any allow):
 *   ORDER workflow:
 *     - submit (DRAFT → SUBMITTED):                  sales, admin
 *     - approve_sales (SUBMITTED → SALES_APPROVED):  sales, admin
 *     - prepare_procurement (SALES_APPROVED → PROCUREMENT_READY): procurement, admin
 *     - prepare_production (PROCUREMENT_READY → PRODUCTION_READY): production, admin
 *     - start_production (PRODUCTION_READY → IN_PRODUCTION): production, admin
 *     - complete (IN_PRODUCTION → COMPLETED):        production, admin
 *     - hold / resume / cancel:                      all operational roles + admin
 *
 *   BOM workflow:
 *     - submit (DRAFT → UNDER_REVIEW):               production, admin
 *     - approve (UNDER_REVIEW → APPROVED):           production, admin
 *     - release (APPROVED → RELEASED):               production, admin
 *     - create_rfq (APPROVED → *):                   procurement ONLY (dept-scoped) + admin
 *     - supersede / hold / resume / cancel:          production, admin
 *
 *   PO workflow:
 *     - submit / approve / issue:                    procurement, admin
 *     - partial_receive:                             procurement, stores, admin
 *     - close / hold / resume / cancel:              procurement, admin
 */

import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { departments, roles, workflowActionPermissions } from "@/lib/db/schema";

const TENANT = "default";

/* ------------------------------------------------------------------ */
/*  Role definitions                                                    */
/* ------------------------------------------------------------------ */
const ROLES = [
  { code: "admin",       name: "Administrator",   isSystem: true },
  { code: "sales",       name: "Sales",           isSystem: false },
  { code: "procurement", name: "Procurement",     isSystem: false },
  { code: "production",  name: "Production",      isSystem: false },
  { code: "stores",      name: "Stores",          isSystem: false },
  { code: "qa",          name: "Quality Assurance", isSystem: false },
] as const;

/* ------------------------------------------------------------------ */
/*  Department definitions                                              */
/* ------------------------------------------------------------------ */
const DEPARTMENTS = [
  { code: "SALES",       name: "Sales Department" },
  { code: "PROCUREMENT", name: "Procurement Department" },
  { code: "PRODUCTION",  name: "Production Department" },
  { code: "QA",          name: "Quality Assurance Department" },
] as const;

/* ------------------------------------------------------------------ */
/*  Permission matrix                                                   */
/* Null departmentId means the permission is not scoped to a dept.     */
/* ------------------------------------------------------------------ */
type PermRow = {
  workflowType: string;
  fromState: string;
  actionCode: string;
  toState?: string;
  roleCode: string;
  deptCode?: string;
  effect: "allow" | "deny";
};

const PERMISSIONS: PermRow[] = [
  // ── ORDER ─────────────────────────────────────────────────────────
  { workflowType: "ORDER", fromState: "DRAFT",              actionCode: "submit",              roleCode: "sales",       effect: "allow" },
  { workflowType: "ORDER", fromState: "DRAFT",              actionCode: "submit",              roleCode: "admin",       effect: "allow" },
  { workflowType: "ORDER", fromState: "SUBMITTED",          actionCode: "approve_sales",       roleCode: "sales",       effect: "allow" },
  { workflowType: "ORDER", fromState: "SUBMITTED",          actionCode: "approve_sales",       roleCode: "admin",       effect: "allow" },
  { workflowType: "ORDER", fromState: "SALES_APPROVED",     actionCode: "prepare_procurement", roleCode: "procurement", effect: "allow" },
  { workflowType: "ORDER", fromState: "SALES_APPROVED",     actionCode: "prepare_procurement", roleCode: "admin",       effect: "allow" },
  { workflowType: "ORDER", fromState: "PROCUREMENT_READY",  actionCode: "prepare_production",  roleCode: "production",  effect: "allow" },
  { workflowType: "ORDER", fromState: "PROCUREMENT_READY",  actionCode: "prepare_production",  roleCode: "admin",       effect: "allow" },
  { workflowType: "ORDER", fromState: "PRODUCTION_READY",   actionCode: "start_production",    roleCode: "production",  effect: "allow" },
  { workflowType: "ORDER", fromState: "PRODUCTION_READY",   actionCode: "start_production",    roleCode: "admin",       effect: "allow" },
  { workflowType: "ORDER", fromState: "IN_PRODUCTION",      actionCode: "complete",            roleCode: "production",  effect: "allow" },
  { workflowType: "ORDER", fromState: "IN_PRODUCTION",      actionCode: "complete",            roleCode: "admin",       effect: "allow" },

  // ORDER hold/resume/cancel — all operational roles
  ...["DRAFT","SUBMITTED","SALES_APPROVED","PROCUREMENT_READY","PRODUCTION_READY","IN_PRODUCTION"].flatMap(state =>
    ["sales","procurement","production","admin"].map(role => ({
      workflowType: "ORDER", fromState: state, actionCode: "hold", roleCode: role, effect: "allow" as const,
    }))
  ),
  ...["sales","procurement","production","admin"].map(role => ({
    workflowType: "ORDER", fromState: "ON_HOLD", actionCode: "resume", roleCode: role, effect: "allow" as const,
  })),
  ...["DRAFT","SUBMITTED","SALES_APPROVED","PROCUREMENT_READY","PRODUCTION_READY","IN_PRODUCTION","ON_HOLD"].flatMap(state =>
    ["sales","procurement","production","admin"].map(role => ({
      workflowType: "ORDER", fromState: state, actionCode: "cancel", roleCode: role, effect: "allow" as const,
    }))
  ),

  // ── BOM ───────────────────────────────────────────────────────────
  { workflowType: "BOM", fromState: "DRAFT",        actionCode: "submit",    roleCode: "production",  effect: "allow" },
  { workflowType: "BOM", fromState: "DRAFT",        actionCode: "submit",    roleCode: "admin",       effect: "allow" },
  { workflowType: "BOM", fromState: "UNDER_REVIEW", actionCode: "approve",   roleCode: "production",  effect: "allow" },
  { workflowType: "BOM", fromState: "UNDER_REVIEW", actionCode: "approve",   roleCode: "admin",       effect: "allow" },
  { workflowType: "BOM", fromState: "APPROVED",     actionCode: "release",   roleCode: "production",  effect: "allow" },
  { workflowType: "BOM", fromState: "APPROVED",     actionCode: "release",   roleCode: "admin",       effect: "allow" },

  // create_rfq: ONLY procurement (dept-scoped to PROCUREMENT) and admin can move an APPROVED BOM to RFQ
  { workflowType: "BOM", fromState: "APPROVED", actionCode: "create_rfq", roleCode: "procurement", deptCode: "PROCUREMENT", effect: "allow" },
  { workflowType: "BOM", fromState: "APPROVED", actionCode: "create_rfq", roleCode: "admin",                                effect: "allow" },

  { workflowType: "BOM", fromState: "RELEASED",     actionCode: "supersede", roleCode: "production",  effect: "allow" },
  { workflowType: "BOM", fromState: "RELEASED",     actionCode: "supersede", roleCode: "admin",       effect: "allow" },

  ...["DRAFT","UNDER_REVIEW","APPROVED","RELEASED"].flatMap(state =>
    ["production","admin"].map(role => ({
      workflowType: "BOM", fromState: state, actionCode: "hold", roleCode: role, effect: "allow" as const,
    }))
  ),
  ...["production","admin"].map(role => ({
    workflowType: "BOM", fromState: "ON_HOLD", actionCode: "resume", roleCode: role, effect: "allow" as const,
  })),
  ...["DRAFT","UNDER_REVIEW","APPROVED","ON_HOLD"].flatMap(state =>
    ["production","admin"].map(role => ({
      workflowType: "BOM", fromState: state, actionCode: "cancel", roleCode: role, effect: "allow" as const,
    }))
  ),

  // ── PO ────────────────────────────────────────────────────────────
  { workflowType: "PO", fromState: "DRAFT",           actionCode: "submit",         roleCode: "procurement", effect: "allow" },
  { workflowType: "PO", fromState: "DRAFT",           actionCode: "submit",         roleCode: "admin",       effect: "allow" },
  { workflowType: "PO", fromState: "SUBMITTED",       actionCode: "approve",        roleCode: "procurement", effect: "allow" },
  { workflowType: "PO", fromState: "SUBMITTED",       actionCode: "approve",        roleCode: "admin",       effect: "allow" },
  { workflowType: "PO", fromState: "APPROVED",        actionCode: "issue",          roleCode: "procurement", effect: "allow" },
  { workflowType: "PO", fromState: "APPROVED",        actionCode: "issue",          roleCode: "admin",       effect: "allow" },
  { workflowType: "PO", fromState: "ISSUED",          actionCode: "partial_receive",roleCode: "procurement", effect: "allow" },
  { workflowType: "PO", fromState: "ISSUED",          actionCode: "partial_receive",roleCode: "stores",      effect: "allow" },
  { workflowType: "PO", fromState: "ISSUED",          actionCode: "partial_receive",roleCode: "admin",       effect: "allow" },
  { workflowType: "PO", fromState: "PARTIAL_RECEIPT", actionCode: "partial_receive",roleCode: "procurement", effect: "allow" },
  { workflowType: "PO", fromState: "PARTIAL_RECEIPT", actionCode: "partial_receive",roleCode: "stores",      effect: "allow" },
  { workflowType: "PO", fromState: "PARTIAL_RECEIPT", actionCode: "partial_receive",roleCode: "admin",       effect: "allow" },
  { workflowType: "PO", fromState: "ISSUED",          actionCode: "close",          roleCode: "procurement", effect: "allow" },
  { workflowType: "PO", fromState: "ISSUED",          actionCode: "close",          roleCode: "admin",       effect: "allow" },
  { workflowType: "PO", fromState: "PARTIAL_RECEIPT", actionCode: "close",          roleCode: "procurement", effect: "allow" },
  { workflowType: "PO", fromState: "PARTIAL_RECEIPT", actionCode: "close",          roleCode: "admin",       effect: "allow" },

  ...["DRAFT","SUBMITTED","APPROVED","ISSUED","PARTIAL_RECEIPT"].flatMap(state =>
    ["procurement","admin"].map(role => ({
      workflowType: "PO", fromState: state, actionCode: "hold", roleCode: role, effect: "allow" as const,
    }))
  ),
  ...["procurement","admin"].map(role => ({
    workflowType: "PO", fromState: "ON_HOLD", actionCode: "resume", roleCode: role, effect: "allow" as const,
  })),
  ...["DRAFT","SUBMITTED","APPROVED","ISSUED","PARTIAL_RECEIPT","ON_HOLD"].flatMap(state =>
    ["procurement","admin"].map(role => ({
      workflowType: "PO", fromState: state, actionCode: "cancel", roleCode: role, effect: "allow" as const,
    }))
  ),
];

/* ------------------------------------------------------------------ */
/*  Seed function                                                       */
/* ------------------------------------------------------------------ */
export async function seedRbac() {
  console.log("[rbac-seed] Starting RBAC bootstrap for tenant:", TENANT);

  // 1. Upsert roles
  for (const r of ROLES) {
    await db
      .insert(roles)
      .values({ tenantId: TENANT, code: r.code, name: r.name, isSystem: r.isSystem })
      .onConflictDoUpdate({
        target: [roles.tenantId, roles.code],
        set: { name: r.name, isActive: true },
      });
  }
  console.log(`[rbac-seed] Upserted ${ROLES.length} roles`);

  // 2. Upsert departments
  for (const d of DEPARTMENTS) {
    await db
      .insert(departments)
      .values({ tenantId: TENANT, code: d.code, name: d.name })
      .onConflictDoUpdate({
        target: [departments.tenantId, departments.code],
        set: { name: d.name, isActive: true },
      });
  }
  console.log(`[rbac-seed] Upserted ${DEPARTMENTS.length} departments`);

  // 3. Build lookup maps
  const roleRows = await db
    .select({ id: roles.id, code: roles.code })
    .from(roles)
    .where(eq(roles.tenantId, TENANT));
  const roleMap = new Map(roleRows.map((r) => [r.code, r.id]));

  const deptRows = await db
    .select({ id: departments.id, code: departments.code })
    .from(departments)
    .where(eq(departments.tenantId, TENANT));
  const deptMap = new Map(deptRows.map((d) => [d.code, d.id]));

  // 4. Deactivate all existing permissions for this tenant so we start clean
  await db
    .update(workflowActionPermissions)
    .set({ isActive: false })
    .where(eq(workflowActionPermissions.tenantId, TENANT));

  // 5. Insert permissions
  let inserted = 0;
  for (const p of PERMISSIONS) {
    const roleId = roleMap.get(p.roleCode);
    if (!roleId) {
      console.warn(`[rbac-seed] Role not found: ${p.roleCode} — skipping`);
      continue;
    }
    const departmentId = p.deptCode ? deptMap.get(p.deptCode) : undefined;

    await db
      .insert(workflowActionPermissions)
      .values({
        tenantId: TENANT,
        workflowType: p.workflowType,
        fromState: p.fromState,
        actionCode: p.actionCode,
        toState: p.toState ?? null,
        roleId,
        departmentId: departmentId ?? null,
        effect: p.effect,
        isActive: true,
      });
    inserted++;
  }
  console.log(`[rbac-seed] Inserted ${inserted} permission rows`);
  console.log("[rbac-seed] RBAC bootstrap complete");
}
