import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/api";
import { workflowInstances, workflowTransitionLogs, workflowEvents } from "@/lib/db/schema";
import { workflowConfigRegistry } from "@/lib/workflow/config";
import { transitionValidator } from "@/lib/workflow/transition-validator";
import { eventDispatcher } from "@/lib/workflow/event-dispatcher";
import { versionManager } from "@/lib/workflow/version-manager";
import { authorizeWorkflowTransition } from "@/lib/rbac";
import type { CreateVersionInput, CreateWorkflowInput, TransitionStateInput } from "@/lib/workflow/types";

export class WorkflowService {
  async createWorkflow(input: CreateWorkflowInput) {
    const config = workflowConfigRegistry.get(input.entityType);

    const [existing] = await db
      .select()
      .from(workflowInstances)
      .where(
        and(
          eq(workflowInstances.tenantId, input.tenantId),
          eq(workflowInstances.entityType, input.entityType.toUpperCase()),
          eq(workflowInstances.entityId, input.entityId),
        ),
      )
      .limit(1);

    if (existing) return existing;

    const [created] = await db
      .insert(workflowInstances)
      .values({
        tenantId: input.tenantId,
        entityType: input.entityType.toUpperCase(),
        entityId: input.entityId,
        configVersion: config.version,
        currentState: config.initialState,
        createdBy: input.actorUserId,
        updatedBy: input.actorUserId,
      })
      .returning();

    await eventDispatcher.dispatch({
      tenantId: input.tenantId,
      workflowInstanceId: created.id,
      entityType: created.entityType,
      entityId: created.entityId,
      eventName: `${created.entityType.toLowerCase()}.workflow_created`,
      payload: { state: created.currentState },
    });

    return created;
  }

  async transitionState(input: TransitionStateInput) {
    const entityType = input.entityType.toUpperCase();

    const [instance] = await db
      .select()
      .from(workflowInstances)
      .where(
        and(
          eq(workflowInstances.tenantId, input.tenantId),
          eq(workflowInstances.entityType, entityType),
          eq(workflowInstances.entityId, input.entityId),
        ),
      )
      .limit(1);

    if (!instance) {
      throw new ApiError(404, `Workflow instance not found for ${entityType}#${input.entityId}`);
    }

    const config = workflowConfigRegistry.get(entityType);
    const transition = transitionValidator.validate(
      config,
      instance.currentState,
      input.action,
      input.userRole,
      input.comment,
    );

    await authorizeWorkflowTransition({
      tenantId: input.tenantId,
      workflowType: entityType,
      entityId: input.entityId,
      currentState: instance.currentState,
      actionCode: transition.action,
      targetState: transition.to,
      actorUserId: input.actorUserId,
      sessionRole: input.userRole,
      departmentId: input.departmentId,
    });

    return db.transaction(async (tx) => {
      const [updated] = await tx
        .update(workflowInstances)
        .set({
          currentState: transition.to,
          updatedBy: input.actorUserId,
          updatedAt: new Date(),
        })
        .where(eq(workflowInstances.id, instance.id))
        .returning();

      await tx.insert(workflowTransitionLogs).values({
        tenantId: input.tenantId,
        workflowInstanceId: instance.id,
        entityType,
        entityId: input.entityId,
        action: transition.action,
        fromState: instance.currentState,
        toState: transition.to,
        userRole: input.userRole,
        comment: input.comment ?? null,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
        triggeredBy: input.actorUserId,
      });

      const eventName = transition.eventName ?? `${entityType.toLowerCase()}.${transition.action}`;
      await tx.insert(workflowEvents).values({
        tenantId: input.tenantId,
        workflowInstanceId: instance.id,
        entityType,
        entityId: input.entityId,
        eventName,
        payload: JSON.stringify({
          action: transition.action,
          fromState: instance.currentState,
          toState: transition.to,
          metadata: input.metadata ?? null,
        }),
        status: "pending",
      });

      let createdVersion: Awaited<ReturnType<VersionManager["createVersion"]>> | null = null;
      if (transition.createVersion) {
        createdVersion = await versionManager.createVersion({
          tenantId: input.tenantId,
          entityType,
          entityId: input.entityId,
          actorUserId: input.actorUserId,
          snapshot: {
            state: transition.to,
            action: transition.action,
            metadata: input.metadata ?? null,
          },
        });
      }

      return {
        workflow: updated,
        transition: {
          action: transition.action,
          fromState: instance.currentState,
          toState: transition.to,
          eventName,
        },
        createdVersion,
      };
    });
  }

  async createVersion(input: CreateVersionInput) {
    return versionManager.createVersion({
      tenantId: input.tenantId,
      entityType: input.entityType.toUpperCase(),
      entityId: input.entityId,
      actorUserId: input.actorUserId,
      snapshot: input.snapshot,
    });
  }

  async getWorkflowHistory(tenantId: string, entityType: string, entityId: number) {
    const normalizedEntityType = entityType.toUpperCase();

    const [instance] = await db
      .select()
      .from(workflowInstances)
      .where(
        and(
          eq(workflowInstances.tenantId, tenantId),
          eq(workflowInstances.entityType, normalizedEntityType),
          eq(workflowInstances.entityId, entityId),
        ),
      )
      .limit(1);

    if (!instance) {
      throw new ApiError(404, `Workflow instance not found for ${normalizedEntityType}#${entityId}`);
    }

    const transitions = await db
      .select()
      .from(workflowTransitionLogs)
      .where(eq(workflowTransitionLogs.workflowInstanceId, instance.id))
      .orderBy(desc(workflowTransitionLogs.createdAt));

    const versions = await versionManager.listVersions(tenantId, normalizedEntityType, entityId);

    const events = await db
      .select()
      .from(workflowEvents)
      .where(eq(workflowEvents.workflowInstanceId, instance.id))
      .orderBy(desc(workflowEvents.createdAt));

    return {
      instance,
      transitions,
      versions,
      events,
    };
  }
}

type VersionManager = typeof versionManager;

export const workflowService = new WorkflowService();
