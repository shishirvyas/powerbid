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

/* ------------------------------ suppliers ------------------------------ */
export const supplierSchema = z.object({
  code: z
    .string()
    .trim()
    .max(50)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v && v.trim().length > 0 ? v.trim() : null)),
  companyName: requiredString("Company Name"),
  gstin: optionalString,
  pan: optionalString,
  msmeStatus: optionalString,
  paymentTerms: optionalString,
  email: z.string().email().optional().or(z.literal("")).transform((v) => v || null),
  phone: optionalString,
  rating: z.coerce.number().min(0).max(5).optional().nullable(),
  isActive: z.boolean().default(true),
});
export type SupplierInput = z.infer<typeof supplierSchema>;

export const supplierContactSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  name: requiredString("Contact Name"),
  designation: optionalString,
  email: z.string().email().optional().or(z.literal("")).transform((v) => v || null),
  phone: optionalString,
  isPrimary: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export const supplierAddressSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  type: z.enum(["billing", "shipping"]).default("billing"),
  addressLine1: optionalString,
  addressLine2: optionalString,
  city: optionalString,
  state: optionalString,
  pincode: optionalString,
  country: z.string().trim().max(2).default("IN"),
  isDefault: z.boolean().default(false),
});

export const supplierBankDetailSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  accountName: requiredString("Account Name", 200),
  accountNumber: requiredString("Account Number", 80),
  bankName: requiredString("Bank Name", 200),
  branchName: optionalString,
  ifscCode: requiredString("IFSC", 20),
  swiftCode: optionalString,
  isPrimary: z.boolean().default(false),
});

export const supplierProfileSchema = supplierSchema.extend({
  contacts: z.array(supplierContactSchema).default([]),
  addresses: z.array(supplierAddressSchema).default([]),
  bankDetails: z.array(supplierBankDetailSchema).default([]),
});
export type SupplierProfileInput = z.infer<typeof supplierProfileSchema>;

/* ------------------------------ purchase orders ------------------------ */
export const purchaseOrderItemSchema = z.object({
  productId: z.coerce.number().int().positive().nullable().optional(),
  productName: requiredString("Product"),
  unitName: optionalString,
  qty: z.coerce.number().nonnegative().default(1),
  unitPrice: z.coerce.number().nonnegative().default(0),
  discountPercent: z.coerce.number().min(0).max(100).default(0),
  gstRate: z.coerce.number().min(0).max(100).default(18),
  gstSlabId: z.coerce.number().int().positive().nullable().optional(),
});

export const purchaseOrderSchema = z.object({
  supplierId: z.coerce.number().int().positive(),
  expectedDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")
    .optional()
    .or(z.literal("")).transform((v) => v || null),
  status: z
    .enum(["draft", "pending_approval", "approved", "sent", "partial_received", "closed", "cancelled"])
    .default("draft"),
  currency: z.string().trim().min(3).max(3).default("INR"),
  discountType: z.enum(["percent", "amount"]).default("percent"),
  discountValue: z.coerce.number().min(0).default(0),
  freightAmount: z.coerce.number().min(0).default(0),
  remarks: optionalString,
  termsConditions: longText,
  paymentTerms: longText,
  items: z.array(purchaseOrderItemSchema).min(1, "Add at least one line item"),
});
export type PurchaseOrderInput = z.infer<typeof purchaseOrderSchema>;
export type PurchaseOrderItemInput = z.infer<typeof purchaseOrderItemSchema>;

/* ------------------------------ warehouses ----------------------------- */
export const warehouseSchema = z.object({
  code: requiredString("Code", 50),
  name: requiredString("Name"),
  location: optionalString,
  isActive: z.boolean().default(true),
});
export type WarehouseInput = z.infer<typeof warehouseSchema>;

export const stockItemSchema = z.object({
  productId: z.coerce.number().int().positive(),
  warehouseId: z.coerce.number().int().positive(),
  binLocation: optionalString,
  reorderLevel: z.coerce.number().min(0).default(0),
  // For manual initialization:
  initialQty: z.coerce.number().min(0).optional(),
});
export type StockItemInput = z.infer<typeof stockItemSchema>;

