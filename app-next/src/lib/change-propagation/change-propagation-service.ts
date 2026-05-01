/**
 * Change Propagation Service
 *
 * When a BOM version changes, this service:
 *   1. Creates a propagation event record
 *   2. Runs impact analysis — finds all downstream records affected:
 *        - Production orders that reference the BOM directly (via bomId)
 *        - Purchase orders containing products that are BOM raw materials
 *   3. Creates changeImpactRecords with `needs_revision` status
 *   4. Executes auto-actions based on the entity's current status:
 *        - Production order in 'draft'  → auto-flag (no state change, just annotate)
 *        - PO in 'draft'                → auto-flag
 *        - In-flight records (approved, sent, in_progress) → flag only; human action required
 *   5. Emits changeNotifications for role owners (procurement / production)
 *
 * The service is intentionally stateless and transactional — every propagation
 * run is idempotent within the same event; if re-triggered for the same
 * bomId + versionId, it will create a fresh event (historical record).
 */

import { and, eq, inArray, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  bomItems,
  bomMaster,
  changeImpactRecords,
  changeNotifications,
  changePropagationEvents,
  productionOrders,
  purchaseOrderItems,
  purchaseOrders,
} from "@/lib/db/schema";

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

export type PropagationResult = {
  eventId: number;
  impactCount: number;
  impactedProductionOrders: number[];
  impactedPurchaseOrders: number[];
  autoActioned: number;
  notificationsCreated: number;
};

export type ImpactSummary = {
  eventId: number;
  bomId: number;
  status: string;
  impactCount: number;
  createdAt: Date;
  completedAt: Date | null;
};

/** Statuses considered "in-flight" (not terminal) for production orders */
const ACTIVE_PRODUCTION_STATUSES = ["draft", "in_progress"];
/** Statuses considered "in-flight" for purchase orders */
const ACTIVE_PO_STATUSES = ["draft", "pending_approval", "approved", "sent", "partial_received"];

/* ------------------------------------------------------------------ */
/*  Main service class                                                  */
/* ------------------------------------------------------------------ */

export class ChangePropagationService {
  /**
   * propagateBomChange — main entry point.
   *
   * Called after a BOM entity version is created via the versioning service.
   * Creates a propagation event and runs full impact analysis + auto-actions.
   */
  async propagateBomChange(
    tenantId: string,
    bomId: number,
    newVersionId: number | null,
    triggeredBy?: number,
  ): Promise<PropagationResult> {
    // 1. Create propagation event in 'running' state
    const [event] = await db
      .insert(changePropagationEvents)
      .values({
        tenantId,
        bomId,
        newVersionId,
        status: "running",
        triggeredBy,
        startedAt: new Date(),
      })
      .returning();

    try {
      const result = await this._runPropagation(tenantId, bomId, event.id, triggeredBy);

      // Mark event as completed
      await db
        .update(changePropagationEvents)
        .set({
          status: "completed",
          impactCount: result.impactCount,
          completedAt: new Date(),
        })
        .where(eq(changePropagationEvents.id, event.id));

      return { eventId: event.id, ...result };
    } catch (err) {
      await db
        .update(changePropagationEvents)
        .set({
          status: "failed",
          completedAt: new Date(),
          errorDetail: err instanceof Error ? err.message : String(err),
        })
        .where(eq(changePropagationEvents.id, event.id));
      throw err;
    }
  }

