# PowerBid Feature Guide

Last updated: 2026-05-03 (SO detail edit, BOM SO context panel)
Owner: GitHub Copilot (with developer updates)

## Purpose
This document explains product features in simple terms so product, development, and testing teams can quickly understand:
- What each feature does
- Where it lives in the app
- Main workflows
- Key rules/validations
- What to test

## Update Rule
Update this file whenever a feature is:
- Added
- Changed
- Removed

Also update the `Last updated` date and add a short entry to the change log section.

## Feature Inventory

### Authentication
- Status: Active
- Area: App access and user session management
- User value: Protects application data and controls who can use business modules.
- Key flows:
  - Sign in and sign out
  - Session/middleware checks
- Main locations:
  - `app-next/src/app/(auth)/`
  - `app-next/src/middleware.ts`
- What to test:
  - Valid/invalid login behavior
  - Route protection and redirect behavior
  - Session expiration handling

### Dashboard
- Status: Active
- Area: Operations overview and analytics
- User value: Gives quick visibility into business activity.
- Main locations:
  - `app-next/src/app/(app)/dashboard/`
  - `app-next/src/lib/dashboard/`
- What to test:
  - Widgets load with expected values
  - Date/range filters update metrics correctly
  - Loading and empty states

### Master Data
- Status: Active
- Area: Core reference records
- Includes:
  - Customers
  - Suppliers
  - Products
  - Stock items
  - BOMs
  - Subject templates
- Main locations:
  - `app-next/src/app/(app)/customers/`
  - `app-next/src/app/(app)/suppliers/`
  - `app-next/src/app/(app)/products/`
  - `app-next/src/app/(app)/stock-items/`
  - `app-next/src/app/(app)/boms/`
  - `app-next/src/app/(app)/subject-templates/`
- What to test:
  - Create, edit, delete, list, search
  - Duplicate and validation rules
  - Table filters and pagination

### Inquiry to Quotation Flow
- Status: Active
- Area: Sales pre-order lifecycle
- User value: Converts customer inquiry into a formal quotation.
- Includes:
  - Inquiries
  - Quotations
  - Quotation templates and formats
- Main locations:
  - `app-next/src/app/(app)/inquiries/`
  - `app-next/src/app/(app)/quotations/`
  - `app-next/src/lib/quotation-templates.ts`
  - `app-next/src/lib/quotation-format.ts`
  - `app-next/src/lib/quotation-reference.ts`
- What to test:
  - Inquiry creation and item details
  - Quotation generation from inquiry data
  - Template/format correctness and reference numbering

### Purchase and Production
- Status: Active
- Area: Procurement and manufacturing execution
- Includes:
  - Purchase orders
  - Production orders
- Main locations:
  - `app-next/src/app/(app)/purchase-orders/`
  - `app-next/src/app/(app)/production-orders/`
- What to test:
  - Order lifecycle status changes
  - Quantity/price calculations
  - Validation on required fields

### Sales and Dispatch
- Status: Active
- Area: Order fulfillment and logistics
- Includes:
  - Sales orders
  - Dispatch tracking/logs
- Main locations:
  - `app-next/src/app/(app)/sales-orders/`
  - DB migrations related to dispatch in `app-next/drizzle/`
- What to test:
  - Sales order creation and updates
  - Dispatch status transitions
  - Related report values

### Reports
- Status: Active
- Area: Business reporting
- Main locations:
  - `app-next/src/app/(app)/reports/`
- What to test:
  - Report accuracy
  - Filter behavior
  - Export/print behavior (if enabled)

### Attachments and Documents
- Status: Active
- Area: File handling and previews
- User value: Supports quotation attachments and document workflows.
- Main locations:
  - `app-next/src/components/attachments-panel.tsx`
  - `app-next/src/components/pdf-preview-dialog.tsx`
  - `app-next/storage/quotation-attachments/`
- What to test:
  - Upload/download/view flows
  - File type and size validations
  - Data-link integrity to records

### Communication and Templates
- Status: Active
- Area: Message templates and communication helpers
- Main locations:
  - `app-next/src/lib/communication.ts`
  - DB migrations related to templates in `app-next/drizzle/`
- What to test:
  - Template save/edit/use behavior
  - Rendering of dynamic content placeholders

### Settings
- Status: Active
- Area: App-level configuration
- Main locations:
  - `app-next/src/app/(app)/settings/`
- What to test:
  - Save and persist settings
  - Validation and access control

