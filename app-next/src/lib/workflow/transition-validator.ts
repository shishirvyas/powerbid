import { ApiError } from "@/lib/api";
import type { WorkflowConfig, WorkflowTransitionConfig } from "@/lib/workflow/types";

export class TransitionValidator {
  validate(config: WorkflowConfig, currentState: string, action: string, userRole: string, comment?: string): WorkflowTransitionConfig {
    const role = userRole.trim().toLowerCase();
    const transition = config.transitions.find(
      (candidate) =>
        candidate.action === action &&
        candidate.from.includes(currentState),
    );

    if (!transition) {
      throw new ApiError(409, `Invalid transition: action '${action}' not allowed from state '${currentState}'`);
    }

    const allowed = transition.allowedRoles.map((r) => r.toLowerCase());
    if (!allowed.includes(role)) {
      throw new ApiError(403, `Role '${userRole}' is not allowed to execute action '${action}'`);
    }

    if (transition.requireComment && (!comment || comment.trim().length === 0)) {
      throw new ApiError(400, `Comment is required for action '${action}'`);
    }

    if (!config.states.includes(transition.to)) {
      throw new ApiError(500, `Workflow config error: target state '${transition.to}' not defined`);
    }

    return transition;
  }
}

export const transitionValidator = new TransitionValidator();
