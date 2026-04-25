# TASKS.md — POC Backlog

Tasks are grouped by milestone. Pick the **top unchecked item** in the **current milestone** (see `ROADMAP.md`).
Each task lists files you'll likely touch and the QA section to validate against.

Legend: `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked (write reason inline)

---

## M0 — Foundation (one-time)

- [ ] **T0.1** Install workspace: `pnpm install` at repo root.
- [ ] **T0.2** Create D1 database & put id in `apps/api/wrangler.toml`. _(operator)_
- [ ] **T0.3** Create R2 bucket `powerbid-files`. _(operator)_
- [ ] **T0.4** Set local secrets: copy `apps/api/.dev.vars.example` → `.dev.vars`, fill `JWT_SECRET`.
- [ ] **T0.5** Apply migrations locally: `pnpm db:migrate:local`.
- [ ] **T0.6** Verify: `curl http://localhost:8787/health` returns `{ ok: true }`.

---

## M1 — Auth & shell (gate everything)

- [ ] **T1.1** Implement `POST /api/auth/login` with email + password (already stubbed). QA §QA-AUTH.
  - Files: `apps/api/src/modules/auth/auth.routes.ts`, `apps/api/src/services/crypto.ts`
- [ ] **T1.2** Seed admin user via a one-shot SQL or `/api/auth/bootstrap` (admin only if no user exists).
  - Files: `migrations/0003_bootstrap_admin.sql` (or new endpoint)
- [ ] **T1.3** Frontend: login page + auth store + token persistence + 401 redirect.
  - Files: `apps/web/src/features/auth/*`, `apps/web/src/stores/auth.ts`, `apps/web/src/lib/api.ts`
- [ ] **T1.4** App shell: header, nav (Dashboard / Quotations / New Quote / Search), logout.
  - Files: `apps/web/src/app/App.tsx`, `apps/web/src/components/layout/*`

---

## M2 — Masters minimal (only what quotations need)

> Goal: enough data so a user can create a quotation. Full CRUD UIs are parked.

- [ ] **T2.1** Customers CRUD endpoints + simple list/create UI. QA §QA-MASTERS.
  - Files: `apps/api/src/modules/masters/customers.*`, `apps/web/src/features/customers/*`
- [ ] **T2.2** Products list + create endpoint + minimal UI. Brand/Unit/GST inline-create allowed.
- [ ] **T2.3** Confirm seeded GST slabs, units, brands are reachable from `/api/masters/...`.

---

## M3 — Quotation engine (the core)

- [ ] **T3.1** `POST /api/quotations` (draft) — server computes line totals, taxable, GST, grand total. QA §QA-QUOTE.
  - Files: `apps/api/src/modules/quotations/quotations.service.ts`, `quotations.schema.ts`
- [ ] **T3.2** `PUT /api/quotations/:id`, `POST /api/quotations/:id/finalize`, `POST /api/quotations/:id/clone`.
- [ ] **T3.3** `GET /api/quotations` with filters (status, customer, date range, q) + pagination. QA §QA-SEARCH.
- [ ] **T3.4** Frontend: **fast quotation create** screen. Keyboard-only flow. QA §QA-QUOTE-UX.
  - Add line: type product → autocomplete → Tab → qty → Tab → price prefilled → Enter (next row).
  - Sticky totals box with subtotal / discount / GST / freight / grand total.
  - Save draft (Ctrl+S), Finalize (Ctrl+Shift+S).
- [ ] **T3.5** Quotation list page with search box, status pills, date filter, "Clone" action.

---

## M4 — Beautiful PDF + R2

- [ ] **T4.1** HTML template for PDF in `apps/api/src/services/pdf-template.ts` — A4, header (logo placeholder, company info), customer block, items table, totals box, T&C, footer with quotation no + page n/N. QA §QA-PDF.
- [ ] **T4.2** `POST /api/quotations/:id/pdf` — render via Browser Rendering, store in R2 under `quotations/{id}/{quotationNo}-r{revision}.pdf`, save key on quotation row.
- [ ] **T4.3** `GET /api/quotations/:id/pdf` — stream from R2 (or 302 to short-lived signed URL).
- [ ] **T4.4** Frontend: **Download PDF** + **Preview** buttons. Inline preview via `<iframe>`.

---

## M5 — Email send

- [ ] **T5.1** `POST /api/quotations/:id/email` body: `{ to, cc?, bcc?, subject?, body?, templateCode? }`. Default template `QUOTATION_SEND`. Attaches latest PDF from R2. QA §QA-EMAIL.
- [ ] **T5.2** Template token replacement: `{{quotationNo}}`, `{{customerName}}`, `{{grandTotal}}`, `{{validityDays}}`, `{{senderName}}`.
- [ ] **T5.3** Persist row in `email_logs` with status, provider id, attempts, error.
- [ ] **T5.4** Frontend: "Email" dialog on quotation detail — pre-fills customer email, editable subject + body, sends, shows toast + last-sent badge on quotation.

---

## M6 — Search & history

- [ ] **T6.1** `GET /api/quotations/search?q=` — match across `quotation_no`, customer name (joined), GSTIN, status. Returns ≤ 50 results, ranked by recency. QA §QA-SEARCH.
- [ ] **T6.2** Frontend: Cmd/Ctrl-K quick search palette opens from anywhere; arrow keys navigate; Enter opens quotation.
- [ ] **T6.3** Clone: `POST /api/quotations/:id/clone` returns a new draft with same items; UI button on detail + list.

---

## M7 — Dashboard

- [ ] **T7.1** `GET /api/dashboard/summary` returns: `quotationsThisMonth`, `draftPending`, `won`, `lost`, `pipelineValue` (sum of grand_total where status in draft/final/sent), `topProducts` (top 5 by qty quoted last 30 days). QA §QA-DASH.
- [ ] **T7.2** Cache the response in module-scope memory for 60s keyed by user role.
- [ ] **T7.3** Frontend dashboard: 5 stat cards + top-products list + "create quotation" big CTA.

---

## M8 — Polish & ship

- [ ] **T8.1** Run full `QA.md` checklist; fix all reds.
- [ ] **T8.2** Run `pnpm typecheck && pnpm lint && pnpm build` clean.
- [ ] **T8.3** Operator: deploy per `DEPLOY.md`.
- [ ] **T8.4** Smoke test on production URL with `QA.md §Smoke`.

---

## Parked (do not pull from this list during POC)

- Roles & permissions UI
- Inquiry workflow polish + conversion to quote
- Email template editor UI
- Auto follow-up scheduler / reminder cron
- CSV import / export
- Activity-log viewer UI
- Multi-currency, multi-company
