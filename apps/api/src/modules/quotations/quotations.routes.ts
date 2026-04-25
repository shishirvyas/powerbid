/**
 * Quotation API.
 *
 * Endpoints:
 *   GET    /                              list (with filters)
 *   GET    /export.csv                    Excel-friendly export
 *   GET    /:id                           detail (head + items + email summary)
 *   POST   /                              create draft
 *   PUT    /:id                           replace draft (full overwrite)
 *   POST   /:id/finalize                  draft -> final (assigns Q-YYYY-####), sends email
 *   POST   /:id/status                    update status (won/lost/sent/expired)
 *   POST   /:id/clone                     clone any quotation into a new draft
 *   POST   /:id/pdf                       render & store PDF
 *   GET    /:id/pdf                       stream stored PDF
 *   POST   /:id/email                     send email
 *   POST   /:id/email/resend              manual resend
 *   GET    /:id/notes  POST /:id/notes    notes timeline
 *   GET    /:id/activity                  audit log feed
 *   GET    /:id/timeline                  combined notes + activity
 */
import { Hono } from "hono";
import { eq, desc, and, sql } from "drizzle-orm";
import {
  quotationDraftInput,
  quotationStatusUpdate,
  emailQuotationInput,
} from "@powerbid/shared";
import type { AppEnv } from "../../index";
import { requireAuth } from "../../middleware/auth";
import { getDb } from "../../db/client";
import {
  quotations,
  quotationItems,
  customers,
  customerContacts,
} from "../../db/schema";
import { computeTotals } from "./quotations.calc";
import { nextQuotationNo } from "./quotations.numbering";
import { renderQuotationPdf } from "../../services/pdf";
import {
  getQuotationEmailSummary,
  sendQuotationEmailAutomation,
} from "./quotation-email.service";
import { parseId, parseJson } from "../../lib/validate";
import { badRequest, conflict, notFound } from "../../lib/errors";
import { logActivity } from "../../lib/activity";
import { csvResponse, toCsv } from "../../lib/csv";
import { createTimelineRoutes } from "../timeline/timeline.routes";

const router = new Hono<AppEnv>();
router.use("*", requireAuth);

/* ---------------------------------- LIST -------------------------------------- */

router.get("/", async (c) => {
  const db = getDb(c.env.DB);
  const status = c.req.query("status");
  const q = c.req.query("q")?.trim();
  const limit = Math.min(Number(c.req.query("limit") ?? 50), 200);

  const where: any[] = [eq(quotations.isActive, true)];
  if (status) where.push(eq(quotations.status, status as never));
  if (q) {
    where.push(
      sql`(${quotations.quotationNo} LIKE ${"%" + q + "%"} OR ${customers.name} LIKE ${"%" + q + "%"})`,
    );
  }

  const rows = await db
    .select({
      id: quotations.id,
      quotationNo: quotations.quotationNo,
      quotationDate: quotations.quotationDate,
      validityDays: quotations.validityDays,
      status: quotations.status,
      grandTotal: quotations.grandTotal,
      customerId: quotations.customerId,
      customerName: customers.name,
      updatedAt: quotations.updatedAt,
    })
    .from(quotations)
    .leftJoin(customers, eq(customers.id, quotations.customerId))
    .where(and(...where))
    .orderBy(desc(quotations.updatedAt))
    .limit(limit);

  return c.json({ items: rows });
});

/* ----------------------------- EXPORT (CSV / Excel) --------------------------- */

router.get("/export.csv", async (c) => {
  const db = getDb(c.env.DB);
  const status = c.req.query("status");
  const where: any[] = [eq(quotations.isActive, true)];
  if (status) where.push(eq(quotations.status, status as never));

  const rows = await db
    .select({
      quotationNo: quotations.quotationNo,
      quotationDate: quotations.quotationDate,
      validityDays: quotations.validityDays,
      status: quotations.status,
      customer: customers.name,
      subtotal: quotations.subtotal,
      discountAmount: quotations.discountAmount,
      gstAmount: quotations.gstAmount,
      freightAmount: quotations.freightAmount,
      grandTotal: quotations.grandTotal,
      paymentTerms: quotations.paymentTerms,
      deliverySchedule: quotations.deliverySchedule,
      sentAt: quotations.sentAt,
      closedAt: quotations.closedAt,
      updatedAt: quotations.updatedAt,
    })
    .from(quotations)
    .leftJoin(customers, eq(customers.id, quotations.customerId))
    .where(and(...where))
    .orderBy(desc(quotations.updatedAt))
    .limit(5000);

  const cols = [
    "quotationNo",
    "quotationDate",
    "validityDays",
    "status",
    "customer",
    "subtotal",
    "discountAmount",
    "gstAmount",
    "freightAmount",
    "grandTotal",
    "paymentTerms",
    "deliverySchedule",
    "sentAt",
    "closedAt",
    "updatedAt",
  ];
  const csv = toCsv(rows as unknown as Record<string, unknown>[], cols);
  const date = new Date().toISOString().slice(0, 10);
  return csvResponse(`quotations-${date}.csv`, csv);
});

