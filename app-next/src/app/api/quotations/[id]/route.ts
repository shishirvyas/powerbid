import { NextRequest } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  quotations,
  quotationItems,
  customers,
  customerContacts,
} from "@/lib/db/schema";
import {
  ApiError,
  errorToResponse,
  jsonOk,
  parseId,
  parseJson,
  requireSession,
} from "@/lib/api";
import { generateQuotationReference } from "@/lib/quotation-reference";
import { quotationSchema } from "@/lib/schemas";
import { calcQuotation } from "@/lib/calc";
import { runIdempotentMutation } from "@/lib/idempotency";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    await requireSession();
    const id = parseId((await ctx.params).id);
    const [row] = await db
      .select({
        id: quotations.id,
        quotationNo: quotations.quotationNo,
        referenceNo: quotations.referenceNo,
        quotationDate: quotations.quotationDate,
        subject: quotations.subject,
        projectName: quotations.projectName,
        customerAttention: quotations.customerAttention,
        introText: quotations.introText,
        validityDays: quotations.validityDays,
        inquiryId: quotations.inquiryId,
        customerId: quotations.customerId,
        contactPersonId: quotations.contactPersonId,
        status: quotations.status,
        subjectTemplateId: quotations.subjectTemplateId,
        currency: quotations.currency,
        subtotal: quotations.subtotal,
        discountType: quotations.discountType,
        discountValue: quotations.discountValue,
        discountAmount: quotations.discountAmount,
        taxableAmount: quotations.taxableAmount,
        gstAmount: quotations.gstAmount,
        freightAmount: quotations.freightAmount,
        grandTotal: quotations.grandTotal,
        termsConditions: quotations.termsConditions,
        paymentTerms: quotations.paymentTerms,
        deliverySchedule: quotations.deliverySchedule,
        notes: quotations.notes,
        signatureMode: quotations.signatureMode,
        signatureData: quotations.signatureData,
        signatureName: quotations.signatureName,
        signatureDesignation: quotations.signatureDesignation,
        signatureMobile: quotations.signatureMobile,
        signatureEmail: quotations.signatureEmail,
        sentAt: quotations.sentAt,
        closedAt: quotations.closedAt,
        createdBy: quotations.createdBy,
        updatedBy: quotations.updatedBy,
        createdAt: quotations.createdAt,
        updatedAt: quotations.updatedAt,
      })
      .from(quotations)
      .where(eq(quotations.id, id));
    if (!row) throw new ApiError(404, "Quotation not found");
    const items = await db
      .select()
      .from(quotationItems)
      .where(eq(quotationItems.quotationId, id))
      .orderBy(asc(quotationItems.sortOrder));
    const [customer] = await db
      .select({
        id: customers.id,
        code: customers.code,
        name: customers.name,
        contactPerson: customers.contactPerson,
        email: customers.email,
        phone: customers.phone,
        gstin: customers.gstin,
        pan: customers.pan,
        addressLine1: customers.addressLine1,
        addressLine2: customers.addressLine2,
        city: customers.city,
        state: customers.state,
        pincode: customers.pincode,
        country: customers.country,
        notes: customers.notes,
        isActive: customers.isActive,
        createdAt: customers.createdAt,
        updatedAt: customers.updatedAt,
      })
      .from(customers)
      .where(eq(customers.id, row.customerId));
    let contact = null;
    if (row.contactPersonId) {
      const [c] = await db
        .select()
        .from(customerContacts)
        .where(eq(customerContacts.id, row.contactPersonId));
      contact = c ?? null;
    }
    return jsonOk({ ...row, items, customer, contact });
  } catch (err) {
    return errorToResponse(err);
  }
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireSession();
    const id = parseId((await ctx.params).id);
    const data = await parseJson(req, quotationSchema);
    return await runIdempotentMutation(
      {
        req,
        userId: session.userId,
        fingerprint: { id, data },
      },
      async () => {
        const [existing] = await db
          .select({ id: quotations.id, referenceNo: quotations.referenceNo })
          .from(quotations)
          .where(eq(quotations.id, id));
        if (!existing) throw new ApiError(404, "Quotation not found");
        const calc = calcQuotation({
          items: data.items,
          discountType: "percent",
          discountValue: 0,
          freightAmount: 0,
        });
        const referenceNo = await generateQuotationReference({
          customerId: data.customerId,
          quotationDate: data.quotationDate,
          quotationId: id,
          currentReferenceNo: existing.referenceNo,
        });
        const [row] = await db
          .update(quotations)
          .set({
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
            updatedBy: session.userId,
            updatedAt: new Date(),
          })
          .where(eq(quotations.id, id))
          .returning();
        await db.delete(quotationItems).where(eq(quotationItems.quotationId, id));
        await db.insert(quotationItems).values(
          calc.lines.map((l, i) => ({
            quotationId: id,
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
        return { data: row };
      },
    );
  } catch (err) {
    return errorToResponse(err);
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireSession();
    const id = parseId((await ctx.params).id);
    return await runIdempotentMutation(
      {
        req: _req,
        userId: session.userId,
        fingerprint: { id },
      },
      async () => {
        const [row] = await db.delete(quotations).where(eq(quotations.id, id)).returning();
        if (!row) throw new ApiError(404, "Quotation not found");
        return { data: { ok: true } };
      },
    );
  } catch (err) {
    return errorToResponse(err);
  }
}
