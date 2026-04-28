import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  numeric,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/* ----------------------------- users ----------------------------- */
export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    name: text("name").notNull(),
    role: text("role").notNull().default("sales"), // 'admin' | 'sales' | 'viewer'
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ uqEmail: uniqueIndex("uq_users_email").on(t.email) }),
);

/* ----------------------------- masters --------------------------- */
export const brands = pgTable("brands", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  isActive: boolean("is_active").notNull().default(true),
});

export const units = pgTable("units", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  isActive: boolean("is_active").notNull().default(true),
});

export const gstSlabs = pgTable("gst_slabs", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  rate: numeric("rate", { precision: 5, scale: 2 }).notNull(),
  isActive: boolean("is_active").notNull().default(true),
});

/* ----------------------------- customers ------------------------- */
export const customers = pgTable(
  "customers",
  {
    id: serial("id").primaryKey(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    contactPerson: text("contact_person"),
    email: text("email"),
    phone: text("phone"),
    gstin: text("gstin"),
    pan: text("pan"),
    addressLine1: text("address_line1"),
    addressLine2: text("address_line2"),
    city: text("city"),
    state: text("state"),
    pincode: text("pincode"),
    country: text("country").notNull().default("IN"),
    notes: text("notes"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uqCode: uniqueIndex("uq_customers_code").on(t.code),
    idxName: index("idx_customers_name").on(t.name),
  }),
);

export const customerContacts = pgTable(
  "customer_contacts",
  {
    id: serial("id").primaryKey(),
    customerId: integer("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    designation: text("designation"),
    email: text("email"),
    phone: text("phone"),
    isPrimary: boolean("is_primary").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ idx: index("idx_contacts_customer").on(t.customerId) }),
);

/* ----------------------------- products -------------------------- */
export const products = pgTable(
  "products",
  {
    id: serial("id").primaryKey(),
    sku: text("sku"),
    name: text("name").notNull(),
    description: text("description"),
    unitId: integer("unit_id").references(() => units.id),
    hsmCode: text("hsm_code"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ uqSku: uniqueIndex("uq_products_sku").on(t.sku) }),
);

/* ----------------------------- inquiries ------------------------- */
export const inquiries = pgTable(
  "inquiries",
  {
    id: serial("id").primaryKey(),
    inquiryNo: text("inquiry_no").notNull().unique(),
    customerId: integer("customer_id").references(() => customers.id, {
      onDelete: "set null",
    }),
    customerName: text("customer_name"),
    source: text("source").notNull().default("walkin"), // walkin/phone/email/web/other
    status: text("status").notNull().default("new"), // new/in_progress/quoted/won/lost/closed
    requirement: text("requirement"),
    expectedClosure: text("expected_closure"),
      dateOfInquiry: text("date_of_inquiry"),
      referenceNumber: text("reference_number"),
    assignedTo: integer("assigned_to").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxCustomer: index("idx_inquiries_customer").on(t.customerId),
    idxStatus: index("idx_inquiries_status").on(t.status),
    idxCreatedAt: index("idx_inquiries_created_at").on(t.createdAt),
  }),
);

export const inquiryItems = pgTable(
  "inquiry_items",
  {
    id: serial("id").primaryKey(),
    inquiryId: integer("inquiry_id")
      .notNull()
      .references(() => inquiries.id, { onDelete: "cascade" }),
    productId: integer("product_id").references(() => products.id, { onDelete: "set null" }),
    productName: text("product_name").notNull(),
    unitName: text("unit_name"),
    qty: numeric("qty", { precision: 12, scale: 2 }).notNull().default("1"),
    remarks: text("remarks"),
  },
  (t) => ({
    idxInquiry: index("idx_inquiry_items_inquiry").on(t.inquiryId),
  }),
);

