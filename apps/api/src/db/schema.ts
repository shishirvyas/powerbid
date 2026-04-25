import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, real, index } from "drizzle-orm/sqlite-core";

const audit = {
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  createdBy: integer("created_by"),
  updatedBy: integer("updated_by"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
};

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: text("role", { enum: ["admin", "sales", "viewer"] }).notNull().default("sales"),
  ...audit,
});

export const gstSlabs = sqliteTable("gst_slabs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  rate: real("rate").notNull(),
  ...audit,
});

export const units = sqliteTable("units", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  ...audit,
});

export const brands = sqliteTable("brands", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  ...audit,
});

export const products = sqliteTable(
  "products",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sku: text("sku").notNull().unique(),
    name: text("name").notNull(),
    description: text("description"),
    brandId: integer("brand_id").references(() => brands.id),
    unitId: integer("unit_id").references(() => units.id),
    gstSlabId: integer("gst_slab_id").references(() => gstSlabs.id),
    basePrice: real("base_price").notNull().default(0),
    ...audit,
  },
  (t) => ({ nameIdx: index("idx_products_name").on(t.name) }),
);

export const customers = sqliteTable(
  "customers",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    code: text("code").notNull().unique(),
    name: text("name").notNull(),
    contactPerson: text("contact_person"),
    email: text("email"),
    phone: text("phone"),
    gstin: text("gstin"),
    addressLine1: text("address_line1"),
    addressLine2: text("address_line2"),
    city: text("city"),
    state: text("state"),
    pincode: text("pincode"),
    ...audit,
  },
  (t) => ({ nameIdx: index("idx_customers_name").on(t.name) }),
);

export const emailTemplates = sqliteTable("email_templates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  ...audit,
});

export const inquiries = sqliteTable(
  "inquiries",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    inquiryNo: text("inquiry_no").notNull().unique(),
    customerId: integer("customer_id").references(() => customers.id),
    customerName: text("customer_name"),
    source: text("source", { enum: ["walkin", "phone", "email", "web", "other"] })
      .notNull().default("walkin"),
    priority: text("priority", { enum: ["low", "medium", "high", "urgent"] })
      .notNull().default("medium"),
    status: text("status", { enum: ["new", "in_progress", "quoted", "won", "lost", "closed"] })
      .notNull().default("new"),
    requirement: text("requirement"),
    expectedClosure: text("expected_closure"),
    assignedTo: integer("assigned_to").references(() => users.id),
    ...audit,
  },
  (t) => ({
    statusIdx: index("idx_inquiries_status").on(t.status),
    custIdx: index("idx_inquiries_customer").on(t.customerId),
  }),
);

export const inquiryItems = sqliteTable("inquiry_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  inquiryId: integer("inquiry_id").notNull().references(() => inquiries.id, { onDelete: "cascade" }),
  productId: integer("product_id").references(() => products.id),
  productName: text("product_name").notNull(),
  qty: real("qty").notNull().default(1),
  remarks: text("remarks"),
});

export const quotations = sqliteTable(
  "quotations",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    quotationNo: text("quotation_no").notNull().unique(),
    quotationDate: text("quotation_date").notNull().default(sql`CURRENT_DATE`),
    validityDays: integer("validity_days").notNull().default(15),
    inquiryId: integer("inquiry_id").references(() => inquiries.id),
    customerId: integer("customer_id").notNull().references(() => customers.id),
    status: text("status", { enum: ["draft", "final", "sent", "won", "lost", "expired"] })
      .notNull().default("draft"),
    subtotal: real("subtotal").notNull().default(0),
    discountType: text("discount_type", { enum: ["percent", "amount"] }).notNull().default("percent"),
    discountValue: real("discount_value").notNull().default(0),
    discountAmount: real("discount_amount").notNull().default(0),
    taxableAmount: real("taxable_amount").notNull().default(0),
    gstAmount: real("gst_amount").notNull().default(0),
    freightAmount: real("freight_amount").notNull().default(0),
    grandTotal: real("grand_total").notNull().default(0),
    termsConditions: text("terms_conditions"),
    paymentTerms: text("payment_terms"),
    deliverySchedule: text("delivery_schedule"),
    contactPersonId: integer("contact_person_id"),
    notes: text("notes"),
    pdfR2Key: text("pdf_r2_key"),
    sentAt: text("sent_at"),
    followupAt: text("followup_at"),
    closedAt: text("closed_at"),
    closeReason: text("close_reason"),
    ...audit,
  },
  (t) => ({
    statusIdx: index("idx_quotations_status").on(t.status),
    custIdx: index("idx_quotations_customer").on(t.customerId),
    dateIdx: index("idx_quotations_date").on(t.quotationDate),
  }),
);

export const quotationItems = sqliteTable("quotation_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  quotationId: integer("quotation_id").notNull().references(() => quotations.id, { onDelete: "cascade" }),
  productId: integer("product_id").references(() => products.id),
  productName: text("product_name").notNull(),
  description: text("description"),
  unitName: text("unit_name"),
  qty: real("qty").notNull().default(1),
  unitPrice: real("unit_price").notNull().default(0),
  discountPercent: real("discount_percent").notNull().default(0),
  gstRate: real("gst_rate").notNull().default(0),
  lineSubtotal: real("line_subtotal").notNull().default(0),
  lineGst: real("line_gst").notNull().default(0),
  lineTotal: real("line_total").notNull().default(0),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const followups = sqliteTable("followups", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  quotationId: integer("quotation_id").notNull().references(() => quotations.id, { onDelete: "cascade" }),
  scheduledAt: text("scheduled_at").notNull(),
  status: text("status", { enum: ["pending", "done", "skipped"] }).notNull().default("pending"),
  channel: text("channel", { enum: ["email", "call", "meeting"] }).notNull().default("email"),
  notes: text("notes"),
  ...audit,
});

export const auditLog = sqliteTable("audit_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  entity: text("entity").notNull(),
  entityId: integer("entity_id").notNull(),
  action: text("action").notNull(),
  userId: integer("user_id"),
  payload: text("payload"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const customerContacts = sqliteTable(
  "customer_contacts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    customerId: integer("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    designation: text("designation"),
    email: text("email"),
    phone: text("phone"),
    isPrimary: integer("is_primary", { mode: "boolean" }).notNull().default(false),
    ...audit,
  },
  (t) => ({ custIdx: index("idx_contacts_customer").on(t.customerId) }),
);

/**
 * Generic notes timeline — entity is "customer" | "inquiry" | "quotation".
 * Kept separate from audit_log so user-authored prose stays distinct from
 * system-generated activity events.
 */
export const notes = sqliteTable(
  "notes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    entity: text("entity").notNull(),
    entityId: integer("entity_id").notNull(),
    body: text("body").notNull(),
    createdBy: integer("created_by"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => ({ entityIdx: index("idx_notes_entity").on(t.entity, t.entityId) }),
);
