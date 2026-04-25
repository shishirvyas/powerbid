# RULES.md — Behavioural Rules

Hard rules. Violating any of these is a regression even if the code "works".

## R1. Scope discipline
- **Only** build features listed in `AGENT.md §1`. Anything in `§2 Parked` is forbidden until explicitly unblocked.
- No speculative refactors. No "while I'm here" cleanups in unrelated files.
- No new top-level folders without updating `AGENT.md §4`.

## R2. Stack discipline
- Cloudflare Workers runtime only — **no Node-only APIs** (`fs`, `child_process`, `Buffer` for runtime code, native `crypto` module). Use Web Crypto, `fetch`, `URL`, `TextEncoder`.
- Database access **only via Drizzle**, never raw `db.prepare()` from random files. All queries live inside `apps/api/src/modules/<m>/*.service.ts`.
- All request/response shapes go through **zod schemas in `packages/shared`**. Frontend imports the same schemas — single source of truth.

## R3. Schema discipline
- Migrations are append-only and numbered (`migrations/000N_description.sql`). **Never edit** a committed migration; write a new one.
- All new tables include: `id TEXT PK`, `created_at`, `updated_at`, `created_by`, `updated_by`, and `deleted_at` (when soft-delete makes sense).
- IDs are UUIDs generated via `crypto.randomUUID()` at the application layer — never autoincrement.

## R4. Security
- Every API route except `/api/auth/login`, `/api/auth/register` (if enabled), and `/health` must be behind `requireAuth`.
- Validate **every** request body with zod. Reject unknown fields (`.strict()`).
- Never log secrets, JWTs, password hashes, or full request bodies that may contain them.
- Never echo raw DB errors to clients — funnel through `middleware/error.ts`.
- R2 objects served to users only via short-lived signed URLs or via the Worker.

## R5. Performance budgets
- Quotation list endpoint: ≤ 200 ms p95 with 10k rows seeded.
- Search endpoint: ≤ 300 ms p95.
- Dashboard summary endpoint: ≤ 500 ms p95 (aggregation is OK to cache for 60s in Worker memory).
- Quotation create UI: keystroke-to-paint < 50 ms; full save round-trip < 1 s on 4G.

## R6. UI quality bar
- Tailwind only. Use primitives from `packages/ui`. **Don't** add a different component lib.
- Every form: keyboard-first, Enter submits, Esc cancels, focus rings visible, loading + error states.
- Every list view: empty state, skeleton, pagination or infinite scroll, server-side search.
- No console errors, no hydration warnings, no layout shift > 0.1 CLS.

## R7. Code quality
- TypeScript `strict: true`; no `any` outside narrowly scoped, commented escape hatches.
- One module = one responsibility. Files > 300 lines must be split.
- Public functions get JSDoc only when behaviour isn't obvious from name + types.
- No comments documenting *what* the code does; only *why* when non-obvious.

## R8. Git hygiene
- Conventional commits: `feat|fix|chore|refactor|docs|test(scope): subject`.
- One logical change per commit. No mega-commits.
- Never `--force` / `--no-verify` / `reset --hard` on shared branches.
- Don't commit `.env`, `.dev.vars`, `dist/`, `.wrangler/`, `node_modules/`.

## R9. Honesty
- If a task is blocked (missing secret, missing access, ambiguous spec), **stop** and ask. Do not invent values.
- If you skip a `QA.md` check, declare it explicitly in the report. Don't tick what you didn't run.
- If a fix is a workaround, mark it `// TODO(workaround):` with reason.

## R10. Deployment
- Never run `wrangler deploy`, `wrangler d1 execute --remote`, or modify production secrets. Prepare it; the operator runs it (see `DEPLOY.md`).