/* ----------------------------- quotations ------------------------ */
export const quotations = pgTable(
  "quotations",
  {
    id: serial("id").primaryKey(),
    quotationNo: text("quotation_no").notNull().unique(),
    referenceNo: text("reference_no"),
    quotationDate: text("quotation_date").notNull(),
    subject: text("subject"),
    projectName: text("project_name"),
    customerAttention: text("customer_attention"),
    introText: text("intro_text"),
    validityDays: integer("validity_days").notNull().default(15),
    inquiryId: integer("inquiry_id").references(() => inquiries.id, { onDelete: "set null" }),
    customerId: integer("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    contactPersonId: integer("contact_person_id").references(() => customerContacts.id, {
      onDelete: "set null",
    }),
    subjectTemplateId: integer("subject_template_id").references(() => subjectTemplates.id, {
      onDelete: "set null",
    }),
    status: text("status").notNull().default("draft"),
    currency: text("currency").notNull().default("INR"),
    subtotal: numeric("subtotal", { precision: 14, scale: 2 }).notNull().default("0"),
    discountType: text("discount_type").notNull().default("percent"),
    discountValue: numeric("discount_value", { precision: 10, scale: 2 }).notNull().default("0"),
    discountAmount: numeric("discount_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    taxableAmount: numeric("taxable_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    gstAmount: numeric("gst_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    freightAmount: numeric("freight_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    grandTotal: numeric("grand_total", { precision: 14, scale: 2 }).notNull().default("0"),
    termsConditions: text("terms_conditions"),
    paymentTerms: text("payment_terms"),
    deliverySchedule: text("delivery_schedule"),
    notes: text("notes"),
    signatureMode: text("signature_mode"),
    signatureData: text("signature_data"),
    signatureName: text("signature_name"),
    signatureDesignation: text("signature_designation"),
    signatureMobile: text("signature_mobile"),
    signatureEmail: text("signature_email"),
    sentAt: text("sent_at"),
    closedAt: text("closed_at"),
    createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
    updatedBy: integer("updated_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxCustomer: index("idx_quotations_customer").on(t.customerId),
    idxInquiry: index("idx_quotations_inquiry").on(t.inquiryId),
    idxStatus: index("idx_quotations_status").on(t.status),
    idxCreatedAt: index("idx_quotations_created_at").on(t.createdAt),
  }),
);

export const quotationItems = pgTable(
  "quotation_items",
  {
    id: serial("id").primaryKey(),
    quotationId: integer("quotation_id")
      .notNull()
      .references(() => quotations.id, { onDelete: "cascade" }),
    productId: integer("product_id").references(() => products.id, { onDelete: "set null" }),
    productName: text("product_name").notNull(),
    unitName: text("unit_name"),
    qtyBreakup: text("qty_breakup"),
    qty: numeric("qty", { precision: 12, scale: 2 }).notNull().default("1"),
    unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull().default("0"),
    discountPercent: numeric("discount_percent", { precision: 5, scale: 2 }).notNull().default("0"),
    gstRate: numeric("gst_rate", { precision: 5, scale: 2 }).notNull().default("18"),
    gstSlabId: integer("gst_slab_id").references(() => gstSlabs.id, { onDelete: "set null" }),
    lineSubtotal: numeric("line_subtotal", { precision: 14, scale: 2 }).notNull().default("0"),
    lineGst: numeric("line_gst", { precision: 14, scale: 2 }).notNull().default("0"),
    lineTotal: numeric("line_total", { precision: 14, scale: 2 }).notNull().default("0"),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => ({
    idxQuotation: index("idx_quotation_items_quotation").on(t.quotationId),
    idxQuotationSort: index("idx_quotation_items_sort").on(t.quotationId, t.sortOrder),
  }),
);

/* ----------------------------- notes / audit --------------------- */
export const notes = pgTable("notes", {
  id: serial("id").primaryKey(),
  entity: text("entity").notNull(),
  entityId: integer("entity_id").notNull(),
  body: text("body").notNull(),
  createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const auditLog = pgTable("audit_log", {
  id: serial("id").primaryKey(),
  entity: text("entity").notNull(),
  entityId: integer("entity_id").notNull(),
  action: text("action").notNull(),
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  payload: text("payload"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const communicationLogs = pgTable(
  "communication_logs",
  {
    id: serial("id").primaryKey(),
    entity: text("entity").notNull(),
    entityId: integer("entity_id").notNull(),
    channel: text("channel").notNull(), // email | whatsapp
    status: text("status").notNull().default("queued"), // queued | sent | failed
    recipient: text("recipient").notNull(),
    subject: text("subject"),
    message: text("message"),
    providerMessageId: text("provider_message_id"),
    providerPayload: text("provider_payload"),
    error: text("error"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxEntity: index("idx_comm_logs_entity").on(t.entity, t.entityId),
    idxChannel: index("idx_comm_logs_channel").on(t.channel),
  }),
);

export const communicationTemplates = pgTable(
  "communication_templates",
  {
    id: serial("id").primaryKey(),
    channel: text("channel").notNull(), // email | whatsapp
    templateKey: text("template_key").notNull(), // quotation_send
    name: text("name").notNull(),
    subject: text("subject"),
    body: text("body").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    updatedBy: integer("updated_by").references(() => users.id, { onDelete: "set null" }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uqTemplate: uniqueIndex("uq_comm_templates_channel_key").on(t.channel, t.templateKey),
    idxActive: index("idx_comm_templates_active").on(t.isActive),
  }),
);

/* --------------------- Subject Templates Master ---------------------- */
export const subjectTemplates = pgTable(
  "subject_templates",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull().unique(),
    subjectText: text("subject_text").notNull(),
    introParagraph: text("intro_paragraph"),
    isDefault: boolean("is_default").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uqName: uniqueIndex("uq_subject_templates_name").on(t.name),
    idxDefault: index("idx_subject_templates_is_default").on(t.isDefault),
  }),
);

/* -------------------- Quotation Attachments ----------------------- */
export const quotationAttachments = pgTable(
  "quotation_attachments",
  {
    id: serial("id").primaryKey(),
    quotationId: integer("quotation_id")
      .notNull()
      .references(() => quotations.id, { onDelete: "cascade" }),
    fileName: text("file_name").notNull(),
    filePath: text("file_path").notNull(),
    fileSize: integer("file_size"),
    mimeType: text("mime_type"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxQuotation: index("idx_quotation_attachments_quotation").on(t.quotationId),
  }),
);
