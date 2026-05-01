export type WorkflowEntityType = string;

export type WorkflowTransitionConfig = {
  action: string;
  from: string[];
  to: string;
  allowedRoles: string[];
  eventName?: string;
  requireComment?: boolean;
  createVersion?: boolean;
};

export type WorkflowConfig = {
  entityType: WorkflowEntityType;
  version: number;
  initialState: string;
  terminalStates?: string[];
  states: string[];
  transitions: WorkflowTransitionConfig[];
};

export type CreateWorkflowInput = {
  tenantId: string;
  entityType: WorkflowEntityType;
  entityId: number;
  actorUserId?: number;
};

export type TransitionStateInput = {
  tenantId: string;
  entityType: WorkflowEntityType;
  entityId: number;
  action: string;
  userRole: string;
  actorUserId?: number;
  departmentId?: number;
  comment?: string;
  metadata?: Record<string, unknown>;
};

export type CreateVersionInput = {
  tenantId: string;
  entityType: WorkflowEntityType;
  entityId: number;
  actorUserId?: number;
  snapshot?: Record<string, unknown>;
};
