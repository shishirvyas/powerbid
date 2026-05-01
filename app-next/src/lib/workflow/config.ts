import { ApiError } from "@/lib/api";
import type { WorkflowConfig } from "@/lib/workflow/types";

const defaultConfigs: Record<string, WorkflowConfig> = {
  ORDER: {
    entityType: "ORDER",
    version: 1,
    initialState: "DRAFT",
    terminalStates: ["COMPLETED", "CANCELLED"],
    states: [
      "DRAFT",
      "SUBMITTED",
      "SALES_APPROVED",
      "PROCUREMENT_READY",
      "PRODUCTION_READY",
      "IN_PRODUCTION",
      "COMPLETED",
      "ON_HOLD",
      "CANCELLED",
    ],
    transitions: [
      { action: "submit", from: ["DRAFT"], to: "SUBMITTED", allowedRoles: ["sales", "admin"], eventName: "order.submitted" },
      { action: "approve_sales", from: ["SUBMITTED"], to: "SALES_APPROVED", allowedRoles: ["sales", "admin"], eventName: "order.sales_approved" },
      {
        action: "prepare_procurement",
        from: ["SALES_APPROVED"],
        to: "PROCUREMENT_READY",
        allowedRoles: ["procurement", "admin"],
        eventName: "order.procurement_ready",
      },
      {
        action: "prepare_production",
        from: ["PROCUREMENT_READY"],
        to: "PRODUCTION_READY",
        allowedRoles: ["production", "admin"],
        eventName: "order.production_ready",
      },
      {
        action: "start_production",
        from: ["PRODUCTION_READY"],
        to: "IN_PRODUCTION",
        allowedRoles: ["production", "admin"],
        eventName: "order.production_started",
      },
      { action: "complete", from: ["IN_PRODUCTION"], to: "COMPLETED", allowedRoles: ["production", "admin"], eventName: "order.completed" },
      {
        action: "hold",
        from: ["DRAFT", "SUBMITTED", "SALES_APPROVED", "PROCUREMENT_READY", "PRODUCTION_READY", "IN_PRODUCTION"],
        to: "ON_HOLD",
        allowedRoles: ["sales", "procurement", "production", "admin"],
        eventName: "order.hold",
        requireComment: true,
      },
      {
        action: "resume",
        from: ["ON_HOLD"],
        to: "SUBMITTED",
        allowedRoles: ["sales", "procurement", "production", "admin"],
        eventName: "order.resumed",
      },
      {
        action: "cancel",
        from: ["DRAFT", "SUBMITTED", "SALES_APPROVED", "PROCUREMENT_READY", "PRODUCTION_READY", "IN_PRODUCTION", "ON_HOLD"],
        to: "CANCELLED",
        allowedRoles: ["sales", "procurement", "production", "admin"],
        eventName: "order.cancelled",
        requireComment: true,
      },
    ],
  },
  BOM: {
    entityType: "BOM",
    version: 1,
    initialState: "DRAFT",
    terminalStates: ["RELEASED", "CANCELLED", "SUPERSEDED"],
    states: ["DRAFT", "UNDER_REVIEW", "APPROVED", "RELEASED", "SUPERSEDED", "ON_HOLD", "CANCELLED"],
    transitions: [
      { action: "submit", from: ["DRAFT"], to: "UNDER_REVIEW", allowedRoles: ["production", "admin"], eventName: "bom.submitted" },
      { action: "approve", from: ["UNDER_REVIEW"], to: "APPROVED", allowedRoles: ["production", "admin"], eventName: "bom.approved" },
      {
        action: "release",
        from: ["APPROVED"],
        to: "RELEASED",
        allowedRoles: ["production", "admin"],
        eventName: "bom.released",
        createVersion: true,
      },
      {
        action: "supersede",
        from: ["RELEASED"],
        to: "SUPERSEDED",
        allowedRoles: ["production", "admin"],
        eventName: "bom.superseded",
        requireComment: true,
      },
      {
        action: "hold",
        from: ["DRAFT", "UNDER_REVIEW", "APPROVED", "RELEASED"],
        to: "ON_HOLD",
        allowedRoles: ["production", "admin"],
        eventName: "bom.hold",
        requireComment: true,
      },
      {
        action: "resume",
        from: ["ON_HOLD"],
        to: "UNDER_REVIEW",
        allowedRoles: ["production", "admin"],
        eventName: "bom.resumed",
      },
      {
        action: "cancel",
        from: ["DRAFT", "UNDER_REVIEW", "APPROVED", "ON_HOLD"],
        to: "CANCELLED",
        allowedRoles: ["production", "admin"],
        eventName: "bom.cancelled",
        requireComment: true,
      },
    ],
  },
  PO: {
    entityType: "PO",
    version: 1,
    initialState: "DRAFT",
    terminalStates: ["CLOSED", "CANCELLED"],
    states: ["DRAFT", "SUBMITTED", "APPROVED", "ISSUED", "PARTIAL_RECEIPT", "CLOSED", "ON_HOLD", "CANCELLED"],
    transitions: [
      { action: "submit", from: ["DRAFT"], to: "SUBMITTED", allowedRoles: ["procurement", "admin"], eventName: "po.submitted" },
      { action: "approve", from: ["SUBMITTED"], to: "APPROVED", allowedRoles: ["procurement", "admin"], eventName: "po.approved" },
      { action: "issue", from: ["APPROVED"], to: "ISSUED", allowedRoles: ["procurement", "admin"], eventName: "po.issued" },
      {
        action: "partial_receive",
        from: ["ISSUED"],
        to: "PARTIAL_RECEIPT",
        allowedRoles: ["procurement", "stores", "admin"],
        eventName: "po.partial_received",
      },
      {
        action: "close",
        from: ["ISSUED", "PARTIAL_RECEIPT"],
        to: "CLOSED",
        allowedRoles: ["procurement", "admin"],
        eventName: "po.closed",
      },
      {
        action: "hold",
        from: ["DRAFT", "SUBMITTED", "APPROVED", "ISSUED", "PARTIAL_RECEIPT"],
        to: "ON_HOLD",
        allowedRoles: ["procurement", "admin"],
        eventName: "po.hold",
        requireComment: true,
      },
      {
        action: "resume",
        from: ["ON_HOLD"],
        to: "SUBMITTED",
        allowedRoles: ["procurement", "admin"],
        eventName: "po.resumed",
      },
      {
        action: "cancel",
        from: ["DRAFT", "SUBMITTED", "APPROVED", "ISSUED", "PARTIAL_RECEIPT", "ON_HOLD"],
        to: "CANCELLED",
        allowedRoles: ["procurement", "admin"],
        eventName: "po.cancelled",
        requireComment: true,
      },
    ],
  },
};

function parseEnvConfigs(): Record<string, WorkflowConfig> {
  const raw = process.env.WORKFLOW_CONFIG_JSON;
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, WorkflowConfig>;
    const normalized: Record<string, WorkflowConfig> = {};
    for (const [key, value] of Object.entries(parsed)) {
      normalized[key.toUpperCase()] = value;
    }
    return normalized;
  } catch {
    throw new ApiError(500, "Invalid WORKFLOW_CONFIG_JSON");
  }
}

export class WorkflowConfigRegistry {
  private readonly configs: Record<string, WorkflowConfig>;

  constructor(configs: Record<string, WorkflowConfig> = defaultConfigs) {
    this.configs = {
      ...configs,
      ...parseEnvConfigs(),
    };
  }

  get(entityType: string): WorkflowConfig {
    const key = entityType.trim().toUpperCase();
    const config = this.configs[key];
    if (!config) {
      throw new ApiError(400, `Workflow config not found for entity type: ${entityType}`);
    }
    return config;
  }
}

export const workflowConfigRegistry = new WorkflowConfigRegistry();