export const stockMovementTxnSchema = z.object({
  movementType: z.enum(["in", "out", "transfer"]),
  qty: z.coerce.number().positive(),
  targetWarehouseId: z.coerce.number().int().positive().optional(),
  referenceType: optionalString,
  referenceId: optionalString,
  remarks: optionalString,
});
export type StockMovementTxnInput = z.infer<typeof stockMovementTxnSchema>;

/* ------------------------------ BOM ------------------------------------ */
export const bomItemSchema = z.object({
  rawMaterialId: z.coerce.number().int().positive(),
  rawMaterialName: optionalString,
  qtyPerUnit: z.coerce.number().positive(),
  unitName: optionalString,
  wastagePercent: z.coerce.number().min(0).max(100).default(0),
  notes: optionalString,
});

export const bomMasterSchema = z.object({
  productId: z.coerce.number().int().positive(),
  bomCode: requiredString("BOM Code", 50),
  version: requiredString("Version", 20).default("1.0"),
  isActive: z.boolean().default(true),
  laborCost: z.coerce.number().min(0).default(0),
  overheadCost: z.coerce.number().min(0).default(0),
  notes: optionalString,
  items: z.array(bomItemSchema).min(1, "Add at least one raw material"),
});
export type BomMasterInput = z.infer<typeof bomMasterSchema>;
export type BomItemInput = z.infer<typeof bomItemSchema>;

/* ------------------------------ production ----------------------------- */
export const productionOrderSchema = z.object({
  bomId: z.coerce.number().int().positive().nullable().optional(),
  productId: z.coerce.number().int().positive(),
  warehouseId: z.coerce.number().int().positive(),
  plannedQty: z.coerce.number().positive(),
  notes: optionalString,
});
export type ProductionOrderInput = z.infer<typeof productionOrderSchema>;

export const productionConsumeSchema = z.object({
  rawMaterialId: z.coerce.number().int().positive(),
  qty: z.coerce.number().positive(),
  remarks: optionalString,
});
export type ProductionConsumeInput = z.infer<typeof productionConsumeSchema>;

export const productionCompleteSchema = z.object({
  qtyProduced: z.coerce.number().positive(),
  remarks: optionalString,
});
export type ProductionCompleteInput = z.infer<typeof productionCompleteSchema>;

/* ------------------------------ products ------------------------------- */
export const productSchema = z.object({
  sku: optionalString,
  name: requiredString("Name"),
  description: optionalString,
  unitId: z.coerce.number().int().positive().nullable().optional(),
  hsmCode: optionalString,
});
export type ProductInput = z.infer<typeof productSchema>;

/* ------------------------------ inquiries ------------------------------ */
export const inquirySchema = z.object({
  customerId: z.coerce.number().int().positive(),
  customerName: optionalString,
  source: z.enum(["walkin", "phone", "email", "web", "other"]).default("walkin"),
  status: z
    .enum(["new", "in_progress", "quoted", "won", "lost", "closed"])
    .default("new"),
  dateOfInquiry: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")
    .default(() => new Date().toISOString().slice(0, 10)),
  referenceNumber: optionalString,
  requirement: longText,
  expectedClosure: optionalString,
  assignedTo: z.coerce.number().int().positive().nullable().optional(),
  items: z
    .array(
      z.object({
        productId: z.coerce.number().int().positive(),
        productName: requiredString("Product"),
        unitName: optionalString,
        qty: z.coerce.number().int().positive().default(1).transform((v) => String(v)),
        remarks: optionalString,
      }),
    )
    .default([]),
});
export type InquiryInput = z.infer<typeof inquirySchema>;

