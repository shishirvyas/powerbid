# apps/api — Cloudflare Worker API

Hono-based Worker that serves the JSON API. Backed by **D1** (database) and **R2** (object storage).

## Folder layout

```
apps/api/
├── src/
│   ├── index.ts            # Worker entry, route mounting, middleware
│   ├── env.ts              # Env / bindings type contract
│   ├── db/                 # Drizzle client + schema
│   ├── middleware/         # auth, error, validation, rate limiting
│   ├── modules/            # feature modules (vertical slices)
│   │   ├── auth/
│   │   ├── masters/        # products, customers, brands, units, gst, email-templates
│   │   ├── inquiries/
│   │   ├── quotations/
│   │   └── dashboard/
│   ├── services/           # cross-cutting: crypto, pdf, mailer, storage
│   └── utils/              # pure helpers
├── scripts/
│   └── seed.ts             # local/remote seed runner
├── drizzle.config.ts       # drizzle-kit config (writes to ../../migrations)
├── wrangler.toml           # bindings: DB (D1), FILES (R2), BROWSER, vars
└── package.json
```

## Module convention

Each `modules/<name>/` contains:

- `*.routes.ts`   — Hono route definitions
- `*.service.ts`  — business logic (DB access)
- `*.schema.ts`   — Zod schemas (or imports from `@powerbid/shared`)
- `*.types.ts`    — internal types

Routes are mounted in `src/index.ts` under `/api/<name>`.

## Bindings

| Binding | Type | Purpose |
| --- | --- | --- |
| `DB` | D1Database | Primary relational store. |
| `FILES` | R2Bucket | Quotation PDFs, attachments. |
| `BROWSER` | Fetcher | Cloudflare Browser Rendering — for PDF generation. |

## Scripts

| Command | Purpose |
| --- | --- |
| `pnpm dev` | `wrangler dev` on `:8787` with local D1/R2. |
| `pnpm build` | Bundle check via `wrangler deploy --dry-run`. |
| `pnpm deploy` | Deploy Worker to Cloudflare. |
| `pnpm db:generate` | Generate migration SQL from Drizzle schema diff. |
| `pnpm db:migrate:local` | Apply migrations to local D1. |
| `pnpm db:migrate:remote` | Apply migrations to production D1. |
| `pnpm db:seed:local` | Seed reference data (GST slabs, units, templates). |

## Setup checklist

1. `wrangler d1 create powerbid` → put `database_id` into `wrangler.toml`.
2. `wrangler r2 bucket create powerbid-files`.
3. `cp .dev.vars.example .dev.vars` and set `JWT_SECRET`.
4. `pnpm db:migrate:local && pnpm db:seed:local`.
5. `pnpm dev`.
