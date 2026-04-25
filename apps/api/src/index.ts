import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import type { Env } from "./env";
import { authRoutes } from "./modules/auth/auth.routes";
import { mastersRoutes } from "./modules/masters/masters.routes";
import { inquiriesRoutes } from "./modules/inquiries/inquiries.routes";
import { quotationsRoutes } from "./modules/quotations/quotations.routes";
import { dashboardRoutes } from "./modules/dashboard/dashboard.routes";
import { errorHandler } from "./middleware/error";

export type AppEnv = { Bindings: Env; Variables: { userId?: number; userEmail?: string } };

const app = new Hono<AppEnv>();

app.use("*", logger());
app.use("*", cors({
  origin: (origin, c) => {
    const allowed = (c.env.ALLOWED_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    if (!origin) return allowed[0] ?? "*";
    return allowed.includes(origin) ? origin : allowed[0] ?? "";
  },
  credentials: true,
}));

app.get("/health", (c) => c.json({ ok: true, ts: Date.now() }));

app.route("/api/auth", authRoutes);
app.route("/api/masters", mastersRoutes);
app.route("/api/inquiries", inquiriesRoutes);
app.route("/api/quotations", quotationsRoutes);
app.route("/api/dashboard", dashboardRoutes);

app.onError(errorHandler);

export default app;
