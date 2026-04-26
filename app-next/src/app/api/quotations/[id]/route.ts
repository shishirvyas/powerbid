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
import { quotationSchema } from "@/lib/schemas";
import { calcQuotation } from "@/lib/calc";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    await requireSession();
    const id = parseId((await ctx.params).id);
    const [row] = await db.select().from(quotations).where(eq(quotations.id, id));
    if (!row) throw new ApiError(404, "Quotation not found");
    const items = await db
      .select()
      .from(quotationItems)
      .where(eq(quotationItems.quotationId, id))
      .orderBy(asc(quotationItems.sortOrder));
    const [customer] = await db
      .select()
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
    const calc = calcQuotation({
      items: data.items,
      discountType: data.discountType,
      discountValue: data.discountValue,
      freightAmount: data.freightAmount,
    });
    const [row] = await db
      .update(quotations)
      .set({
        referenceNo: data.referenceNo ?? null,
        quotationDate: data.quotationDate,
        subject: data.subject ?? null,
        projectName: data.projectName ?? null,
        customerAttention: data.customerAttention ?? null,
        introText: data.introText ?? null,
        validityDays: data.validityDays,
        customerId: data.customerId,
        contactPersonId: data.contactPersonId ?? null,
        inquiryId: data.inquiryId ?? null,
        status: data.status,
        currency: data.currency,
        discountType: data.discountType,
        discountValue: String(data.discountValue),
        discountAmount: String(calc.discountAmount),
        subtotal: String(calc.subtotal),
        taxableAmount: String(calc.taxableAmount),
        gstAmount: String(calc.gstAmount),
        freightAmount: String(calc.freightAmount),
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
    if (!row) throw new ApiError(404, "Quotation not found");
    await db.delete(quotationItems).where(eq(quotationItems.quotationId, id));
    await db.insert(quotationItems).values(
      calc.lines.map((l, i) => ({
        quotationId: id,
        productId: l.productId ?? null,
        productName: l.productName,
        unitName: l.unitName ?? null,
        qtyBreakup: l.qtyBreakup ?? null,
        qty: String(l.qty),
        unitPrice: String(l.unitPrice),
        discountPercent: String(l.discountPercent),
        gstRate: String(l.gstRate),
        lineSubtotal: String(l.lineSubtotal),
        lineGst: String(l.lineGst),
        lineTotal: String(l.lineTotal),
        sortOrder: i,
      })),
    );
    return jsonOk(row);
  } catch (err) {
    return errorToResponse(err);
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    await requireSession();
    const id = parseId((await ctx.params).id);
    const [row] = await db.delete(quotations).where(eq(quotations.id, id)).returning();
    if (!row) throw new ApiError(404, "Quotation not found");
    return jsonOk({ ok: true });
  } catch (err) {
    return errorToResponse(err);
  }
}
