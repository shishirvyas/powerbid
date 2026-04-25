import { Hono } from "hono";
import type { AppEnv } from "../../index";
import { trackQuotationEmailOpen, trackingPixelResponse } from "./quotation-email.service";

export const quotationEmailPublicRoutes = new Hono<AppEnv>();

quotationEmailPublicRoutes.get("/open/:token", async (c) => {
  const token = c.req.param("token");
  if (token) {
    await trackQuotationEmailOpen(c.env, token);
  }
  return trackingPixelResponse();
});
