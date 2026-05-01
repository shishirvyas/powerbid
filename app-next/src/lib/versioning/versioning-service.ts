/**
 * Entity Versioning Service
 *
 * Provides immutable version snapshots for BOM, ORDER, PO entities with:
 * - Atomic version creation (transactional, version_no increments safely)
 * - Active/current version pointer per entity
 * - Delta computation between consecutive versions
 * - Procurement version locking (so RFQ/PO are always traceable)
 * - Full version audit trail
 */

import { and, desc, eq, sql } from "drizzle-orm";
import { ApiError } from "@/lib/api";
import { db } from "@/lib/db";
import {
  entityVersionDeltas,
  entityVersions,
  entityVersionSets,
  procurementVersionLocks,
  versionAuditLog,
} from "@/lib/db/schema";

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

export type CreateVersionInput = {
  tenantId: string;
  entityType: string;
  entityId: number;
  snapshot: Record<string, unknown>;
  label?: string;
  createdBy?: number;
};

export type VersionDelta = {
  added: Record<string, unknown>;
  removed: Record<string, unknown>;
  changed: Record<string, { from: unknown; to: unknown }>;
};

export type LockVersionInput = {
  tenantId: string;
  procurementEntityType: string;
  procurementEntityId: number;
  versionId: number;
  lockedBy?: number;
};

/* ------------------------------------------------------------------ */
/*  Delta computation                                                    */
/* ------------------------------------------------------------------ */

export function computeDelta(
  from: Record<string, unknown>,
  to: Record<string, unknown>,
): VersionDelta {
  const added: Record<string, unknown> = {};
  const removed: Record<string, unknown> = {};
  const changed: Record<string, { from: unknown; to: unknown }> = {};

  const allKeys = new Set([...Object.keys(from), ...Object.keys(to)]);
  for (const key of allKeys) {
    const inFrom = Object.prototype.hasOwnProperty.call(from, key);
    const inTo = Object.prototype.hasOwnProperty.call(to, key);
    if (!inFrom) {
      added[key] = to[key];
    } else if (!inTo) {
      removed[key] = from[key];
    } else if (JSON.stringify(from[key]) !== JSON.stringify(to[key])) {
      changed[key] = { from: from[key], to: to[key] };
    }
  }
  return { added, removed, changed };
}

/* ------------------------------------------------------------------ */
/*  Main service                                                         */
/* ------------------------------------------------------------------ */

export class EntityVersioningService {
  /**
   * createVersion — create a new immutable version snapshot for an entity.
   * Atomically:
   *   1. Ensures a version_set exists for the entity
   *   2. Increments version_no
   *   3. Marks previous version as not current
   *   4. Inserts new version as current
   *   5. Updates entity_version_sets.current_version_id
   *   6. Computes and stores delta vs. previous version
   *   7. Writes audit log entry
   */
  async createVersion(input: CreateVersionInput) {
    const entityType = input.entityType.toUpperCase();
    const snapshotJson = JSON.stringify(input.snapshot);

    return await db.transaction(async (tx) => {
      // 1. Get or create version set
      let [vset] = await tx
        .select()
        .from(entityVersionSets)
        .where(
          and(
            eq(entityVersionSets.tenantId, input.tenantId),
            eq(entityVersionSets.entityType, entityType),
            eq(entityVersionSets.entityId, input.entityId),
          ),
        );

      if (!vset) {
        [vset] = await tx
          .insert(entityVersionSets)
          .values({
            tenantId: input.tenantId,
            entityType,
            entityId: input.entityId,
          })
          .returning();
      }

      // 2. Determine next version number
      const [maxRow] = await tx
        .select({ maxNo: sql<number>`coalesce(max(${entityVersions.versionNo}), 0)` })
        .from(entityVersions)
        .where(
          and(
            eq(entityVersions.tenantId, input.tenantId),
            eq(entityVersions.entityType, entityType),
            eq(entityVersions.entityId, input.entityId),
          ),
        );
      const nextVersionNo = (maxRow?.maxNo ?? 0) + 1;

      // 3. Get previous current version for delta computation
      let previousSnapshot: Record<string, unknown> | null = null;
      let previousVersionId: number | null = null;
      if (vset.currentVersionId) {
        const [prevVersion] = await tx
          .select({ id: entityVersions.id, snapshot: entityVersions.snapshot })
          .from(entityVersions)
          .where(eq(entityVersions.id, vset.currentVersionId));
        if (prevVersion?.snapshot) {
          previousSnapshot = JSON.parse(prevVersion.snapshot) as Record<string, unknown>;
          previousVersionId = prevVersion.id;
        }
      }

      // 4. Mark all prior versions as not current
      await tx
        .update(entityVersions)
        .set({ isCurrent: false })
        .where(
          and(
            eq(entityVersions.tenantId, input.tenantId),
            eq(entityVersions.entityType, entityType),
            eq(entityVersions.entityId, input.entityId),
          ),
        );

      // 5. Insert new version
      const [newVersion] = await tx
        .insert(entityVersions)
        .values({
          tenantId: input.tenantId,
          versionSetId: vset.id,
          entityType,
          entityId: input.entityId,
          versionNo: nextVersionNo,
          label: input.label ?? `v${nextVersionNo}`,
          snapshot: snapshotJson,
          isCurrent: true,
          createdBy: input.createdBy,
        })
        .returning();

      // 6. Update version set's current pointer
      await tx
        .update(entityVersionSets)
        .set({ currentVersionId: newVersion.id, updatedAt: new Date() })
        .where(eq(entityVersionSets.id, vset.id));

      // 7. Compute and store delta if previous version exists
      if (previousVersionId && previousSnapshot) {
        const delta = computeDelta(previousSnapshot, input.snapshot);
        await tx.insert(entityVersionDeltas).values({
          tenantId: input.tenantId,
          fromVersionId: previousVersionId,
          toVersionId: newVersion.id,
          delta: JSON.stringify(delta),
        });
      }

      // 8. Write audit log
      await tx.insert(versionAuditLog).values({
        tenantId: input.tenantId,
        entityType,
        entityId: input.entityId,
        versionId: newVersion.id,
        action: "create_version",
        actorUserId: input.createdBy,
        detail: `Created version ${newVersion.versionNo}${input.label ? ` (${input.label})` : ""}`,
      });

      return newVersion;
    });
  }

