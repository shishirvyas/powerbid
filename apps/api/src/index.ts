import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import type { Env } from "./env";
import { authRoutes } from "./modules/auth/auth.routes";
import { mastersRoutes } from "./modules/masters/masters.routes";
import { customersRoutes } from "./modules/customers/customers.routes";
import { productsRoutes } from "./modules/products/products.routes";
import { inquiriesRoutes } from "./modules/inquiries/inquiries.routes";
import { quotationEmailPublicRoutes } from "./modules/quotations/quotation-email.public.routes";
import { quotationsRoutes } from "./modules/quotations/quotations.routes";
import { dashboardRoutes } from "./modules/dashboard/dashboard.routes";
import { adminRoutes } from "./modules/admin/admin.routes";
import { errorHandler } from "./middleware/error";
import { runQuotationReminderCron } from "./modules/quotations/quotation-email.service";
import { ensurePocTables } from "./lib/bootstrap";

export type AppEnv = { Bindings: Env; Variables: { userId?: number; userEmail?: string } };

const app = new Hono<AppEnv>();

app.use("*", logger());
app.use("*", async (c, next) => {
  // Runtime DDL bootstrap — no-op after the first call per worker isolate.
  await ensurePocTables(c.env.DB);
  await next();
});
app.use("*", cors({
  origin: (origin, c) => {
    const allowed = (c.env.ALLOWED_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    if (!origin) return allowed[0] ?? "*";
    return allowed.includes(origin) ? origin : allowed[0] ?? "";
  },
  credentials: true,
}));

app.get("/health", (c) => c.json({ ok: true, ts: Date.now() }));

// Auth (mounted twice so both /api/login and /api/auth/login work).
app.route("/api/auth", authRoutes);
app.route("/api", authRoutes);

app.route("/api/masters", mastersRoutes);
app.route("/api/customers", customersRoutes);
app.route("/api/products", productsRoutes);
app.route("/api/inquiries", inquiriesRoutes);
app.route("/api/email-events", quotationEmailPublicRoutes);
app.route("/api/quotations", quotationsRoutes);
app.route("/api/dashboard", dashboardRoutes);
app.route("/api/admin", adminRoutes);

app.notFound((c) => c.json({ error: "Not found", code: "not_found" }, 404));
app.onError(errorHandler);

export default {
  fetch: app.fetch,
  scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runQuotationReminderCron(env));
  },
};