/* ------------------------------ quotations ----------------------------- */
export const quotationItemSchema = z.object({
  productId: z.coerce.number().int().positive(),
  productName: requiredString("Product"),
  unitName: optionalString,
  qty: z.coerce.number().int().positive().default(1),
  unitPrice: z.coerce.number().nonnegative().default(0),
  gstRate: z.coerce.number().min(0).max(100).default(18),
  gstSlabId: z.coerce.number().int().positive().nullable().optional(),
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
  subjectTemplateId: z.coerce.number().int().positive().nullable().optional(),
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
  signatureMode: z.enum(["upload", "draw", "typed", "blank"]).nullable().optional(),
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

/* ------------------------------ sales orders --------------------------- */
export const salesOrderItemSchema = z.object({
  productId: z.coerce.number().int().positive().nullable().optional(),
  productName: requiredString("Product"),
  unitName: optionalString,
  qty: z.coerce.number().positive().default(1),
  unitPrice: z.coerce.number().nonnegative().default(0),
  gstRate: z.coerce.number().min(0).max(100).default(18),
});

export const salesOrderSchema = z.object({
  orderDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")
    .default(() => new Date().toISOString().slice(0, 10)),
  quotationId: z.coerce.number().int().positive().nullable().optional(),
  customerId: z.coerce.number().int().positive(),
  status: z.enum(["draft", "confirmed", "partially_dispatched", "dispatched", "cancelled"]).default("draft"),
  notes: optionalString,
  items: z.array(salesOrderItemSchema).min(1, "Add at least one line item"),
});
export type SalesOrderInput = z.infer<typeof salesOrderSchema>;
export type SalesOrderItemInput = z.infer<typeof salesOrderItemSchema>;

export const salesDispatchSchema = z.object({
  warehouseId: z.coerce.number().int().positive(),
  dispatchDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")
    .default(() => new Date().toISOString().slice(0, 10)),
  transporterName: optionalString,
  vehicleNumber: optionalString,
  trackingNumber: optionalString,
  notes: optionalString,
  items: z
    .array(
      z.object({
        soItemId: z.coerce.number().int().positive(),
        qty: z.coerce.number().positive(),
      }),
    )
    .min(1, "Add at least one dispatch item"),
});
export type SalesDispatchInput = z.infer<typeof salesDispatchSchema>;

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

const isoDateParam = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")
  .optional();

const truthyParam = z
  .enum(["true", "false"])
  .optional()
  .transform((value) => value === "true");

export const dashboardOverviewQuerySchema = z.object({
  startDate: isoDateParam,
  endDate: isoDateParam,
  preset: z.enum(["7d", "30d", "this_month", "6m"]).optional().default("30d"),
  ownerId: z.coerce.number().int().positive().optional(),
  customerId: z.coerce.number().int().positive().optional(),
  source: z.enum(["walkin", "phone", "email", "web", "other"]).optional(),
  statusGroup: z.enum(["open", "closed", "won", "lost", "active"]).optional(),
});
export type DashboardOverviewQuery = z.infer<typeof dashboardOverviewQuerySchema>;

export const quotationListQuerySchema = listQuerySchema.extend({
  status: z.enum(["draft", "sent", "won", "lost", "expired", "cancelled"]).optional(),
  ownerId: z.coerce.number().int().positive().optional(),
  customerId: z.coerce.number().int().positive().optional(),
  overdueFollowup: truthyParam,
  ageBucket: z.enum(["0_2", "3_7", "8_15", "15_plus"]).optional(),
  slaState: z.enum(["within", "near", "breached"]).optional(),
});
export type QuotationListQuery = z.infer<typeof quotationListQuerySchema>;

export const inquiryListQuerySchema = listQuerySchema.extend({
  status: z.enum(["new", "in_progress", "quoted", "won", "lost", "closed"]).optional(),
  ownerId: z.coerce.number().int().positive().optional(),
  customerId: z.coerce.number().int().positive().optional(),
  source: z.enum(["walkin", "phone", "email", "web", "other"]).optional(),
  needsQuotation: truthyParam,
  unassigned: truthyParam,
  ageBucket: z.enum(["0_2", "3_7", "8_15", "15_plus"]).optional(),
  slaState: z.enum(["within", "near", "breached"]).optional(),
});
export type InquiryListQuery = z.infer<typeof inquiryListQuerySchema>;