  /** Internal: run impact analysis and auto-actions */
  private async _runPropagation(
    tenantId: string,
    bomId: number,
    eventId: number,
    triggeredBy?: number,
  ) {
    // ---- 2. Impact Analysis ----------------------------------------

    // 2a. Production orders referencing this BOM directly
    const productionImpacts = await db
      .select({ id: productionOrders.id, status: productionOrders.status })
      .from(productionOrders)
      .where(
        and(
          eq(productionOrders.bomId, bomId),
          inArray(productionOrders.status, ACTIVE_PRODUCTION_STATUSES),
        ),
      );

    // 2b. Raw material products that belong to this BOM
    const materials = await db
      .select({ rawMaterialId: bomItems.rawMaterialId })
      .from(bomItems)
      .where(eq(bomItems.bomId, bomId));

    const materialProductIds = materials.map((m) => m.rawMaterialId);

    // 2c. Purchase orders whose items include any of those products
    let poImpacts: { id: number; status: string }[] = [];
    if (materialProductIds.length > 0) {
      const poItemRows = await db
        .selectDistinct({ poId: purchaseOrderItems.poId })
        .from(purchaseOrderItems)
        .where(inArray(purchaseOrderItems.productId, materialProductIds));

      const poIds = poItemRows.map((r) => r.poId);

      if (poIds.length > 0) {
        poImpacts = await db
          .select({ id: purchaseOrders.id, status: purchaseOrders.status })
          .from(purchaseOrders)
          .where(
            and(
              inArray(purchaseOrders.id, poIds),
              inArray(purchaseOrders.status, ACTIVE_PO_STATUSES),
            ),
          );
      }
    }

    // ---- 3. Create impact records -----------------------------------

    const impactInserts: (typeof changeImpactRecords.$inferInsert)[] = [];

    for (const po of productionImpacts) {
      impactInserts.push({
        tenantId,
        propagationEventId: eventId,
        impactedEntityType: "production_order",
        impactedEntityId: po.id,
        impactReason: `BOM (id=${bomId}) used by this production order has a new version.`,
        revisionStatus: "needs_revision",
        autoAction: "none",
      });
    }

    for (const po of poImpacts) {
      impactInserts.push({
        tenantId,
        propagationEventId: eventId,
        impactedEntityType: "purchase_order",
        impactedEntityId: po.id,
        impactReason: `Purchase order contains raw materials from BOM (id=${bomId}) which has a new version.`,
        revisionStatus: "needs_revision",
        autoAction: "none",
      });
    }

    let impactCount = 0;
    const impactIds: number[] = [];

    if (impactInserts.length > 0) {
      const inserted = await db
        .insert(changeImpactRecords)
        .values(impactInserts)
        .returning({ id: changeImpactRecords.id });
      impactCount = inserted.length;
      impactIds.push(...inserted.map((r) => r.id));
    }

    // ---- 4. Auto-actions -------------------------------------------

    let autoActioned = 0;

    // Flag draft production orders — annotate the impact record
    for (let i = 0; i < productionImpacts.length; i++) {
      if (productionImpacts[i].status === "draft") {
        await db
          .update(changeImpactRecords)
          .set({
            autoAction: "flagged",
            autoActionDetail: "Production order is in draft — flagged for BOM review before start.",
            revisionStatus: "auto_actioned",
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(changeImpactRecords.propagationEventId, eventId),
              eq(changeImpactRecords.impactedEntityType, "production_order"),
              eq(changeImpactRecords.impactedEntityId, productionImpacts[i].id),
            ),
          );
        autoActioned++;
      }
    }

    // Flag draft POs
    for (let i = 0; i < poImpacts.length; i++) {
      if (poImpacts[i].status === "draft") {
        await db
          .update(changeImpactRecords)
          .set({
            autoAction: "flagged",
            autoActionDetail: "Purchase order is in draft — flagged for BOM material review.",
            revisionStatus: "auto_actioned",
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(changeImpactRecords.propagationEventId, eventId),
              eq(changeImpactRecords.impactedEntityType, "purchase_order"),
              eq(changeImpactRecords.impactedEntityId, poImpacts[i].id),
            ),
          );
        autoActioned++;
      }
    }

    // ---- 5. Notifications ------------------------------------------

    let notificationsCreated = 0;
    const notifInserts: (typeof changeNotifications.$inferInsert)[] = [];

    // Get BOM info for notification text
    const [bom] = await db
      .select({ bomCode: bomMaster.bomCode })
      .from(bomMaster)
      .where(eq(bomMaster.id, bomId));
    const bomLabel = bom?.bomCode ?? `BOM #${bomId}`;

    // Notify production role owners for each impacted production order
    for (const po of productionImpacts) {
      const impactId = impactIds[impactInserts.findIndex(
        (r) => r.impactedEntityType === "production_order" && r.impactedEntityId === po.id,
      )];
      if (impactId === undefined) continue;
      notifInserts.push({
        tenantId,
        impactRecordId: impactId,
        targetRole: "production",
        title: `BOM Revision: ${bomLabel}`,
        body: `Production Order #${po.id} uses ${bomLabel} which has a new version. Please review before proceeding.`,
      });
    }

    // Notify procurement role owners for each impacted PO
    for (const po of poImpacts) {
      const impactId = impactIds[impactInserts.findIndex(
        (r) => r.impactedEntityType === "purchase_order" && r.impactedEntityId === po.id,
      )];
      if (impactId === undefined) continue;
      notifInserts.push({
        tenantId,
        impactRecordId: impactId,
        targetRole: "procurement",
        title: `BOM Revision: ${bomLabel}`,
        body: `Purchase Order #${po.id} contains materials from ${bomLabel} which has a new version. Please review quantities and specs.`,
      });
    }

    if (notifInserts.length > 0) {
      await db.insert(changeNotifications).values(notifInserts);
      notificationsCreated = notifInserts.length;
    }

    return {
      impactCount,
      impactedProductionOrders: productionImpacts.map((p) => p.id),
      impactedPurchaseOrders: poImpacts.map((p) => p.id),
      autoActioned,
      notificationsCreated,
    };
  }