### Workflow Engine
- Status: Active (Backend + UI Designer)
- Area: Cross-module process orchestration
- User value: Converts form-only operations into controlled, auditable workflows across Sales, Procurement, and Production.
- Includes:
  - State machine-based process execution
  - Multi-department handoff and approvals
  - BOM revision/version governance
  - Change propagation rules across order and procurement artifacts
  - Hold and cancel controls with reason tracking
- Main locations:
  - `app-next/src/lib/workflow/`
  - `app-next/src/app/api/workflow/`
  - Workflow tables in `app-next/src/lib/db/schema.ts`
  - `app-next/src/app/(app)/workflow-builder/page.tsx`
  - `app-next/src/components/workflow-builder/`
  - `app-next/src/lib/workflow-builder-store.ts`
- What to test:
  - Valid and invalid state transitions
  - Role-based transition permissions
  - BOM revision effects on downstream procurement/production
  - Hold/release/cancel behavior with full auditability
  - Event delivery and idempotent transition handling

#### Versioning Model (BOM and Orders)
- Status: Active (Backend)
- Scope:
  - Immutable version records for BOM and Order entities via `entity_versions` table
  - Active version pointer per entity via `entity_version_sets` (current_version_id)
  - Delta comparison between consecutive versions stored in `entity_version_deltas`
  - Procurement version locking in `procurement_version_locks` (which version procurement resolved against)
  - Full audit trail in `version_audit_log`
- API endpoints:
  - `GET /api/versioning/[entityType]/[entityId]` — list all versions (newest first)
  - `POST /api/versioning/[entityType]/[entityId]` — create new version snapshot
  - `GET /api/versioning/[entityType]/[entityId]/current` — get active version with parsed snapshot
  - `GET/POST /api/versioning/[entityType]/[entityId]/lock` — read/write procurement version lock
- Rules:
  - Procurement must resolve material/planning data from active version only
  - Previous versions remain queryable for audit and traceability
  - Version promotion and deactivation are transactional
- What to test:
  - New version creation never mutates prior snapshots
  - Active version pointer changes atomically
  - Delta output correctly reports added/removed/changed fields and line items
  - Procurement resolution always matches active version at action time

#### Change Propagation (BOM to Downstream)
- Status: Active (Backend)
- Scenario:
  - BOM changes after procurement has already started
- System behavior:
  - Detect impacted downstream records (production orders via direct bomId FK, purchase orders via raw material product overlap)
  - Create `change_impact_records` with `needs_revision` status for each impacted record
  - Auto-flag draft records with `auto_actioned` status and detail annotation
  - In-flight records (approved/sent/in_progress) require human acknowledgement or resolution
  - Emit `change_notifications` to relevant role owners (production / procurement)
- DB tables:
  - `change_propagation_events` — one per BOM version change trigger, tracks run status
  - `change_impact_records` — one per impacted entity, tracks revision/ack/resolve lifecycle
  - `change_notifications` — role-targeted notification queue, read/unread status
- API endpoints:
  - `POST /api/change-propagation/propagate` — trigger propagation for a BOM change
  - `GET /api/change-propagation/bom/[bomId]/events` — list propagation events for a BOM
  - `GET /api/change-propagation/events/[eventId]/impacts` — list impact records for an event
  - `GET /api/change-propagation/open-impacts` — list all unresolved impacts (dashboard use)
  - `PATCH /api/change-propagation/impacts/[impactId]` — acknowledge or resolve an impact
  - `GET /api/change-propagation/notifications` — unread notifications by role
  - `POST /api/change-propagation/notifications` — mark notification as read
- What to test:
  - Correct impact detection for active and in-flight documents
  - No false positives for unrelated products or superseded records
  - Needs Revision flags are set idempotently per event
  - Role-based notifications reach target owners
  - Auto-actions respect policy and audit trail requirements
  - Acknowledge / resolve lifecycle transitions work correctly

#### RBAC Integrated with Workflow States
- Status: Active (Backend Enforcement + Seeded)
- Scope:
  - Role-based access to states and transitions
  - Action-level permission control per workflow transition
  - Multi-department data and action isolation
  - Default roles seeded: admin, sales, procurement, production, stores, qa
  - Default departments seeded: SALES, PROCUREMENT, PRODUCTION, QA
  - Full permission matrix seeded for ORDER/BOM/PO workflow transitions
