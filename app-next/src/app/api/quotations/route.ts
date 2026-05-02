import { NextRequest } from "next/server";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { quotations, quotationItems, customers } from "@/lib/db/schema";
import {
  ApiError,
  errorToResponse,
  jsonOk, jsonList,
  parseJson,
  parseSearch,
  requireSession,
} from "@/lib/api";
import { generateQuotationReference } from "@/lib/quotation-reference";
import { quotationListQuerySchema, quotationSchema } from "@/lib/schemas";
import { calcQuotation } from "@/lib/calc";
import { runIdempotentMutation } from "@/lib/idempotency";

export const runtime = "nodejs";

async function nextQuotationNo(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `Q-${year}-`;
  const rows = await db
    .select({ max: sql<string | null>`max(${quotations.quotationNo})` })
    .from(quotations)
    .where(ilike(quotations.quotationNo, `${prefix}%`));
  const max = rows[0]?.max ?? null;
  const lastNum = max ? Number(max.slice(prefix.length)) : 0;
  const next = String((Number.isFinite(lastNum) ? lastNum : 0) + 1).padStart(4, "0");
  return `${prefix}${next}`;
}

export async function GET(req: NextRequest) {
  try {
    const session = await requireSession();
    const { q, limit, offset, status, ownerId, customerId, overdueFollowup, ageBucket, slaState } = parseSearch(new URL(req.url), quotationListQuerySchema);
    const clauses = [];
    if (q) {
      clauses.push(
        or(
          ilike(quotations.quotationNo, `%${q}%`),
          ilike(customers.name, `%${q}%`),
        ),
      );
    }
    if (status) clauses.push(eq(quotations.status, status));
    if (ownerId) clauses.push(eq(quotations.createdBy, ownerId));
    if (customerId) clauses.push(eq(quotations.customerId, customerId));
    if (overdueFollowup) {
      clauses.push(sql`${quotations.status} = 'sent' and coalesce(nullif(${quotations.sentAt}, '')::timestamptz, ${quotations.createdAt}) + interval '3 days' < now()`);
    }
    if (slaState === "within") {
      clauses.push(sql`${quotations.status} = 'sent' and coalesce(nullif(${quotations.sentAt}, '')::timestamptz, ${quotations.createdAt}) + interval '3 days' > now() + interval '12 hours'`);
    }
    if (slaState === "near") {
      clauses.push(sql`${quotations.status} = 'sent' and coalesce(nullif(${quotations.sentAt}, '')::timestamptz, ${quotations.createdAt}) + interval '3 days' between now() and now() + interval '12 hours'`);
    }
    if (slaState === "breached") {
      clauses.push(sql`${quotations.status} = 'sent' and coalesce(nullif(${quotations.sentAt}, '')::timestamptz, ${quotations.createdAt}) + interval '3 days' < now()`);
    }
    if (ageBucket === "0_2") {
      clauses.push(sql`${quotations.createdAt} > now() - interval '3 days'`);
    }
    if (ageBucket === "3_7") {
      clauses.push(sql`${quotations.createdAt} <= now() - interval '3 days' and ${quotations.createdAt} > now() - interval '8 days'`);
    }
    if (ageBucket === "8_15") {
      clauses.push(sql`${quotations.createdAt} <= now() - interval '8 days' and ${quotations.createdAt} > now() - interval '16 days'`);
    }
    if (ageBucket === "15_plus") {
      clauses.push(sql`${quotations.createdAt} <= now() - interval '16 days'`);
    }
    const where = clauses.length ? and(...clauses) : undefined;
    const rows = await db
      .select({
        id: quotations.id,
        quotationNo: quotations.quotationNo,
        quotationDate: quotations.quotationDate,
        status: quotations.status,
        currency: quotations.currency,
        grandTotal: quotations.grandTotal,
        customerId: quotations.customerId,
        customerName: customers.name,
        createdAt: quotations.createdAt,
      })
      .from(quotations)
      .leftJoin(customers, eq(quotations.customerId, customers.id))
      .where(where)
      .orderBy(desc(quotations.createdAt))
      .limit(limit)
      .offset(offset);
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(quotations)
      .leftJoin(customers, eq(quotations.customerId, customers.id))
      .where(where);
    void session;
    return jsonList({ rows, total: count, limit, offset });
  } catch (err) {
    return errorToResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const data = await parseJson(req, quotationSchema);
    return await runIdempotentMutation(
      {
        req,
        userId: session.userId,
        fingerprint: data,
      },
      async () => {
        const calc = calcQuotation({
          items: data.items,
          discountType: "percent",
          discountValue: 0,
          freightAmount: 0,
        });
        const quotationNo = await nextQuotationNo();
        const referenceNo = await generateQuotationReference({
          customerId: data.customerId,
          quotationDate: data.quotationDate,
          currentReferenceNo: data.referenceNo ?? null,
        });
        const [row] = await db
          .insert(quotations)
          .values({
            quotationNo,
            referenceNo,
            quotationDate: data.quotationDate,
            subject: data.subject ?? null,
            projectName: data.projectName ?? null,
            customerAttention: data.customerAttention ?? null,
            introText: data.introText ?? null,
            validityDays: data.validityDays,
            customerId: data.customerId,
            contactPersonId: data.contactPersonId ?? null,
            inquiryId: data.inquiryId ?? null,
            subjectTemplateId: data.subjectTemplateId ?? null,
            status: "draft",
            currency: "INR",
            discountType: "percent",
            discountValue: "0",
            discountAmount: String(calc.discountAmount),
            subtotal: String(calc.subtotal),
            taxableAmount: String(calc.taxableAmount),
            gstAmount: String(calc.gstAmount),
            freightAmount: "0",
            grandTotal: String(calc.grandTotal),
            termsConditions: data.termsConditions ?? null,
            paymentTerms: data.paymentTerms ?? null,
            deliverySchedule: data.deliverySchedule ?? null,
            notes: data.notes ?? null,
            signatureMode: data.signatureMode ?? null,
            signatureData: data.signatureData ?? null,
            signatureName: data.signatureName ?? null,
            signatureDesignation: data.signatureDesignation ?? null,
            signatureMobile: data.signatureMobile ?? null,
            signatureEmail: data.signatureEmail ?? null,
            createdBy: session.userId,
            updatedBy: session.userId,
          })
          .returning();
        await db.insert(quotationItems).values(
          calc.lines.map((l, i) => ({
            quotationId: row.id,
            productId: l.productId ?? null,
            productName: l.productName,
            unitName: l.unitName ?? null,
            qtyBreakup: null,
            qty: String(l.qty),
            unitPrice: String(l.unitPrice),
            discountPercent: "0",
            gstRate: String(l.gstRate),
            gstSlabId: data.items[i]?.gstSlabId ?? null,
            lineSubtotal: String(l.lineSubtotal),
            lineGst: String(l.lineGst),
            lineTotal: String(l.lineTotal),
            sortOrder: i,
          })),
        );
        return { data: row, status: 201 };
      },
    );
  } catch (err) {
    return errorToResponse(err);
  }
}