/* ---------------------------------- GET ONE ----------------------------------- */

router.get("/:id", async (c) => {
  const id = parseId(c.req.param("id"));
  const db = getDb(c.env.DB);
  const [row] = await db
    .select()
    .from(quotations)
    .leftJoin(customers, eq(customers.id, quotations.customerId))
    .where(eq(quotations.id, id))
    .limit(1);
  if (!row) throw notFound("Quotation not found");

  const items = await db
    .select()
    .from(quotationItems)
    .where(eq(quotationItems.quotationId, id))
    .orderBy(quotationItems.sortOrder);

  const email = await getQuotationEmailSummary(c.env, id);

  return c.json({
    quotation: row.quotations,
    customer: row.customers,
    items,
    email,
  });
});

/* --------------------------------- CREATE DRAFT ------------------------------- */

router.post("/", async (c) => {
  const input = await parseJson(c.req.raw, quotationDraftInput);
  const db = getDb(c.env.DB);
  const [cust] = await db.select().from(customers).where(eq(customers.id, input.customerId)).limit(1);
  if (!cust) throw badRequest("Customer not found");

  if (input.contactPersonId) {
    const [cp] = await db
      .select()
      .from(customerContacts)
      .where(
        and(
          eq(customerContacts.id, input.contactPersonId),
          eq(customerContacts.customerId, input.customerId),
        ),
      )
      .limit(1);
    if (!cp) throw badRequest("contactPersonId does not belong to customer");
  }

  const computed = computeTotals({
    items: input.items,
    discountType: input.discountType,
    discountValue: input.discountValue,
    freightAmount: input.freightAmount,
  });

  const userId = c.get("userId") ?? null;
  const draftNo = `DRAFT-${Date.now()}`;
  const today = new Date().toISOString().slice(0, 10);

  const [head] = await db
    .insert(quotations)
    .values({
      quotationNo: draftNo,
      quotationDate: input.quotationDate ?? today,
      validityDays: input.validityDays,
      inquiryId: input.inquiryId ?? null,
      customerId: input.customerId,
      contactPersonId: input.contactPersonId ?? null,
      status: "draft",
      subtotal: computed.totals.subtotal,
      discountType: input.discountType,
      discountValue: input.discountValue,
      discountAmount: computed.totals.discountAmount,
      taxableAmount: computed.totals.taxableAmount,
      gstAmount: computed.totals.gstAmount,
      freightAmount: computed.totals.freightAmount,
      grandTotal: computed.totals.grandTotal,
      termsConditions: input.termsConditions ?? null,
      paymentTerms: input.paymentTerms ?? null,
      deliverySchedule: input.deliverySchedule ?? null,
      notes: input.notes ?? null,
      createdBy: userId,
      updatedBy: userId,
    })
    .returning();

  await db.insert(quotationItems).values(
    input.items.map((item, idx) => {
      const ci = computed.items[idx];
      return {
        quotationId: head.id,
        productId: item.productId ?? null,
        productName: item.productName,
        description: item.description ?? null,
        unitName: item.unitName ?? null,
        qty: ci.qty,
        unitPrice: ci.unitPrice,
        discountPercent: ci.discountPercent,
        gstRate: ci.gstRate,
        lineSubtotal: ci.lineSubtotal,
        lineGst: ci.lineGst,
        lineTotal: ci.lineTotal,
        sortOrder: item.sortOrder ?? idx,
      };
    }),
  );

  await logActivity(db, {
    entity: "quotation",
    entityId: head.id,
    action: "quotation.created",
    userId,
    payload: { customerId: input.customerId, items: input.items.length },
  });

  return c.json({ id: head.id, quotationNo: head.quotationNo, totals: computed.totals }, 201);
});

/* --------------------------------- UPDATE DRAFT ------------------------------- */