  /**
   * getCurrentVersion — fetch the active (current) version snapshot for an entity.
   */
  async getCurrentVersion(tenantId: string, entityType: string, entityId: number) {
    const type = entityType.toUpperCase();

    const [version] = await db
      .select()
      .from(entityVersions)
      .where(
        and(
          eq(entityVersions.tenantId, tenantId),
          eq(entityVersions.entityType, type),
          eq(entityVersions.entityId, entityId),
          eq(entityVersions.isCurrent, true),
        ),
      );

    if (!version) return null;
    return {
      ...version,
      snapshotParsed: JSON.parse(version.snapshot) as Record<string, unknown>,
    };
  }

  /**
   * listVersions — list all versions for an entity, newest first.
   */
  async listVersions(tenantId: string, entityType: string, entityId: number) {
    const type = entityType.toUpperCase();

    const versions = await db
      .select({
        id: entityVersions.id,
        versionNo: entityVersions.versionNo,
        label: entityVersions.label,
        isCurrent: entityVersions.isCurrent,
        createdBy: entityVersions.createdBy,
        createdAt: entityVersions.createdAt,
      })
      .from(entityVersions)
      .where(
        and(
          eq(entityVersions.tenantId, tenantId),
          eq(entityVersions.entityType, type),
          eq(entityVersions.entityId, entityId),
        ),
      )
      .orderBy(desc(entityVersions.versionNo));

    return versions;
  }

  /**
   * getDelta — fetch the computed delta between two consecutive versions.
   * Returns null if no delta record exists (i.e., first version).
   */
  async getDelta(fromVersionId: number, toVersionId: number): Promise<VersionDelta | null> {
    const [row] = await db
      .select({ delta: entityVersionDeltas.delta })
      .from(entityVersionDeltas)
      .where(
        and(
          eq(entityVersionDeltas.fromVersionId, fromVersionId),
          eq(entityVersionDeltas.toVersionId, toVersionId),
        ),
      );

    if (!row) return null;
    return JSON.parse(row.delta) as VersionDelta;
  }

  /**
   * lockProcurementVersion — record which version a procurement action resolved against.
   * Idempotent: calling again with the same procurement entity updates the lock.
   */
  async lockProcurementVersion(input: LockVersionInput) {
    await db
      .insert(procurementVersionLocks)
      .values({
        tenantId: input.tenantId,
        procurementEntityType: input.procurementEntityType.toUpperCase(),
        procurementEntityId: input.procurementEntityId,
        lockedVersionId: input.versionId,
        lockedBy: input.lockedBy,
        lockedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [
          procurementVersionLocks.tenantId,
          procurementVersionLocks.procurementEntityType,
          procurementVersionLocks.procurementEntityId,
        ],
        set: {
          lockedVersionId: input.versionId,
          lockedAt: new Date(),
          lockedBy: input.lockedBy,
        },
      });

    await db.insert(versionAuditLog).values({
      tenantId: input.tenantId,
      entityType: input.procurementEntityType.toUpperCase(),
      entityId: input.procurementEntityId,
      versionId: input.versionId,
      action: "lock",
      actorUserId: input.lockedBy,
      detail: `Procurement ${input.procurementEntityType} #${input.procurementEntityId} locked to version ID ${input.versionId}`,
    });
  }

  /**
   * getProcurementLock — fetch the locked version for a procurement entity.
   */
  async getProcurementLock(
    tenantId: string,
    procurementEntityType: string,
    procurementEntityId: number,
  ) {
    const [lock] = await db
      .select()
      .from(procurementVersionLocks)
      .where(
        and(
          eq(procurementVersionLocks.tenantId, tenantId),
          eq(procurementVersionLocks.procurementEntityType, procurementEntityType.toUpperCase()),
          eq(procurementVersionLocks.procurementEntityId, procurementEntityId),
        ),
      );
    return lock ?? null;
  }

  /**
   * getVersionById — fetch a specific version by ID, with parsed snapshot.
   */
  async getVersionById(versionId: number) {
    const [version] = await db
      .select()
      .from(entityVersions)
      .where(eq(entityVersions.id, versionId));

    if (!version) throw new ApiError(404, `Version #${versionId} not found`);
    return {
      ...version,
      snapshotParsed: JSON.parse(version.snapshot) as Record<string, unknown>,
    };
  }
}

export const entityVersioningService = new EntityVersioningService();