- RBAC_STRICT_MODE env var: when `true`, no-policy fallback becomes deny (safe for production)
- Admin bootstrap endpoint: `POST /api/admin/rbac/seed` (admin role required)
- Core rules:
  - State visibility and transition execution are evaluated separately
  - Transition permission = role policy + department scope + tenant scope + optional guard condition
  - Example policy: only Procurement can execute BOM Approved -> RFQ transitions
  - Every authorization decision is audit-logged with actor, role, department, action, and outcome
- What to test:
  - Unauthorized roles cannot execute restricted transitions
  - Cross-department access is denied when outside scope
  - Action-level overrides (allow/deny) work as expected
  - Audit logs capture allow and deny decisions consistently
  - RBAC_STRICT_MODE=true denies transitions with no matching policy

## Cross-Cutting Behavior

### RBAC / Authorization
- Confirm role-based visibility and action permissions on all modules.

### Validation Rules
- Keep field-level and business-rule validations consistent across create/edit screens and APIs.

### API and Data Contracts
- Ensure frontend forms, API schemas, and DB schema remain aligned.

### Performance and UX
- Confirm loading states, pagination, and route transitions on large datasets.

## Change Log
- 2026-05-01: Initial `features.md` created with baseline feature inventory and testing focus points.
- 2026-05-01: Added planned Workflow Engine feature section for order, BOM, and procurement lifecycle orchestration.
- 2026-05-01: Implemented config-driven Workflow Engine backend module and APIs (create workflow, transition, versioning, history).
- 2026-05-01: Added BOM and Order versioning system design guidance (immutability, active tracking, and delta comparison).
- 2026-05-01: Added Change Propagation system design for BOM updates after procurement start (impact detection, revision flags, notifications, and auto-actions).
- 2026-05-01: Added Workflow Builder UI using React Flow + Zustand with designer canvas, role mapping, transition configuration, and workflow preview panels.
- 2026-05-01: Added RBAC design integrated with workflow states, transition permissions, and multi-department isolation.
- 2026-05-01: Added multi-agent delivery playbook defining Architect, Workflow Engine, Versioning, Change Propagation, RBAC, Integration, and UI Builder agent responsibilities.
- 2026-05-01: Implemented RBAC workflow transition enforcement service with policy evaluation, department scope checks, and authorization decision audit logging.
- 2026-05-02: Implemented RBAC seed bootstrap: default roles (admin/sales/procurement/production/stores/qa), departments, and full ORDER/BOM/PO permission matrix. Added RBAC_STRICT_MODE env flag. Admin endpoint: POST /api/admin/rbac/seed.
- 2026-05-02: Implemented Entity Versioning backend: 5 DB tables (entity_version_sets, entity_versions, entity_version_deltas, procurement_version_locks, version_audit_log), EntityVersioningService with transactional version creation, delta computation, procurement locks, and audit trail. REST API endpoints at /api/versioning/[entityType]/[entityId].
- 2026-05-02: Implemented Change Propagation backend: 3 DB tables (change_propagation_events, change_impact_records, change_notifications), ChangePropagationService with BOM impact analysis (production orders via bomId, POs via raw material overlap), auto-flagging of draft records, role-targeted notifications, and acknowledge/resolve lifecycle. REST API endpoints at /api/change-propagation/.
- 2026-05-02: Wired frontend end-to-end: BOM save auto-versions + triggers propagation; Dashboard open-impacts widget with inline Acknowledge; Topbar notification bell with 30s polling and mark-read.
- 2026-05-02: Added Flow Guide page at /flow-guide — interactive step-by-step demo guide with live API health checks, architecture diagram, runnable steps (seed RBAC → create BOM → snapshot version → propagate → view impacts → acknowledge → check notifications), full API reference table, and buyer feature checklist. Linked from sidebar under Analytics.
- 2026-05-02: Added offline-first local data layer (Dexie.js + nanoid) under `app-next/src/lib/offline/` for `inquiries`, `quotations`, `salesOrders`. Records carry `id`, `serverId`, `isSynced`, `lastModified`, `syncStatus` (`draft`/`pending`/`synced`/`error`). Repos perform optimistic local writes and atomically enqueue mutations into a transactional `outbox` queue with create/update/delete coalescing. The outbox is the only path to the server — components must not call APIs directly for these entities.
- 2026-05-02: Added background sync engine (`sync-engine.ts` + `SyncProvider`/`useSyncStatus`). Drains the outbox serially via existing REST endpoints (`/api/inquiries`, `/api/quotations`, `/api/sales-orders`), reconciles `serverId`, flips `syncStatus` to `synced`, and removes queue items on success. Failures retry with exponential backoff (1s → 5min cap, max 8 attempts); 4xx (except 408/429) are treated as permanent and parked for manual retry. Auto-resumes on `online` and `visibilitychange` events plus a 15s ticker. Single-flight loop, idempotent `kickSync()`, manual `retryItem`/`retryAll` for parked items.
- 2026-05-02: Added offline-first Quotation Entry form (`quotations/quotation-entry-offline.tsx`) with Tally-style dense single-page layout, per-row memoized line items, narrow Zustand selectors (no global re-renders), keyboard-first UX (Enter to advance fields, Ctrl/Cmd+S to save, Esc to reset). Save writes only to IndexedDB via `quotationsRepo`, never awaits the network, and triggers `kickSync()` fire-and-forget. Live `SyncStatusBadge` (Draft/Syncing/Synced/Error) reads from Dexie via `useLiveQuery` so the badge updates the instant the sync engine reconciles `serverId`.
- 2026-05-02: Added professional sync status UI system: CSS-variable-driven palette in `globals.css` (`--sync-{state}-{fg,bg,dot}` for light + dark), `.sync-badge` / `.sync-retry-btn` component classes with reduced-motion-aware pulse, and three React components in `sync-status-badge.tsx` — `<SyncStatusBadge>` (table cell pill, supports `iconOnly` + `size="lg"`), `<SyncRetryButton>` (icon/text variants, calls `retryItem`), and `<SyncStatusInline>` (form-header badge + auto-resolved retry button + tooltip). Quotation form header now uses the inline variant.
- 2026-05-02: Added zero-dependency keyboard system in `lib/hooks/use-keyboard.ts`: `useFormKeys(ref)` wires Enter/Shift+Enter precise field traversal (DOM-order over `[data-field="true"]`, with `data-field-skip` opt-out), Ctrl/Cmd+S save, Esc cancel, and Tally-style "Enter past last field commits"; `useShortcuts(map)` registers global combos with platform-aware `mod` (Cmd/Ctrl), input-field filtering (function keys + modifier chords pass through), and combo parsing (`alt+q`, `mod+shift+s`, `f1`). Quotation form refactored to use these hooks (no more inline keydown handlers). New `<AppShortcuts/>` mounted in `(app)/layout.tsx` registers `Alt+Q` (new quotation), `Alt+I` (inquiry), `Alt+S` (sales order), `Alt+C` (customer), `Alt+D` (dashboard), `Mod+Shift+S` (force sync), `F1` (flow guide). `SyncProvider` is now active on every authenticated route.
- 2026-05-02: Outbox upgraded to a typed action queue (Dexie schema bumped to v2; existing rows migrated in-place). Each `OutboxItem` now carries an explicit `type` (`CREATE_QUOTATION`, `UPDATE_INQUIRY`, `DELETE_SALES_ORDER`, …), a `status` lifecycle (`pending` → `in_flight` → `synced`/`failed`/`parked`), an `idempotencyKey` (sent as the `Idempotency-Key` HTTP header on every retry so the server can dedupe partial deliveries), and an `updatedAt` timestamp. Sync engine sets `in_flight` before each request to prevent concurrent drains from picking the same item, parks items after `MAX_ATTEMPTS=8` or any 4xx (except 408/429), and exposes the action type via the `X-Action-Type` header for server-side audit logging. UI counters (`pendingCount`, `errorCount`) now read from the `status` index, not from `attempts`.
- 2026-05-02: Workbench shell layout. Replaced the loose `<main>` wrapper with a fixed-height 3-row grid (`<Workbench>` in `components/workbench.tsx`): sticky 36px toolbar (auto breadcrumb from the route + slot for page actions), scrolling 8px-padded body, and a sticky 24px status bar (`<StatusBar>`) showing live sync state (online/offline dot, pending count, last-synced relative time, last error, version). Sidebar tightened to 12px font, 28px rows, 36px brand strip; new `Ctrl/Cmd+B` toggles a 44px icon-only mode (`SidebarCollapseController` flips `data-sidebar-collapsed` on `<html>`; pure CSS reflows the grid). Added `.wb-table` (sticky header, 28px rows, zebra+hover), `.wb-form` (label-left grid, 28px controls), and `.wb-section` primitives in `globals.css` for instant ERP-density pages. Route transition shortened to 140ms fade and gated by `prefers-reduced-motion`.
- 2026-05-02: Robust online/offline detection and transient indicator. Sync engine no longer trusts `navigator.onLine` alone — confirms reachability with a throttled `HEAD /api/health` probe (4s timeout, 5s minimum gap) before flipping `state.online` to `true`. The probe also runs on the 15s tick so silent disconnects (Wi-Fi drop without `offline` event, laptop wake from sleep) are caught. New `/api/health` route is a public, cache-busted no-body 200. New `<OfflineToast/>` component (mounted in `(app)/layout.tsx`) shows a small bottom-right pill only on state transitions: `Working offline` (sticky while disconnected) → `Back online · syncing N changes` → `All changes synced` (auto-hides after 2s). Persistent state remains in the status bar; the toast is purely transitional and respects `aria-live="polite"`.
- 2026-05-02: Added persistent API idempotency middleware for mutation endpoints. New DB table `api_idempotency` (migration `0011_api_idempotency.sql`) stores `(user_id, method, path, key)` with a unique index, request fingerprint hash, action type, and cached response payload/status. New helper `runIdempotentMutation()` in `lib/idempotency.ts` now wraps POST/PUT/DELETE handlers for inquiries, quotations, and sales orders. Behavior: first request inserts `processing`, executes mutation, then persists `completed` with response; duplicate retries with the same key replay the original response and set `X-Idempotent-Replay: true`; same key with different payload returns 409; concurrent duplicate in-flight requests return 409. This closes duplicate-submission holes for offline retries and flaky-network timeouts.
- 2026-05-02: Fixed dashboard crash caused by `useSyncExternalStore` snapshot identity churn. `getSyncSnapshot()` in `lib/offline/sync-engine.ts` now returns a cached immutable snapshot reference, refreshed only on `emit()`, which removes the React warning: "The result of getServerSnapshot should be cached to avoid an infinite loop" and stabilizes `useSyncStatus()` consumers (`StatusBar`, `Workbench`, app layout).
- 2026-05-03: Added SWR-style in-memory cache to `useList` and `useResource` hooks (30s TTL, stale-while-revalidate, request deduplication). Components now seed state from cache instantly on mount — loading skeletons only appear on first fetch, not revisits. `refresh()` invalidates the cache entry before refetching. Added `invalidateCache(prefix)` utility for post-mutation invalidation. Added `jsonList()` helper to `lib/api.ts` that adds `Cache-Control: private, max-age=10, stale-while-revalidate=30` headers; all 12 list GET routes now use it for browser-level HTTP caching.
- 2026-05-03: Added Edit button and dialog to Sales Order detail page (`/sales-orders/[id]`). Edit is available for orders in `draft` or `confirmed` status. Dialog pre-fills all fields (order date, customer, notes, line items) and calls `PUT /api/sales-orders/[id]`. Also added a New BOM shortcut button on the SO detail header. BOM create/edit dialog now shows a read-only "Linked SO" info panel when an SO is selected — fetches full SO detail via `useResource` and displays ordered products (name, qty, unit, unit price) for manufacturing/procurement context.
- 2026-05-03: Implemented full Procurement Chain (SO → BOM → PO). Added `supplier_products` table with code/name/unit/price/lead-days/HSN. Added `soId` FK on `bom_master`, `supplierProductId` (nullable `rawMaterialId`) on `bom_items`, and `soId`+`bomId` FKs on `purchase_orders` (migration `0012_procurement_bom_links.sql`). New Supplier Products CRUD page at `/supplier-products` with full list/create/edit/delete. BOM create/edit form now supports SO linkage picker and per-item material-type toggle (Supplier Product vs LAN Product). BOM list shows SO column. Sales Orders list has a BOM shortcut button (FileStack icon) that navigates to `/boms?newBom=1&soId=...` and auto-opens the create dialog with SO pre-filled. PO builder now has optional Linked SO and Linked BOM selectors; BOM list is filtered by selected SO; "Import from BOM" button (Download icon) fills PO lines from BOM supplier products. Sidebar Procurement group now includes: Suppliers, Supplier Products, BOMs, Purchase Orders (BOMs removed from Inventory group).

## Contributor Checklist (Every Feature Change)
- Update or add feature section
- Mark status (Active/Changed/Deprecated/Removed)
- Note user-facing behavior changes
- Update testing points
- Add one line in Change Log
- Update `Last updated` date
