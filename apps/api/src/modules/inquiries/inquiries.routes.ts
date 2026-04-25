import { Hono } from "hono";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { inquiryInput } from "@powerbid/shared";
import type { AppEnv } from "../../index";
import { requireAuth } from "../../middleware/auth";
import { getDb } from "../../db/client";
import { inquiries, inquiryItems, products, quotations, quotationItems } from "../../db/schema";
import { parseId, parseJson, parseQuery } from "../../lib/validate";
import { inquiriesService } from "./inquiries.service";
import { badRequest, notFound } from "../../lib/errors";
import { logActivity } from "../../lib/activity";
import { computeTotals } from "../quotations/quotations.calc";
import { createTimelineRoutes } from "../timeline/timeline.routes";

export const inquiriesRoutes = new Hono<AppEnv>();
inquiriesRoutes.use("*", requireAuth);

const listQuery = z
  .object({
    q: z.string().optional(),
    status: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(200).default(50),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .strict();

inquiriesRoutes.get("/", async (c) => {
  const q = parseQuery(c.req.raw, listQuery);
  return c.json(await inquiriesService.list(getDb(c.env.DB), q));
});

inquiriesRoutes.get("/:id", async (c) => {
  const id = parseId(c.req.param("id"));
  return c.json(await inquiriesService.get(getDb(c.env.DB), id));
});

inquiriesRoutes.post("/", async (c) => {
  const input = await parseJson(c.req.raw, inquiryInput);
  const userId = c.get("userId") ?? null;
  const created = await inquiriesService.create(getDb(c.env.DB), c.env.DB, input, userId);
  await logActivity(getDb(c.env.DB), {
    entity: "inquiry",
    entityId: created.id,
    action: "inquiry.created",
    userId,
    payload: { inquiryNo: created.inquiryNo },
  });
  return c.json(created, 201);
});

/**
 * Convert an inquiry into a draft quotation.
 * Carries the customer + items forward; pulls product prices/GST/units when available.
 */
inquiriesRoutes.post("/:id/convert-to-quotation", async (c) => {
  const id = parseId(c.req.param("id"));
  const db = getDb(c.env.DB);
  const userId = c.get("userId") ?? null;

  const [inq] = await db.select().from(inquiries).where(eq(inquiries.id, id)).limit(1);
  if (!inq) throw notFound("Inquiry not found");
  if (!inq.customerId) throw badRequest("Inquiry has no linked customer");

  const items = await db
    .select()
    .from(inquiryItems)
    .where(eq(inquiryItems.inquiryId, id));
  if (items.length === 0) throw badRequest("Inquiry has no items to convert");

  // Pull pricing for items linked to a product.
  const productIds = items.map((i) => i.productId).filter((x): x is number => !!x);
  const productMap = new Map<number, { basePrice: number; sku: string; name: string; gstRate?: number; unitName?: string }>();
  if (productIds.length) {
    const rows = await db
      .select({ id: products.id, basePrice: products.basePrice, sku: products.sku, name: products.name })
      .from(products);
    for (const r of rows) productMap.set(r.id, { basePrice: r.basePrice, sku: r.sku, name: r.name });
  }

  const draftItems = items.map((it, idx) => {
    const p = it.productId ? productMap.get(it.productId) : null;
    return {
      productId: it.productId ?? null,
      productName: it.productName,
      description: it.remarks ?? null,
      unitName: null as string | null,
      qty: it.qty || 1,
      unitPrice: p?.basePrice ?? 0,
      discountPercent: 0,
      gstRate: 0,
      sortOrder: idx,
    };
  });

  const computed = computeTotals({
    items: draftItems,
    discountType: "percent",
    discountValue: 0,
    freightAmount: 0,
  });

  const today = new Date().toISOString().slice(0, 10);
  const [head] = await db
    .insert(quotations)
    .values({
      quotationNo: `DRAFT-${Date.now()}`,
      quotationDate: today,
      validityDays: 15,
      inquiryId: id,
      customerId: inq.customerId,
      status: "draft",
      subtotal: computed.totals.subtotal,
      discountType: "percent",
      discountValue: 0,
      discountAmount: computed.totals.discountAmount,
      taxableAmount: computed.totals.taxableAmount,
      gstAmount: computed.totals.gstAmount,
      freightAmount: computed.totals.freightAmount,
      grandTotal: computed.totals.grandTotal,
      notes: inq.requirement ?? null,
      createdBy: userId,
      updatedBy: userId,
    })
    .returning();

  await db.insert(quotationItems).values(
    draftItems.map((d, i) => {
      const ci = computed.items[i];
      return {
        quotationId: head.id,
        productId: d.productId,
        productName: d.productName,
        description: d.description,
        unitName: d.unitName,
        qty: ci.qty,
        unitPrice: ci.unitPrice,
        discountPercent: ci.discountPercent,
        gstRate: ci.gstRate,
        lineSubtotal: ci.lineSubtotal,
        lineGst: ci.lineGst,
        lineTotal: ci.lineTotal,
        sortOrder: d.sortOrder,
      };
    }),
  );

  // Mark inquiry as quoted, link to the new quotation in payload.
  await db
    .update(inquiries)
    .set({ status: "quoted", updatedAt: new Date().toISOString(), updatedBy: userId })
    .where(eq(inquiries.id, id));

  await logActivity(db, {
    entity: "inquiry",
    entityId: id,
    action: "inquiry.converted",
    userId,
    payload: { quotationId: head.id },
  });
  await logActivity(db, {
    entity: "quotation",
    entityId: head.id,
    action: "quotation.created_from_inquiry",
    userId,
    payload: { inquiryId: id, inquiryNo: inq.inquiryNo },
  });

  return c.json({ id: head.id, quotationNo: head.quotationNo, fromInquiryId: id }, 201);
});

// Notes timeline + activity feed for inquiries.
inquiriesRoutes.route("/", createTimelineRoutes("inquiry"));

