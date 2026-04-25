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
import { quotations, quotationItems, customers } from "../../db/schema";
import { computeTotals } from "./quotations.calc";
import { nextQuotationNo } from "./quotations.numbering";
import { renderQuotationPdf } from "../../services/pdf";
import { sendEmail } from "../../services/mailer";

const router = new Hono<AppEnv>();
router.use("*", requireAuth);

// ---------------------------------------------------------------------------
// LIST + SEARCH
// ---------------------------------------------------------------------------
router.get("/", async (c) => {
  const db = getDb(c.env.DB);
  const status = c.req.query("status");
  const q = c.req.query("q")?.trim();
  const limit = Math.min(Number(c.req.query("limit") ?? 50), 200);

  const where: any[] = [eq(quotations.isActive, true as unknown as boolean)];
  if (status) where.push(eq(quotations.status, status as any));
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

// ---------------------------------------------------------------------------
// GET ONE
// ---------------------------------------------------------------------------
router.get("/:id", async (c) => {
  const db = getDb(c.env.DB);
  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) return c.json({ error: "bad id" }, 400);

  const [row] = await db
    .select()
    .from(quotations)
    .leftJoin(customers, eq(customers.id, quotations.customerId))
    .where(eq(quotations.id, id))
    .limit(1);
  if (!row) return c.json({ error: "not found" }, 404);

  const items = await db
    .select()
    .from(quotationItems)
    .where(eq(quotationItems.quotationId, id))
    .orderBy(quotationItems.sortOrder);

  return c.json({
    quotation: row.quotations,
    customer: row.customers,
    items,
  });
});

// ---------------------------------------------------------------------------
// CREATE DRAFT
// ---------------------------------------------------------------------------
router.post("/", async (c) => {
  const parsed = quotationDraftInput.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "validation", issues: parsed.error.issues }, 400);
  const input = parsed.data;

  const db = getDb(c.env.DB);
  const [cust] = await db.select().from(customers).where(eq(customers.id, input.customerId)).limit(1);
  if (!cust) return c.json({ error: "customer not found" }, 400);

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

  return c.json({ id: head.id, quotationNo: head.quotationNo, totals: computed.totals }, 201);
});

// ---------------------------------------------------------------------------
// UPDATE DRAFT (full replace of items)
// ---------------------------------------------------------------------------
router.put("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) return c.json({ error: "bad id" }, 400);
  const parsed = quotationDraftInput.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "validation", issues: parsed.error.issues }, 400);
  const input = parsed.data;

  const db = getDb(c.env.DB);
  const [existing] = await db.select().from(quotations).where(eq(quotations.id, id)).limit(1);
  if (!existing) return c.json({ error: "not found" }, 404);
  if (existing.status !== "draft") return c.json({ error: "only drafts can be edited" }, 409);

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

  return c.json({ id, totals: computed.totals });
});

// ---------------------------------------------------------------------------
// FINALIZE — assigns Q-YYYY-####, locks from edits.
// ---------------------------------------------------------------------------
router.post("/:id/finalize", async (c) => {
  const id = Number(c.req.param("id"));
  const db = getDb(c.env.DB);
  const [existing] = await db.select().from(quotations).where(eq(quotations.id, id)).limit(1);
  if (!existing) return c.json({ error: "not found" }, 404);
  if (existing.status !== "draft") return c.json({ error: "already finalized" }, 409);

  const year = new Date(existing.quotationDate || new Date().toISOString()).getFullYear();
  const quotationNo = await nextQuotationNo(c.env.DB, year);

  await db
    .update(quotations)
    .set({
      status: "final",
      quotationNo,
      updatedAt: new Date().toISOString(),
      updatedBy: c.get("userId") ?? null,
    })
    .where(eq(quotations.id, id));

  return c.json({ id, quotationNo, status: "final" });
});

// ---------------------------------------------------------------------------
// STATUS UPDATE (sent / won / lost / expired)
// ---------------------------------------------------------------------------
router.post("/:id/status", async (c) => {
  const id = Number(c.req.param("id"));
  const parsed = quotationStatusUpdate.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "validation", issues: parsed.error.issues }, 400);

  const db = getDb(c.env.DB);
  const [existing] = await db.select().from(quotations).where(eq(quotations.id, id)).limit(1);
  if (!existing) return c.json({ error: "not found" }, 404);
  if (existing.status === "draft") return c.json({ error: "finalize first" }, 409);

  const closedAt =
    parsed.data.status === "won" || parsed.data.status === "lost"
      ? new Date().toISOString()
      : existing.closedAt;

  await db
    .update(quotations)
    .set({
      status: parsed.data.status,
      closeReason: parsed.data.closeReason ?? null,
      closedAt,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(quotations.id, id));

  return c.json({ id, status: parsed.data.status });
});

