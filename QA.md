# QA.md — Acceptance & Test Checklist

Run the relevant section before marking a task done in `TASKS.md`. Tests can be manual unless an
automated test exists. Mark each item Pass / Fail / Skipped (with reason).

> **Rule:** never tick a check you did not actually run. See `RULES.md §R9`.

---

## QA-AUTH — Authentication

- [ ] `POST /api/auth/login` with valid creds returns `{ token, user }`; token decodes with the configured `JWT_SECRET` and `iss=powerbid`.
- [ ] Wrong password → 401 within 200 ms; no leak of which field was wrong.
- [ ] Protected endpoints (e.g. `GET /api/quotations`) without `Authorization` header return 401.
- [ ] Tampered token (any byte changed) → 401.
- [ ] Token expiry honoured: setting clock forward past `exp` rejects requests.
- [ ] Frontend: refreshing the page keeps user logged in (token in `localStorage`).
- [ ] Frontend: receiving 401 from any API call routes to `/login` and clears stored token.

## QA-MASTERS — Customers / Products

- [ ] Create customer with minimal fields (name + phone) succeeds.
- [ ] Duplicate `code` rejected with 409 and a friendly message.
- [ ] GSTIN field accepts 15-char value; invalid lengths rejected by zod.
- [ ] Soft-deleted customer no longer appears in pickers but still renders on historical quotations.
- [ ] Products list paginates ≤ 50 per page; search by name returns within 300 ms.

## QA-QUOTE — Quotation engine (server)

- [ ] `POST /api/quotations` with 3 items computes:
  - `line_subtotal = qty * unit_price * (1 - discount_percent/100)`
  - `line_gst = line_subtotal * gst_rate / 100`
  - `line_total = line_subtotal + line_gst`
  - `subtotal = Σ line_subtotal`
  - `discount_amount` per `discount_type`
  - `taxable_amount = subtotal - discount_amount`
  - `gst_amount = Σ line_gst` (re-applied proportionally if header discount used)
  - `grand_total = taxable_amount + gst_amount + freight_amount`
- [ ] All monetary values rounded to 2 decimals using banker's rounding consistently.
- [ ] `quotation_no` auto-generated as `Q-YYYY-####`, monotonically increasing per year.
- [ ] Status transitions enforced: `draft → final → sent → won|lost|expired`. Backwards transitions rejected.
- [ ] `clone` returns a new draft with same items, `revision = parent.revision + 1`, `parent_quotation_id` set.

## QA-QUOTE-UX — Quotation create UX (POC criterion #1)

- [ ] **Stopwatch test:** experienced user creates a 3-item quote with discount + freight and finalises in **≤ 60 s** keyboard-only.
- [ ] Tab order: customer → date → validity → first item product → qty → price → discount → next row.
- [ ] Product autocomplete returns within 200 ms; arrow + Enter selects.
- [ ] Adding a row never blurs focus from the form.
- [ ] Ctrl+S saves draft without leaving page; Ctrl+Shift+S finalises and navigates to detail view.
- [ ] Validation errors are inline next to the field; first invalid field is auto-focused.
- [ ] No console errors during the full flow.

## QA-PDF — Beautiful PDF (POC criterion #2)

Render the same quotation; visually compare:

- [ ] A4 portrait, ~20mm margins; nothing clipped; page-break clean (items table repeats header).
- [ ] Header: company name + logo placeholder + quotation no + date.
- [ ] Customer block: name, GSTIN, full billing address.
- [ ] Items table columns: # · Item · Description · Qty · Unit · Rate · Disc % · GST % · Amount.
- [ ] Totals box right-aligned: subtotal, discount, taxable, GST split (CGST/SGST or IGST), freight, **grand total in bold**.
- [ ] Amount-in-words line below grand total.
- [ ] T&C section (multi-line, preserves newlines).
- [ ] Footer: page n/N + quotation no + "system-generated; no signature required".
- [ ] PDF opens identically in Chrome's PDF viewer and Adobe Acrobat (text selectable).
- [ ] File size < 500 KB for a 3-item quote.
- [ ] Stored in R2 at `quotations/{id}/{quotationNo}-r{revision}.pdf`; key persisted on row.