router.put("/:id", async (c) => {
  const id = parseId(c.req.param("id"));
  const input = await parseJson(c.req.raw, quotationDraftInput);

  const db = getDb(c.env.DB);
  const [existing] = await db.select().from(quotations).where(eq(quotations.id, id)).limit(1);
  if (!existing) throw notFound("Quotation not found");
  if (existing.status !== "draft") throw conflict("Only drafts can be edited");

  const computed = computeTotals({
    items: input.items,
    discountType: input.discountType,
    discountValue: input.discountValue,
    freightAmount: input.freightAmount,
  });

  const userId = c.get("userId") ?? null;
  await db
    .update(quotations)
    .set({
      customerId: input.customerId,
      contactPersonId: input.contactPersonId ?? null,
      quotationDate: input.quotationDate ?? existing.quotationDate,
      validityDays: input.validityDays,
      inquiryId: input.inquiryId ?? null,
      discountType: input.discountType,
      discountValue: input.discountValue,
      subtotal: computed.totals.subtotal,
      discountAmount: computed.totals.discountAmount,
      taxableAmount: computed.totals.taxableAmount,
      gstAmount: computed.totals.gstAmount,
      freightAmount: computed.totals.freightAmount,
      grandTotal: computed.totals.grandTotal,
      termsConditions: input.termsConditions ?? null,
      paymentTerms: input.paymentTerms ?? null,
      deliverySchedule: input.deliverySchedule ?? null,
      notes: input.notes ?? null,
      updatedBy: userId,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(quotations.id, id));

  await db.delete(quotationItems).where(eq(quotationItems.quotationId, id));
  await db.insert(quotationItems).values(
    input.items.map((item, idx) => {
      const ci = computed.items[idx];
      return {
        quotationId: id,
        productId: item.productId ?? null,
        productName: item.productName,
        description: item.description ?? null,
        unitName: item.unitName ?? null,
        qty: ci.qty,
        unitPrice: ci.unitPrice,
        discountPercent: ci.discountPercent,
        gstRate: ci.gstRate,
        lineSubtotal: ci.lineSubtotal,
        lineGst: ci.lineGst,
        lineTotal: ci.lineTotal,
        sortOrder: item.sortOrder ?? idx,
      };
    }),
  );

  await logActivity(db, {
    entity: "quotation",
    entityId: id,
    action: "quotation.updated",
    userId,
    payload: { items: input.items.length },
  });

  return c.json({ id, totals: computed.totals });
});

/* ----------------------------------- FINALIZE --------------------------------- */

router.post("/:id/finalize", async (c) => {
  const id = parseId(c.req.param("id"));
  const db = getDb(c.env.DB);
  const userId = c.get("userId") ?? null;
  const [existing] = await db.select().from(quotations).where(eq(quotations.id, id)).limit(1);
  if (!existing) throw notFound("Quotation not found");
  if (existing.status !== "draft") throw conflict("Already finalized");

  const year = new Date(existing.quotationDate || new Date().toISOString()).getFullYear();
  const quotationNo = await nextQuotationNo(c.env.DB, year);

  await db
    .update(quotations)
    .set({
      status: "final",
      quotationNo,
      updatedAt: new Date().toISOString(),
      updatedBy: userId,
    })
    .where(eq(quotations.id, id));

  await logActivity(db, {
    entity: "quotation",
    entityId: id,
    action: "quotation.finalized",
    userId,
    payload: { quotationNo },
  });

  // Trigger email automation — failures must not roll back finalization.
  let email: { status: string; error?: string } | null = null;
  try {
    const result = await sendQuotationEmailAutomation(c.env, id);
    email = { status: result.status };
  } catch (error) {
    email = {
      status: "failed",
      error: error instanceof Error ? error.message : "Quotation email failed",
    };
  }

  return c.json({ id, quotationNo, status: "final", email });
});

/* ------------------------------------ STATUS ---------------------------------- */

router.post("/:id/status", async (c) => {
  const id = parseId(c.req.param("id"));
  const input = await parseJson(c.req.raw, quotationStatusUpdate);
  const db = getDb(c.env.DB);
  const userId = c.get("userId") ?? null;
  const [existing] = await db.select().from(quotations).where(eq(quotations.id, id)).limit(1);
  if (!existing) throw notFound("Quotation not found");
  if (existing.status === "draft") throw conflict("Finalize first");

  const closedAt =
    input.status === "won" || input.status === "lost"
      ? new Date().toISOString()
      : existing.closedAt;

  await db
    .update(quotations)
    .set({
      status: input.status,
      closeReason: input.closeReason ?? null,
      closedAt,
      updatedAt: new Date().toISOString(),
      updatedBy: userId,
    })
    .where(eq(quotations.id, id));

  await logActivity(db, {
    entity: "quotation",
    entityId: id,
    action: `quotation.status.${input.status}`,
    userId,
    payload: input.closeReason ? { closeReason: input.closeReason } : null,
  });

  return c.json({ id, status: input.status });
});

/* ------------------------------------ CLONE ----------------------------------- */

router.post("/:id/clone", async (c) => {
  const id = parseId(c.req.param("id"));
  const db = getDb(c.env.DB);
  const userId = c.get("userId") ?? null;
  const [src] = await db.select().from(quotations).where(eq(quotations.id, id)).limit(1);
  if (!src) throw notFound("Quotation not found");
  const items = await db.select().from(quotationItems).where(eq(quotationItems.quotationId, id));

  const [head] = await db
    .insert(quotations)
    .values({
      quotationNo: `DRAFT-${Date.now()}`,
      quotationDate: new Date().toISOString().slice(0, 10),
      validityDays: src.validityDays,
      customerId: src.customerId,
      contactPersonId: src.contactPersonId,
      status: "draft",
      subtotal: src.subtotal,
      discountType: src.discountType,
      discountValue: src.discountValue,
      discountAmount: src.discountAmount,
      taxableAmount: src.taxableAmount,
      gstAmount: src.gstAmount,
      freightAmount: src.freightAmount,
      grandTotal: src.grandTotal,
      termsConditions: src.termsConditions,
      paymentTerms: src.paymentTerms,
      deliverySchedule: src.deliverySchedule,
      notes: src.notes,
      createdBy: userId,
      updatedBy: userId,
    })
    .returning();

  if (items.length) {
    await db.insert(quotationItems).values(
      items.map(({ id: _id, ...rest }) => ({ ...rest, quotationId: head.id })),
    );
  }

  await logActivity(db, {
    entity: "quotation",
    entityId: head.id,
    action: "quotation.cloned",
    userId,
    payload: { sourceId: id, sourceNo: src.quotationNo },
  });

  return c.json({ id: head.id, quotationNo: head.quotationNo, sourceId: id }, 201);
});

/* ------------------------------------- PDF ----------------------------------- */

router.post("/:id/pdf", async (c) => {
  const id = parseId(c.req.param("id"));
  const db = getDb(c.env.DB);
  const [head] = await db.select().from(quotations).where(eq(quotations.id, id)).limit(1);
  if (!head) throw notFound("Quotation not found");

  const pdf = await renderQuotationPdf(c.env, id);
  const key = `quotations/${head.id}/${head.quotationNo}-${Date.now()}.pdf`;
  await c.env.FILES.put(key, pdf, { httpMetadata: { contentType: "application/pdf" } });

  await db
    .update(quotations)
    .set({ pdfR2Key: key, updatedAt: new Date().toISOString() })
    .where(eq(quotations.id, id));

  return c.json({ key });
});

router.get("/:id/pdf", async (c) => {
  const id = parseId(c.req.param("id"));
  const db = getDb(c.env.DB);
  const [head] = await db.select().from(quotations).where(eq(quotations.id, id)).limit(1);
  if (!head?.pdfR2Key) throw notFound("No PDF generated yet");
  const obj = await c.env.FILES.get(head.pdfR2Key);
  if (!obj) throw notFound("PDF object missing in R2");
  return new Response(obj.body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${head.quotationNo}.pdf"`,
    },
  });
});

/* ------------------------------------- EMAIL --------------------------------- */

router.post("/:id/email", async (c) => {
  const id = parseId(c.req.param("id"));
  const input = await parseJson(c.req.raw, emailQuotationInput);
  const result = await sendQuotationEmailAutomation(c.env, id, input);
  await logActivity(getDb(c.env.DB), {
    entity: "quotation",
    entityId: id,
    action: "quotation.emailed",
    userId: c.get("userId") ?? null,
    payload: { status: result.status },
  });
  return c.json(result);
});

router.post("/:id/email/resend", async (c) => {
  const id = parseId(c.req.param("id"));
  const input = await parseJson(c.req.raw, emailQuotationInput);
  const result = await sendQuotationEmailAutomation(c.env, id, input);
  await logActivity(getDb(c.env.DB), {
    entity: "quotation",
    entityId: id,
    action: "quotation.email.resend",
    userId: c.get("userId") ?? null,
    payload: { status: result.status },
  });
  return c.json({ ...result, resend: true });
});

/* ------------------------- Notes timeline + activity feed -------------------- */

router.route("/", createTimelineRoutes("quotation"));

export const quotationsRoutes = router;
