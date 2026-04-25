# DEPLOY.md — Operator Runbook

> All commands here are **operator-only** — Claude must not execute them.
> Run from repo root with `pnpm` and the [Cloudflare Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) installed.

---

## 0. Pre-requisites (one-time)

| Item | How |
|---|---|
| Cloudflare account | Sign up; note your **Account ID**. |
| `wrangler` ≥ 3.80 | `npm i -g wrangler` then `wrangler login`. |
| Node ≥ 20.10 + pnpm ≥ 9 | `corepack enable && corepack prepare pnpm@latest --activate`. |
| Domain (optional) | Add to Cloudflare; needed for custom hostnames + MailChannels SPF/DKIM. |

---

## 1. Provision Cloudflare resources

```powershell
# From repo root
pnpm install

# 1.1 D1 database — already provisioned for this repo:
#     id = a13416b4-1fa9-4992-8598-3bbd60eaa8cf  (already in apps/api/wrangler.jsonc)
# To create a new one for a fresh environment:
# wrangler d1 create powerbid
# Copy the printed database_id into apps/api/wrangler.jsonc under d1_databases.

# 1.2 R2 bucket
wrangler r2 bucket create powerbid-files

# 1.3 Browser Rendering — requires Workers Paid plan.
#     Enable from dashboard: Workers & Pages → Browser Rendering → Enable.
```

---

## 2. Configure secrets (production Worker)

```powershell
cd apps/api

# Required
wrangler secret put JWT_SECRET
# (paste a long random string, e.g. `openssl rand -base64 48`)

# Optional — only if your MailChannels setup needs an API key
wrangler secret put MAILCHANNELS_API_KEY
```

For **email deliverability** (MailChannels):

1. Add SPF: `v=spf1 include:relay.mailchannels.net ~all` to your sending domain.
2. Add the **Domain Lockdown** TXT record per [MailChannels docs](https://support.mailchannels.com/hc/en-us/articles/16918954360845).
3. Add DKIM (recommended) per provider docs.

Update apps/api/wrangler.jsonc vars:

```toml
APP_URL = "https://app.powerbid.example.com"
MAIL_FROM = "no-reply@powerbid.example.com"
MAIL_FROM_NAME = "PowerBid"
```

---

## 3. Apply database migrations

```powershell
# Local first (sanity check)
pnpm db:migrate:local
pnpm db:seed:local

# Production
pnpm db:migrate:remote
# Optional: seed reference rows on prod (idempotent)
pnpm --filter @powerbid/api db:seed:remote
```

Verify on prod:

```powershell
wrangler d1 execute powerbid --remote --command "SELECT COUNT(*) FROM gst_slabs;"
```

---

## 4. Bootstrap the first admin user

Pick **one** of:

**A. SQL (fastest):** generate a PBKDF2 hash matching `apps/api/src/services/crypto.ts` and insert manually:

```powershell
# 1. Generate hash locally
node --input-type=module -e "import('./apps/api/src/services/crypto.ts').then(m => m.hashPassword(process.argv[1]).then(console.log))" "YourStrongPassword!"
# 2. Insert
wrangler d1 execute powerbid --remote --command "INSERT INTO users (id, email, password_hash, name, role_id) VALUES ('11111111-1111-4111-8111-111111111111','admin@powerbid.example.com','<paste hash>','Admin','00000000-0000-4000-8000-000000000001');"
```

**B. One-shot bootstrap endpoint** (if `T1.2` ships): `POST /api/auth/bootstrap` succeeds only when `users` table is empty.

---

## 5. Deploy the API Worker

```powershell
cd apps/api
pnpm typecheck
pnpm build      # dry-run check
wrangler deploy
```

Verify:

```powershell
curl https://powerbid-api.<your-subdomain>.workers.dev/health
```

(If using a custom route, configure under `[routes]` in `wrangler.toml` before deploy.)

---

## 6. Deploy the web app (Cloudflare Pages)

First time:

```powershell
# Create the Pages project (UI: Workers & Pages → Create → Pages → Direct upload)
# OR via Wrangler:
cd apps/web
pnpm build
wrangler pages deploy dist --project-name powerbid-web
```

Set environment variable for the Pages project (Settings → Environment variables):

| Name | Value |
|---|---|
| `VITE_API_BASE_URL` | `https://powerbid-api.<your-subdomain>.workers.dev` (or custom domain) |

Re-build and re-deploy after changing env vars.

Bind a custom domain under Pages → Custom domains, e.g. `app.powerbid.example.com`.

---

## 7. Post-deploy validation

Run **`QA.md §Smoke`** end-to-end on the production URL.

Quick health checks:

```powershell
curl https://powerbid-api.<sub>.workers.dev/health
curl -X POST https://powerbid-api.<sub>.workers.dev/api/auth/login -H "Content-Type: application/json" -d '{"email":"admin@...","password":"..."}'
```

---

## 8. Rollback

### API
```powershell
cd apps/api
wrangler deployments list
wrangler rollback <deployment-id>
```

### Pages
Pages → Deployments → pick previous deployment → **Rollback**.

### D1
D1 has no built-in rollback. Strategies:

- **Schema rollback:** write a *new* down-migration as `migrations/000N_revert_xxx.sql` and apply it.
- **Data rollback:** use Time Travel (D1 retains 30 days):
  ```powershell
  wrangler d1 time-travel info powerbid
  wrangler d1 time-travel restore powerbid --bookmark <bookmark>
  ```
  ⚠ Restoring is destructive — coordinate with operator before running on prod.

---

## 9. Operational runbook

| Symptom | Check |
|---|---|
| 500s on every API call | `wrangler tail powerbid-api` — look for stack traces. |
| Auth fails after deploy | Confirm `JWT_SECRET` secret set; tokens issued with old secret are invalid (expected). |
| PDF endpoint times out | Browser Rendering quota / Workers plan; verify `[browser]` binding present. |
| Emails not arriving | MailChannels Domain Lockdown TXT missing; check `email_logs.error` column. |
| D1 quota errors | `wrangler d1 info powerbid` — review reads/writes; add caching at Worker level. |

---

## 10. Secret rotation (quarterly)

```powershell
# Rotate JWT — invalidates all sessions
wrangler secret put JWT_SECRET
# Force a redeploy so new instances pick it up
cd apps/api && wrangler deploy
```

Keep an audit trail (date, who rotated, why) in your ops journal.
