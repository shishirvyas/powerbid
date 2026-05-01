import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { workflowVersions } from "@/lib/db/schema";
import type { CreateVersionInput } from "@/lib/workflow/types";

export class VersionManager {
  async createVersion(input: CreateVersionInput) {
    const whereEntity = and(
      eq(workflowVersions.tenantId, input.tenantId),
      eq(workflowVersions.entityType, input.entityType),
      eq(workflowVersions.entityId, input.entityId),
    );

    return db.transaction(async (tx) => {
      await tx
        .update(workflowVersions)
        .set({ isCurrent: false })
        .where(whereEntity);

      const [maxRow] = await tx
        .select({ maxVersion: sql<number>`coalesce(max(${workflowVersions.versionNo}), 0)::int` })
        .from(workflowVersions)
        .where(whereEntity);

      const nextVersion = (maxRow?.maxVersion ?? 0) + 1;

      const [created] = await tx
        .insert(workflowVersions)
        .values({
          tenantId: input.tenantId,
          entityType: input.entityType,
          entityId: input.entityId,
          versionNo: nextVersion,
          isCurrent: true,
          snapshot: input.snapshot ? JSON.stringify(input.snapshot) : null,
          createdBy: input.actorUserId,
        })
        .returning();

      return created;
    });
  }

  async listVersions(tenantId: string, entityType: string, entityId: number) {
    return db
      .select()
      .from(workflowVersions)
      .where(
        and(
          eq(workflowVersions.tenantId, tenantId),
          eq(workflowVersions.entityType, entityType),
          eq(workflowVersions.entityId, entityId),
        ),
      )
      .orderBy(desc(workflowVersions.versionNo));
  }
}

export const versionManager = new VersionManager();
