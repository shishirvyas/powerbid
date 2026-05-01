import { db } from "@/lib/db";
import { workflowEvents } from "@/lib/db/schema";

type DispatchEventInput = {
  tenantId: string;
  workflowInstanceId: number;
  entityType: string;
  entityId: number;
  eventName: string;
  payload?: Record<string, unknown>;
};

export class EventDispatcher {
  async dispatch(input: DispatchEventInput) {
    const [event] = await db
      .insert(workflowEvents)
      .values({
        tenantId: input.tenantId,
        workflowInstanceId: input.workflowInstanceId,
        entityType: input.entityType,
        entityId: input.entityId,
        eventName: input.eventName,
        payload: input.payload ? JSON.stringify(input.payload) : null,
        status: "pending",
      })
      .returning();

    return event;
  }
}

export const eventDispatcher = new EventDispatcher();
