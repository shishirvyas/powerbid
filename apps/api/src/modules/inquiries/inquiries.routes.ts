import { Hono } from "hono";
import type { AppEnv } from "../../index";
import { requireAuth } from "../../middleware/auth";

export const inquiriesRoutes = new Hono<AppEnv>();
inquiriesRoutes.use("*", requireAuth);
inquiriesRoutes.get("/", (c) => c.json({ items: [] }));
