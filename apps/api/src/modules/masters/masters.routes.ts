import { Hono } from "hono";
import type { AppEnv } from "../../index";
import { requireAuth } from "../../middleware/auth";

export const mastersRoutes = new Hono<AppEnv>();
mastersRoutes.use("*", requireAuth);

// Stubs — implement CRUD per master in dedicated submodules:
//   ./products.routes.ts, ./customers.routes.ts, ./brands.routes.ts,
//   ./units.routes.ts, ./gst-slabs.routes.ts, ./email-templates.routes.ts
mastersRoutes.get("/", (c) => c.json({ ok: true, masters: ["products", "customers", "brands", "units", "gst-slabs", "email-templates"] }));
