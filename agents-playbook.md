# PowerBid Multi-Agent Delivery Playbook

Last updated: 2026-05-01

## Objective
Define execution ownership for seven delivery agents so architecture, implementation, security, and UI ship as a coordinated system.

## Agent Lineup

### 1. Architect Agent
- Mission:
  - Own target architecture for modular monolith workflow platform.
  - Define bounded contexts and cross-module contracts.
- Inputs:
  - Product goals
  - Existing module map (Inquiry, BOM, PO, SO, Reports)
- Outputs:
  - System blueprint
  - Module boundaries
  - Integration contract versioning rules
- Exit criteria:
  - All downstream agents have stable interface contracts.

### 2. Workflow Engine Agent
- Mission:
  - Implement state machine runtime and transition execution model.
- Inputs:
  - Workflow config definitions
  - Role and transition policy contracts
- Outputs:
  - Workflow service
  - Transition validator
  - Event publication points
  - History API
- Exit criteria:
  - State transitions are config-driven and audit-safe.

### 3. Versioning Agent
- Mission:
  - Build immutable BOM and Order version management.
- Inputs:
  - Version schema and active pointer rules
  - Workflow trigger hooks
- Outputs:
  - Version creation flow
  - Active version resolver
  - Delta engine output
- Exit criteria:
  - Procurement always resolves active version for new actions.

### 4. Change Propagation Agent
- Mission:
  - Detect and propagate impact when upstream version/state changes occur.
- Inputs:
  - Version delta payload
  - Dependency graph metadata
- Outputs:
  - Impact analyzer
  - Needs Revision marker
  - Policy-based auto-actions (example: invalidate RFQ)
- Exit criteria:
  - Impacted records are consistently flagged and traceable.

### 5. RBAC Agent
- Mission:
  - Enforce workflow-aware authorization at state and action levels.
- Inputs:
  - Role schema
  - Permission matrix
  - Department and tenant scopes
- Outputs:
  - Authorization middleware
  - Decision audit logs
  - Deny-over-allow evaluator
- Exit criteria:
  - Unauthorized transitions are blocked with deterministic reasons.

### 6. Integration Agent
- Mission:
  - Orchestrate cross-agent wiring and event contract compatibility.
- Inputs:
  - APIs and event payload schemas from all agents
- Outputs:
  - Integration test suite
  - Contract checks
  - End-to-end workflow orchestration validation
- Exit criteria:
  - Cross-module flows pass without manual patching.

### 7. UI Builder Agent
- Mission:
  - Deliver Workflow Builder UX (graph designer + configuration panels + preview).
- Inputs:
  - Workflow and RBAC contract metadata
  - Trigger and guard schemas
- Outputs:
  - Workflow Designer
  - Role Mapping panel
  - Transition Config panel
  - Preview and export/import shell
- Exit criteria:
  - Non-technical users can model workflows without code changes.

## Handoff Contract (Agent to Agent)
- Required package per handoff:
  - Versioned interface definition
  - Success/failure semantics
  - Example payloads
  - Validation rules
- Ownership transfer rule:
  - Upstream agent remains accountable for contract stability until accepted by downstream owner.
- Breaking change rule:
  - Any breaking contract change requires Architect Agent approval and Integration Agent regression pass.

## Delivery Sequence
1. Architect Agent
2. Workflow Engine Agent and Versioning Agent (parallel)
3. Change Propagation Agent and RBAC Agent (parallel)
4. Integration Agent
5. UI Builder Agent (can start earlier with mocked contracts, final sign-off after integration)

## Definition of Done
- Functional:
  - Workflow transitions, versioning, propagation, and RBAC checks work together.
- Operational:
  - Full auditability for transition, authorization, and auto-action decisions.
- Product:
  - Workflow Builder exposes all config-driven controls required for operations teams.
