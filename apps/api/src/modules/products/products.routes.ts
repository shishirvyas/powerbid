import { Hono } from "hono";
import { productInput, productListQuery } from "@powerbid/shared";
import type { AppEnv } from "../../index";
import { requireAuth } from "../../middleware/auth";
import { getDb } from "../../db/client";
import { parseId, parseJson, parseQuery } from "../../lib/validate";
import { productsService } from "./products.service";

export const productsRoutes = new Hono<AppEnv>();
productsRoutes.use("*", requireAuth);

productsRoutes.get("/", async (c) => {
  const q = parseQuery(c.req.raw, productListQuery);
  return c.json(await productsService.list(getDb(c.env.DB), q));
});

productsRoutes.get("/:id", async (c) => {
  const id = parseId(c.req.param("id"));
  return c.json(await productsService.get(getDb(c.env.DB), id));
});

productsRoutes.post("/", async (c) => {
  const input = await parseJson(c.req.raw, productInput);
  const userId = c.get("userId") ?? null;
  return c.json(await productsService.create(getDb(c.env.DB), input, userId), 201);
});

productsRoutes.put("/:id", async (c) => {
  const id = parseId(c.req.param("id"));
  const input = await parseJson(c.req.raw, productInput);
  const userId = c.get("userId") ?? null;
  return c.json(await productsService.update(getDb(c.env.DB), id, input, userId));
});

productsRoutes.delete("/:id", async (c) => {
  const id = parseId(c.req.param("id"));
  const userId = c.get("userId") ?? null;
  return c.json(await productsService.deactivate(getDb(c.env.DB), id, userId));
});
