export { workflowService, WorkflowService } from "@/lib/workflow/workflow-service";
export { transitionValidator, TransitionValidator } from "@/lib/workflow/transition-validator";
export { eventDispatcher, EventDispatcher } from "@/lib/workflow/event-dispatcher";
export { versionManager, VersionManager } from "@/lib/workflow/version-manager";
export { workflowConfigRegistry, WorkflowConfigRegistry } from "@/lib/workflow/config";
export type {
  WorkflowConfig,
  WorkflowEntityType,
  WorkflowTransitionConfig,
  CreateWorkflowInput,
  TransitionStateInput,
  CreateVersionInput,
} from "@/lib/workflow/types";
