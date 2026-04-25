# AGENT.md — Claude Autonomous Agent Pack for PowerBid

> You are an autonomous coding agent working on **PowerBid** — a quotation & inquiry management app
> running on **Cloudflare** (React + Vite frontend, Workers + Hono API, D1 database, R2 storage).
> This file is your operating manual. Read it before every session, then execute tasks from `TASKS.md`
> in the order defined by `ROADMAP.md`, while obeying `RULES.md` and validating with `QA.md`.

---

## 1. Mission

Ship a **production-grade Proof of Concept** that proves the following five flows end-to-end. Anything
outside this list is **parked** — do not implement it unless explicitly unblocked.

| # | POC success criterion | Definition of done |
|---|---|---|
| 1 | **Very fast quotation creation** | A logged-in sales user can create a final quotation (customer + ≥3 line items + GST + discount + freight) in **≤ 60 seconds** with keyboard-only flow. |
| 2 | **Beautiful PDF** | One-click PDF generation; A4, branded header, itemised table, totals box, T&C footer; renders identically on Chrome and Acrobat; stored in R2 and downloadable via signed URL. |
| 3 | **Search old quotations** | Sub-300ms search across quotation no, customer name, GSTIN, status, date range. Clone-as-new from any historical quotation in one click. |
| 4 | **Email send** | Quotation can be emailed (with PDF attachment) using a saved template. Email is logged in `email_logs` with status, provider id, retries. |
| 5 | **Dashboard** | Single screen showing: quotations this month, draft pending, won, lost, revenue pipeline, top 5 products quoted. Cached, loads ≤ 500ms. |

## 2. Parked (do **not** build during POC)

- Roles & permissions UI (built-in roles only; backend gates exist).
- Inquiry → Quotation conversion UI flow polish (basic create works; nothing fancy).
- Auto-reminder scheduler / follow-up queue automation (manual only).
- Email template editor (use seeded templates from DB).
- Audit log viewer UI (the `activity_logs` table is written; no UI).
- Bulk import / CSV / Excel.
- Mobile native apps. Responsive web is enough.
- Multi-tenant / multi-company.

## 3. Stack contract (do not change without approval)

| Layer | Tech |
|---|---|
| Frontend | React 18 + Vite + TypeScript + Tailwind + shadcn-style primitives in `packages/ui` |
| Backend | Cloudflare Worker + Hono + Zod |
| DB | Cloudflare D1 (SQLite) accessed via Drizzle ORM |
| Storage | Cloudflare R2 (PDFs, attachments) |
| Auth | JWT (HS256) via `jose`, PBKDF2 password hashing (Web Crypto) |
| PDF | Cloudflare Browser Rendering (`@cloudflare/puppeteer`) |
| Email | MailChannels HTTP API (free from Workers) |
| Monorepo | pnpm workspaces + Turborepo |

## 4. Repository map

```
powerbid/
├── apps/
│   ├── web/              # React SPA → Cloudflare Pages
│   └── api/              # Hono Worker → Cloudflare Workers
├── packages/
│   ├── ui/               # shared UI primitives
│   └── shared/           # zod schemas + DTOs (frontend ↔ backend contract)
├── migrations/           # D1 SQL migrations (numbered)
├── docs/                 # architecture notes, ADRs
├── AGENT.md              # this file
├── RULES.md              # behavioural rules
├── TASKS.md              # backlog (pick top of the list)
├── ROADMAP.md            # ordered milestones
├── QA.md                 # acceptance & test checklist
└── DEPLOY.md             # deployment runbook
```

## 5. Operating loop (every session)

1. **Read** `AGENT.md` (this), `RULES.md`, current section of `ROADMAP.md`.
2. **Pick** the next unchecked item from `TASKS.md` that belongs to the current milestone.
3. **Plan** in 3–7 bullets before touching code. State files you'll create / modify.
4. **Implement** in small, runnable increments. Run `pnpm typecheck` after each change.
5. **Validate** against the relevant section of `QA.md`. If any check fails, fix before moving on.
6. **Update** `TASKS.md` (tick checkbox, add notes) and append a one-line entry to the changelog
   inside `ROADMAP.md` under the current milestone.
7. **Commit** with conventional commit message: `feat(quotations): create draft endpoint`.

## 6. Allowed autonomy

| Action | Autonomy |
|---|---|
| Edit code in `apps/`, `packages/`, `migrations/` | ✅ Free |
| Add a dependency that's already in the same family (e.g. another `@radix-ui/*`) | ✅ Free |
| Add a brand-new top-level dependency | ⚠ Justify in commit body |
| Change DB schema | ⚠ Add a *new* migration file; never edit a committed one |
| Change `wrangler.toml` bindings | ⚠ Update `DEPLOY.md` in the same commit |
| `wrangler deploy`, `wrangler d1 execute --remote`, secret rotation | ⛔ Operator only — propose in PR |
| Force-push, rewrite history, delete branches | ⛔ Operator only |

## 7. Communication contract

When reporting back to the operator, always produce:

1. **What changed** (bullet list of files).
2. **Why** (which TASKS.md item / QA.md criterion).
3. **How to verify** (exact commands the operator can run).
4. **Risks / open questions** (or write "none").

Keep it under 200 words unless asked for detail.
