import { z } from "zod";

export const quotationItemInput = z.object({
  productId: z.number().int().positive().nullable().optional(),
  productName: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  unitName: z.string().max(50).nullable().optional(),
  qty: z.number().nonnegative(),
  unitPrice: z.number().nonnegative(),
  discountPercent: z.number().min(0).max(100).default(0),
  gstRate: z.number().min(0).max(100).default(0),
  sortOrder: z.number().int().nonnegative().default(0),
});

export type QuotationItemInput = z.infer<typeof quotationItemInput>;

export const quotationDraftInput = z
  .object({
    customerId: z.number().int().positive(),
    quotationDate: z.string().optional(), // ISO date
    validityDays: z.number().int().min(1).max(365).default(15),
    inquiryId: z.number().int().positive().nullable().optional(),
    discountType: z.enum(["percent", "amount"]).default("percent"),
    discountValue: z.number().min(0).default(0),
    freightAmount: z.number().min(0).default(0),
    termsConditions: z.string().max(5000).nullable().optional(),
    notes: z.string().max(2000).nullable().optional(),
    items: z.array(quotationItemInput).min(1, "At least one item is required"),
  })
  .strict();

export type QuotationDraftInput = z.infer<typeof quotationDraftInput>;

export const quotationStatus = z.enum([
  "draft",
  "final",
  "sent",
  "won",
  "lost",
  "expired",
]);
export type QuotationStatus = z.infer<typeof quotationStatus>;

export const quotationStatusUpdate = z
  .object({
    status: quotationStatus,
    closeReason: z.string().max(500).optional(),
  })
  .strict();

export const emailQuotationInput = z
  .object({
    to: z.string().email(),
    cc: z.string().email().optional(),
    subject: z.string().min(1).max(300),
    body: z.string().min(1).max(20000),
  })
  .strict();
export type EmailQuotationInput = z.infer<typeof emailQuotationInput>;

export interface QuotationTotals {
  subtotal: number;
  discountAmount: number;
  taxableAmount: number;
  gstAmount: number;
  freightAmount: number;
  grandTotal: number;
}