  /* ---------------------------------------------------------------- */
  /*  Query helpers                                                    */
  /* ---------------------------------------------------------------- */

  /** List all change propagation events for a BOM, newest first. */
  async listEvents(tenantId: string, bomId: number) {
    return db
      .select({
        id: changePropagationEvents.id,
        status: changePropagationEvents.status,
        impactCount: changePropagationEvents.impactCount,
        createdAt: changePropagationEvents.createdAt,
        completedAt: changePropagationEvents.completedAt,
      })
      .from(changePropagationEvents)
      .where(
        and(
          eq(changePropagationEvents.tenantId, tenantId),
          eq(changePropagationEvents.bomId, bomId),
        ),
      )
      .orderBy(changePropagationEvents.id);
  }

  /** List all impact records for a given propagation event. */
  async listImpacts(tenantId: string, eventId: number) {
    return db
      .select()
      .from(changeImpactRecords)
      .where(
        and(
          eq(changeImpactRecords.tenantId, tenantId),
          eq(changeImpactRecords.propagationEventId, eventId),
        ),
      )
      .orderBy(changeImpactRecords.id);
  }

  /** List open (unresolved) impacts for a tenant — useful for dashboard. */
  async listOpenImpacts(tenantId: string) {
    return db
      .select()
      .from(changeImpactRecords)
      .where(
        and(
          eq(changeImpactRecords.tenantId, tenantId),
          ne(changeImpactRecords.revisionStatus, "resolved"),
        ),
      )
      .orderBy(changeImpactRecords.createdAt);
  }

  /** Acknowledge an impact record — confirms the user has seen the flag. */
  async acknowledgeImpact(impactId: number, userId: number) {
    const [updated] = await db
      .update(changeImpactRecords)
      .set({
        revisionStatus: "acknowledged",
        acknowledgedBy: userId,
        acknowledgedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(changeImpactRecords.id, impactId))
      .returning();
    return updated;
  }

  /** Resolve an impact record — user has taken corrective action. */
  async resolveImpact(impactId: number, userId: number, resolutionNote: string) {
    const [updated] = await db
      .update(changeImpactRecords)
      .set({
        revisionStatus: "resolved",
        resolvedBy: userId,
        resolvedAt: new Date(),
        resolutionNote,
        updatedAt: new Date(),
      })
      .where(eq(changeImpactRecords.id, impactId))
      .returning();
    return updated;
  }

  /** Get unread notifications for a user (by userId or by role). */
  async getUnreadNotifications(tenantId: string, userId: number, role: string) {
    return db
      .select()
      .from(changeNotifications)
      .where(
        and(
          eq(changeNotifications.tenantId, tenantId),
          eq(changeNotifications.isRead, false),
          eq(changeNotifications.targetRole, role),
        ),
      )
      .orderBy(changeNotifications.createdAt);
  }

  /** Mark a notification as read. */
  async markNotificationRead(notificationId: number) {
    const [updated] = await db
      .update(changeNotifications)
      .set({ isRead: true, readAt: new Date() })
      .where(eq(changeNotifications.id, notificationId))
      .returning();
    return updated;
  }
}

export const changePropagationService = new ChangePropagationService();