// ---------------------------------------------------------------------------
// CLONE — produces a new draft with the same items.
// ---------------------------------------------------------------------------
router.post("/:id/clone", async (c) => {
  const id = Number(c.req.param("id"));
  const db = getDb(c.env.DB);
  const [src] = await db.select().from(quotations).where(eq(quotations.id, id)).limit(1);
  if (!src) return c.json({ error: "not found" }, 404);
  const items = await db.select().from(quotationItems).where(eq(quotationItems.quotationId, id));

  const userId = c.get("userId") ?? null;
  const [head] = await db
    .insert(quotations)
    .values({
      quotationNo: `DRAFT-${Date.now()}`,
      quotationDate: new Date().toISOString().slice(0, 10),
      validityDays: src.validityDays,
      customerId: src.customerId,
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
  return c.json({ id: head.id }, 201);
});

// ---------------------------------------------------------------------------
// PDF — render via Browser Rendering, store in R2.
// ---------------------------------------------------------------------------
router.post("/:id/pdf", async (c) => {
  const id = Number(c.req.param("id"));
  const db = getDb(c.env.DB);
  const [head] = await db.select().from(quotations).where(eq(quotations.id, id)).limit(1);
  if (!head) return c.json({ error: "not found" }, 404);

  const pdf = await renderQuotationPdf(c.env, id);
  const key = `quotations/${head.id}/${head.quotationNo}-${Date.now()}.pdf`;
  await c.env.FILES.put(key, pdf, { httpMetadata: { contentType: "application/pdf" } });

  await db
    .update(quotations)
    .set({ pdfR2Key: key, updatedAt: new Date().toISOString() })
    .where(eq(quotations.id, id));

  return c.json({ key });
});

// Streaming download of stored PDF.
router.get("/:id/pdf", async (c) => {
  const id = Number(c.req.param("id"));
  const db = getDb(c.env.DB);
  const [head] = await db.select().from(quotations).where(eq(quotations.id, id)).limit(1);
  if (!head?.pdfR2Key) return c.json({ error: "no pdf yet" }, 404);
  const obj = await c.env.FILES.get(head.pdfR2Key);
  if (!obj) return c.json({ error: "missing object" }, 404);
  return new Response(obj.body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${head.quotationNo}.pdf"`,
    },
  });
});

// ---------------------------------------------------------------------------
// EMAIL — send PDF as attachment via MailChannels.
// ---------------------------------------------------------------------------
router.post("/:id/email", async (c) => {
  const id = Number(c.req.param("id"));
  const parsed = emailQuotationInput.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "validation", issues: parsed.error.issues }, 400);

  const db = getDb(c.env.DB);
  const [head] = await db.select().from(quotations).where(eq(quotations.id, id)).limit(1);
  if (!head) return c.json({ error: "not found" }, 404);
  if (head.status === "draft") return c.json({ error: "finalize before sending" }, 409);

  // Ensure PDF exists; (re)generate if missing.
  let key = head.pdfR2Key ?? null;
  if (!key) {
    const pdf = await renderQuotationPdf(c.env, id);
    key = `quotations/${head.id}/${head.quotationNo}-${Date.now()}.pdf`;
    await c.env.FILES.put(key, pdf, { httpMetadata: { contentType: "application/pdf" } });
    await db.update(quotations).set({ pdfR2Key: key }).where(eq(quotations.id, id));
  }

  const obj = await c.env.FILES.get(key);
  let attachmentB64: string | null = null;
  if (obj) {
    const buf = new Uint8Array(await obj.arrayBuffer());
    let bin = "";
    for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
    attachmentB64 = btoa(bin);
  }

  await sendEmail(c.env, {
    to: parsed.data.to,
    cc: parsed.data.cc,
    subject: parsed.data.subject,
    html: parsed.data.body,
    attachments: attachmentB64
      ? [
          {
            filename: `${head.quotationNo}.pdf`,
            content: attachmentB64,
            type: "application/pdf",
          },
        ]
      : undefined,
  });

  await db
    .update(quotations)
    .set({
      status: head.status === "final" ? "sent" : head.status,
      sentAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(quotations.id, id));

  return c.json({ ok: true });
});

export const quotationsRoutes = router;
