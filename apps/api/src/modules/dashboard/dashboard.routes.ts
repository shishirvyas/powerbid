import { Hono } from "hono";
import type { AppEnv } from "../../index";
import { requireAuth } from "../../middleware/auth";

export const dashboardRoutes = new Hono<AppEnv>();
dashboardRoutes.use("*", requireAuth);

dashboardRoutes.get("/summary", (c) =>
  c.json({
    quotationsThisMonth: 0,
    draftPending: 0,
    won: 0,
    lost: 0,
    pipelineValue: 0,
    topProducts: [],
  }),
);