## QA-EMAIL — Email send (POC criterion #4)

- [ ] `POST /api/quotations/:id/email` with valid recipient returns 202 within 1 s and writes a row to `email_logs` with `status=queued|sent` and a provider id.
- [ ] Email arrives in inbox (test with operator's address) with PDF attached and template tokens substituted.
- [ ] Subject/body editable from UI before send.
- [ ] Failure path: invalid recipient → row written with `status=failed` and error captured; UI shows error toast.
- [ ] Re-sending creates a new row; quotation detail shows latest send timestamp.
- [ ] `MAIL_FROM` and `MAIL_FROM_NAME` from env are honoured.

## QA-SEARCH — Search & history (POC criterion #3)

- [ ] `GET /api/quotations/search?q=...` returns ≤ 50 ranked results in **≤ 300 ms p95** with 1k+ seeded quotations.
- [ ] Matches across: quotation no (prefix), customer name (substring), GSTIN (exact), status (equals).
- [ ] Cmd/Ctrl-K palette opens from any page; Esc closes; arrows + Enter navigate.
- [ ] Filtered list page: status pills, date range, customer filter combine correctly.
- [ ] Clone from list and from detail both produce a fresh editable draft pointing to parent.

## QA-DASH — Dashboard (POC criterion #5)

- [ ] `GET /api/dashboard/summary` returns all 6 fields and renders in **≤ 500 ms p95**.
- [ ] Numbers reconcile with raw queries against `quotations` (operator can verify with one SQL).
- [ ] Empty state (no quotations yet) renders without errors.
- [ ] Cache: two consecutive requests from same role within 60 s return identical payload (verified via `X-Cache: hit` header or equivalent).
- [ ] Top-products list shows top 5 by qty quoted in last 30 days; ties broken by name.

## QA-SECURITY

- [ ] Every non-public endpoint rejects unauthenticated requests.
- [ ] Zod rejects unknown fields (no mass-assignment).
- [ ] No secrets in client bundle (`grep -ri "JWT_SECRET\|MAILCHANNELS" apps/web/dist` returns nothing after build).
- [ ] R2 PDFs not publicly listable; access only via Worker.
- [ ] CORS: only `APP_URL` allowed in production (configured in `apps/api/src/index.ts`).
- [ ] No SQL strings concatenated from user input — all via Drizzle.

## QA-PERF — Performance budgets

| Endpoint | Budget (p95) |
|---|---|
| `GET /api/quotations` (list, 50 rows) | 200 ms |
| `GET /api/quotations/search` | 300 ms |
| `GET /api/dashboard/summary` | 500 ms |
| `POST /api/quotations` (create draft) | 400 ms |
| PDF generation end-to-end | 5 s |

Measure with `wrangler dev` + 100 sequential requests; record p95 in the milestone changelog.

## QA-A11Y — Minimum accessibility

- [ ] All interactive elements reachable via keyboard.
- [ ] Visible focus rings on all focusable elements.
- [ ] Form labels associated with inputs (`<label for>` or aria-label).
- [ ] Color contrast ≥ 4.5:1 for body text (Tailwind defaults are mostly fine; spot-check).
- [ ] Page `<title>` updates per route.

## Smoke (post-deploy)

After `DEPLOY.md` steps complete, run on the production URL:

1. Login with operator account.
2. Create a customer.
3. Create a quotation with 3 items + discount + freight; finalise.
4. Generate PDF; download; visually inspect.
5. Email the quotation to operator's inbox; confirm receipt.
6. Cmd-K search by customer name; open the quotation.
7. Clone the quotation; save as draft.
8. Open dashboard; verify counts changed.

If any step fails → rollback per `DEPLOY.md §Rollback`.
