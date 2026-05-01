import { z } from "zod";

const jsonRecord = z.record(z.any()).optional();

export const createWorkflowSchema = z.object({
  tenantId: z.string().trim().min(1).optional().default("default"),
  entityType: z.string().trim().min(1),
  entityId: z.coerce.number().int().positive(),
});

export const transitionStateSchema = z.object({
  tenantId: z.string().trim().min(1).optional().default("default"),
  action: z.string().trim().min(1),
  userRole: z.string().trim().min(1).optional(),
  comment: z.string().trim().max(1000).optional(),
  metadata: jsonRecord,
});

export const createVersionSchema = z.object({
  tenantId: z.string().trim().min(1).optional().default("default"),
  snapshot: jsonRecord,
});
