import { z } from "zod";

const optionalString = z
  .string()
  .trim()
  .max(500)
  .nullish()
  .transform((v) => (v ? v : null));

// For multi-line free-text fields (terms & conditions, notes, requirement,
// payment terms, delivery schedule, intro paragraph). No length cap is
// enforced from the form so users can paste long boilerplate clauses.
const longText = z
  .string()
  .trim()
  .max(20000)
  .nullish()
  .transform((v) => (v ? v : null));

const requiredString = (label: string, max = 200) =>
  z.string().trim().min(1, `${label} is required`).max(max);

const numericString = z
  .union([z.string(), z.number()])
  .transform((v) => String(v))
  .refine((v) => v.length > 0 && !Number.isNaN(Number(v)), "Must be a number");

/* ------------------------------ customers ------------------------------ */
export const customerSchema = z.object({
  code: requiredString("Code", 50),
  name: requiredString("Name"),
  contactPerson: optionalString,
  email: z.string().email().optional().or(z.literal("")).transform((v) => v || null),
  phone: optionalString,
  gstin: optionalString,
  pan: optionalString,
  addressLine1: optionalString,
  addressLine2: optionalString,
  city: optionalString,
  state: optionalString,
  pincode: optionalString,
  country: z.string().trim().max(2).default("IN"),
  notes: optionalString,
  isActive: z.boolean().default(true),
});
export type CustomerInput = z.infer<typeof customerSchema>;

/* ------------------------------ products ------------------------------- */
export const productSchema = z.object({
  sku: requiredString("SKU", 80),
  name: requiredString("Name"),
  description: optionalString,
  brandId: z.coerce.number().int().positive().nullable().optional(),
  unitId: z.coerce.number().int().positive().nullable().optional(),
  gstSlabId: z.coerce.number().int().positive().nullable().optional(),
  basePrice: numericString.default("0"),
  isActive: z.boolean().default(true),
});
export type ProductInput = z.infer<typeof productSchema>;

/* ------------------------------ inquiries ------------------------------ */
export const inquirySchema = z.object({
  customerId: z.coerce.number().int().positive().nullable().optional(),
  customerName: optionalString,
  source: z.enum(["walkin", "phone", "email", "web", "other"]).default("walkin"),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  status: z
    .enum(["new", "in_progress", "quoted", "won", "lost", "closed"])
    .default("new"),
  requirement: longText,
  expectedClosure: optionalString,
  assignedTo: z.coerce.number().int().positive().nullable().optional(),
  items: z
    .array(
      z.object({
        productId: z.coerce.number().int().positive().nullable().optional(),
        productName: requiredString("Product"),
        qty: numericString.default("1"),
        remarks: optionalString,
      }),
    )
    .default([]),
});
export type InquiryInput = z.infer<typeof inquirySchema>;

/* ------------------------------ quotations ----------------------------- */
export const quotationItemSchema = z.object({
  productId: z.coerce.number().int().positive().nullable().optional(),
  productName: requiredString("Product"),
  unitName: optionalString,
  qtyBreakup: z
    .string()
    .trim()
    .max(2000)
    .nullish()
    .transform((v) => (v ? v : null)),
  qty: z.coerce.number().nonnegative().default(1),
  unitPrice: z.coerce.number().nonnegative().default(0),
  discountPercent: z.coerce.number().min(0).max(100).default(0),
  gstRate: z.coerce.number().min(0).max(100).default(18),
});

export const quotationSchema = z.object({
  referenceNo: optionalString,
  quotationDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")
    .default(() => new Date().toISOString().slice(0, 10)),
  subject: optionalString,
  projectName: optionalString,
  customerAttention: optionalString,
  introText: longText,
  validityDays: z.coerce.number().int().min(0).max(365).default(15),
  customerId: z.coerce.number().int().positive(),
  contactPersonId: z.coerce.number().int().positive().nullable().optional(),
  inquiryId: z.coerce.number().int().positive().nullable().optional(),
  status: z
    .enum(["draft", "sent", "won", "lost", "expired", "cancelled"])
    .default("draft"),
  currency: z.string().trim().min(3).max(3).default("INR"),
  discountType: z.enum(["percent", "amount"]).default("percent"),
  discountValue: z.coerce.number().min(0).default(0),
  freightAmount: z.coerce.number().min(0).default(0),
  termsConditions: longText,
  paymentTerms: longText,
  deliverySchedule: longText,
  notes: longText,
  signatureMode: z.enum(["upload", "draw", "typed"]).nullable().optional(),
  signatureData: z.string().trim().max(1000000).nullable().optional(),
  signatureName: optionalString,
  signatureDesignation: optionalString,
  signatureMobile: optionalString,
  signatureEmail: z.string().email().optional().or(z.literal("")).transform((v) => v || null),
  items: z.array(quotationItemSchema).min(1, "Add at least one line item"),
});
export type QuotationInput = z.infer<typeof quotationSchema>;
export type QuotationItemInput = z.infer<typeof quotationItemSchema>;

export const quotationDispatchSchema = z.object({
  channel: z.enum(["email", "whatsapp"]),
  to: z.string().trim().min(1, "Recipient is required").max(120),
  subject: z.string().trim().max(200).optional(),
  message: z.string().trim().max(5000).optional(),
  attachPdf: z.boolean().optional().default(true),
});
export type QuotationDispatchInput = z.infer<typeof quotationDispatchSchema>;

export const communicationTemplateSchema = z.object({
  channel: z.enum(["email", "whatsapp"]),
  templateKey: z.string().trim().min(1).max(50).default("quotation_send"),
  name: z.string().trim().min(1).max(120),
  subject: z.string().trim().max(200).optional().or(z.literal("")).transform((v) => v || null),
  body: z.string().trim().min(1).max(5000),
  isActive: z.boolean().default(true),
});
export type CommunicationTemplateInput = z.infer<typeof communicationTemplateSchema>;

export const smtpTestSchema = z.object({
  to: z.string().email(),
});
export type SmtpTestInput = z.infer<typeof smtpTestSchema>;

/* ------------------------------ masters -------------------------------- */
export const brandSchema = z.object({
  name: requiredString("Name", 100),
  isActive: z.boolean().default(true),
});
export const unitSchema = z.object({
  code: requiredString("Code", 20),
  name: requiredString("Name", 60),
  isActive: z.boolean().default(true),
});
export const gstSchema = z.object({
  name: requiredString("Name", 50),
  rate: numericString,
  isActive: z.boolean().default(true),
});

/* ----------------------------- list query ------------------------------ */
export const listQuerySchema = z.object({
  q: z.string().optional().default(""),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});
