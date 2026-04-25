# apps/web — Frontend SPA

React + Vite single-page app. Deployed to **Cloudflare Pages**.

## Folder layout

```
apps/web/
├── public/                # static assets copied as-is to dist/
├── src/
│   ├── app/               # App shell, providers, routes
│   ├── features/          # feature-sliced modules (inquiries, quotations, masters…)
│   │   └── <feature>/     # components, hooks, pages, api per feature
│   ├── components/        # app-specific composite components (not generic)
│   ├── lib/               # api client, auth, formatters, helpers
│   ├── hooks/              # cross-feature hooks
│   ├── stores/            # zustand stores (auth, ui)
│   ├── styles/            # globals.css (Tailwind), themes
│   └── main.tsx           # entry
├── index.html
├── tailwind.config.js
├── vite.config.ts
└── package.json
```

## Conventions

- **Feature-sliced design**: each module under `src/features/<name>/` is self-contained
  (`pages/`, `components/`, `hooks/`, `api.ts`, `schemas.ts`).
- **Generic UI** lives in `packages/ui` — never duplicate primitives here.
- **Shared types/zod schemas** come from `packages/shared`.
- API calls go through `src/lib/api.ts` (typed fetch wrapper, JWT injection).
- State: server state via `@tanstack/react-query`, UI/auth state via `zustand`.

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | Vite dev server on `:5173`, proxies `/api` -> `:8787` (worker). |
| `pnpm build` | Type-check + production bundle to `dist/`. |
| `pnpm preview` | Preview built bundle locally. |
| `pnpm deploy` | Deploys `dist/` to Cloudflare Pages (`powerbid-web`). |
