import { Hono } from "hono";
import { customerInput, customerListQuery } from "@powerbid/shared";
import type { AppEnv } from "../../index";
import { requireAuth } from "../../middleware/auth";
import { getDb } from "../../db/client";
import { parseId, parseJson, parseQuery } from "../../lib/validate";
import { customersService } from "./customers.service";
import { customerContactsRoutes } from "./contacts.routes";
import { createTimelineRoutes } from "../timeline/timeline.routes";
import { logActivity } from "../../lib/activity";

export const customersRoutes = new Hono<AppEnv>();
customersRoutes.use("*", requireAuth);

customersRoutes.get("/", async (c) => {
  const q = parseQuery(c.req.raw, customerListQuery);
  return c.json(await customersService.list(getDb(c.env.DB), q));
});

customersRoutes.get("/:id", async (c) => {
  const id = parseId(c.req.param("id"));
  return c.json(await customersService.get(getDb(c.env.DB), id));
});

customersRoutes.post("/", async (c) => {
  const input = await parseJson(c.req.raw, customerInput);
  const userId = c.get("userId") ?? null;
  const created = await customersService.create(getDb(c.env.DB), input, userId);
  await logActivity(getDb(c.env.DB), {
    entity: "customer",
    entityId: (created as { id: number }).id,
    action: "customer.created",
    userId,
  });
  return c.json(created, 201);
});

customersRoutes.put("/:id", async (c) => {
  const id = parseId(c.req.param("id"));
  const input = await parseJson(c.req.raw, customerInput);
  const userId = c.get("userId") ?? null;
  const result = await customersService.update(getDb(c.env.DB), id, input, userId);
  await logActivity(getDb(c.env.DB), {
    entity: "customer",
    entityId: id,
    action: "customer.updated",
    userId,
  });
  return c.json(result);
});

customersRoutes.delete("/:id", async (c) => {
  const id = parseId(c.req.param("id"));
  const userId = c.get("userId") ?? null;
  return c.json(await customersService.deactivate(getDb(c.env.DB), id, userId));
});

// Sub-routes mounted on the same /:id prefix.
customersRoutes.route("/", customerContactsRoutes);
customersRoutes.route("/", createTimelineRoutes("customer"));
