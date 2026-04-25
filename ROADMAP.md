# ROADMAP.md — POC Milestones

Linear, dependency-ordered. Do not start a milestone until the previous one's exit criteria are green.
Append a one-line changelog entry under the active milestone after every successful task.

---

## M0 — Foundation
**Exit criteria:** local dev runs (`pnpm dev`) with web on `:5173` proxying to worker on `:8787`; D1 migrated; `/health` returns OK.
**Changelog:**
- _(append entries here as you work)_

---

## M1 — Auth & shell
**Exit criteria:** Login with seeded admin succeeds; protected route redirects unauthenticated users; logout clears token.
**Changelog:**

---

## M2 — Masters minimal
**Exit criteria:** Customer can be created from UI; Product list shows seeded reference data; quotation form can pick from both.
**Changelog:**

---

## M3 — Quotation engine 🎯 *POC criterion #1: fast creation*
**Exit criteria:** Operator timer test — full quotation (3 items, discount, freight) created and finalised in ≤ 60 s, keyboard-only.
**Changelog:**

---

## M4 — Beautiful PDF 🎯 *POC criterion #2*
**Exit criteria:** PDF passes design review (`QA.md §QA-PDF`); identical render in Chrome + Acrobat; stored in R2; downloadable.
**Changelog:**

---

## M5 — Email send 🎯 *POC criterion #4*
**Exit criteria:** Email arrives in inbox with PDF attached; `email_logs` row written with `status=sent` and provider id.
**Changelog:**

---

## M6 — Search & history 🎯 *POC criterion #3*
**Exit criteria:** Cmd-K finds a quotation by partial customer name in < 300 ms over ≥ 1k seeded quotations; clone yields editable draft.
**Changelog:**

---

## M7 — Dashboard 🎯 *POC criterion #5*
**Exit criteria:** Dashboard renders all 5 stats + top-products list in ≤ 500 ms p95.
**Changelog:**

---

## M8 — Polish & ship
**Exit criteria:** All `QA.md` checks green; production deploy successful per `DEPLOY.md`; smoke tests pass on prod URL.
**Changelog:**
