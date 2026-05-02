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
    priority: text("priority"), // low | medium | high (legacy column, kept to prevent data loss)
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

/* ----------------------------- idempotency --------------------- */
export const apiIdempotency = pgTable(
  "api_idempotency",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    method: text("method").notNull(),
    path: text("path").notNull(),
    actionType: text("action_type"),
    key: text("key").notNull(),
    fingerprint: text("fingerprint"),
    status: text("status").notNull().default("processing"), // processing | completed
    responseStatus: integer("response_status"),
    responseBody: text("response_body"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uqRequest: uniqueIndex("uq_api_idempotency_request").on(
      t.userId,
      t.method,
      t.path,
      t.key,
    ),
    idxCreatedAt: index("idx_api_idempotency_created_at").on(t.createdAt),
  }),
);

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


/* ------------------------------ Suppliers ------------------------------ */
export const suppliers = pgTable(
  "suppliers",
  {
    id: serial("id").primaryKey(),
    code: text("code").notNull().unique(),
    companyName: text("company_name").notNull(),
    gstin: text("gstin"),
    pan: text("pan"),
    msmeStatus: text("msme_status"),
    paymentTerms: text("payment_terms"),
    email: text("email"),
    phone: text("phone"),
    rating: numeric("rating", { precision: 3, scale: 1 }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxCompanyName: index("idx_suppliers_company_name").on(t.companyName),
  }),
);

export const supplierContacts = pgTable(
  "supplier_contacts",
  {
    id: serial("id").primaryKey(),
    supplierId: integer("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    designation: text("designation"),
    email: text("email"),
    phone: text("phone"),
    isPrimary: boolean("is_primary").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ idx: index("idx_supplier_contacts_supplier").on(t.supplierId) }),
);

export const supplierAddresses = pgTable(
  "supplier_addresses",
  {
    id: serial("id").primaryKey(),
    supplierId: integer("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "cascade" }),
    type: text("type").notNull().default("billing"), // billing/shipping
    addressLine1: text("address_line1"),
    addressLine2: text("address_line2"),
    city: text("city"),
    state: text("state"),
    pincode: text("pincode"),
    country: text("country").notNull().default("IN"),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ idx: index("idx_supplier_addresses_supplier").on(t.supplierId) }),
);

export const supplierBankDetails = pgTable(
  "supplier_bank_details",
  {
    id: serial("id").primaryKey(),
    supplierId: integer("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "cascade" }),
    accountName: text("account_name").notNull(),
    accountNumber: text("account_number").notNull(),
    bankName: text("bank_name").notNull(),
    branchName: text("branch_name"),
    ifscCode: text("ifsc_code").notNull(),
    swiftCode: text("swift_code"),
    isPrimary: boolean("is_primary").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ idx: index("idx_supplier_bank_details_supplier").on(t.supplierId) }),
);

/* ----------------------------- supplier products ----------------- */
export const supplierProducts = pgTable(
  "supplier_products",
  {
    id: serial("id").primaryKey(),
    supplierId: integer("supplier_id").references(() => suppliers.id, { onDelete: "set null" }),
    code: text("code").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    unitId: integer("unit_id").references(() => units.id, { onDelete: "set null" }),
    unitName: text("unit_name"),
    standardPrice: numeric("standard_price", { precision: 14, scale: 2 }).notNull().default("0"),
    leadDays: integer("lead_days").notNull().default(0),
    hsnCode: text("hsn_code"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxSupplier: index("idx_supplier_products_supplier").on(t.supplierId),
    idxActive: index("idx_supplier_products_active").on(t.isActive),
    uqSupplierCode: uniqueIndex("uq_supplier_products_code").on(t.code),
  })
);

/* ----------------------------- purchase orders ------------------- */
export const purchaseOrders = pgTable(
  "purchase_orders",
  {
    id: serial("id").primaryKey(),
    poNumber: text("po_number").notNull().unique(),
    supplierId: integer("supplier_id").references(() => suppliers.id, { onDelete: "restrict" }),
    expectedDate: text("expected_date"),
    status: text("status").notNull().default("draft"), // draft/pending_approval/approved/sent/partial_received/closed/cancelled
    currency: text("currency").notNull().default("INR"),
    subtotal: numeric("subtotal", { precision: 14, scale: 2 }).notNull().default("0"),
    discountType: text("discount_type").notNull().default("percent"),
    discountValue: numeric("discount_value", { precision: 10, scale: 2 }).notNull().default("0"),
    discountAmount: numeric("discount_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    taxableAmount: numeric("taxable_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    gstAmount: numeric("gst_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    freightAmount: numeric("freight_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    grandTotal: numeric("grand_total", { precision: 14, scale: 2 }).notNull().default("0"),
    remarks: text("remarks"),
    termsConditions: text("terms_conditions"),
    paymentTerms: text("payment_terms"),
    approvalMode: text("approval_mode").notNull().default("workflow"), // workflow/self_with_scan
    approvedBy: integer("approved_by").references(() => users.id, { onDelete: "set null" }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    selfApprovalScanName: text("self_approval_scan_name"),
    selfApprovalScanPath: text("self_approval_scan_path"),
    selfApprovalScanUploadedBy: integer("self_approval_scan_uploaded_by").references(() => users.id, { onDelete: "set null" }),
    soId: integer("so_id").references(() => salesOrders.id, { onDelete: "set null" }),
    bomId: integer("bom_id").references(() => bomMaster.id, { onDelete: "set null" }),
    createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
    updatedBy: integer("updated_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxSupplier: index("idx_po_supplier").on(t.supplierId),
    idxStatus: index("idx_po_status").on(t.status),
    idxSo: index("idx_po_so").on(t.soId),
  })
);

export const purchaseOrderItems = pgTable(
  "purchase_order_items",
  {
    id: serial("id").primaryKey(),
    poId: integer("po_id")
      .notNull()
      .references(() => purchaseOrders.id, { onDelete: "cascade" }),
    productId: integer("product_id").references(() => products.id, { onDelete: "set null" }),
    productName: text("product_name").notNull(),
    unitName: text("unit_name"),
    qty: numeric("qty", { precision: 12, scale: 2 }).notNull().default("1"),
    receivedQty: numeric("received_qty", { precision: 12, scale: 2 }).notNull().default("0"),
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
    idxPo: index("idx_po_items_po").on(t.poId),
  })
);

export const purchaseApprovals = pgTable(
  "purchase_approvals",
  {
    id: serial("id").primaryKey(),
    poId: integer("po_id").notNull().references(() => purchaseOrders.id, { onDelete: "cascade" }),
    approverId: integer("approver_id").references(() => users.id, { onDelete: "set null" }),
    status: text("status").notNull().default("pending"), // pending/approved/rejected
    comments: text("comments"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ idxPo: index("idx_purchase_approvals_po").on(t.poId) })
);

/* ----------------------------- stock management ------------------ */
export const warehouses = pgTable("warehouses", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  location: text("location"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const stockItems = pgTable(
  "stock_items",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    warehouseId: integer("warehouse_id").notNull().references(() => warehouses.id, { onDelete: "cascade" }),
    qtyOnHand: numeric("qty_on_hand", { precision: 14, scale: 2 }).notNull().default("0"),
    qtyReserved: numeric("qty_reserved", { precision: 14, scale: 2 }).notNull().default("0"),
    qtyAvailable: numeric("qty_available", { precision: 14, scale: 2 }).notNull().default("0"),
    binLocation: text("bin_location"),
    reorderLevel: numeric("reorder_level", { precision: 14, scale: 2 }).notNull().default("0"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uqProductWarehouse: uniqueIndex("uq_stock_items_product_warehouse").on(t.productId, t.warehouseId),
  })
);

export const stockBatches = pgTable(
  "stock_batches",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    warehouseId: integer("warehouse_id").notNull().references(() => warehouses.id, { onDelete: "cascade" }),
    batchNumber: text("batch_number").notNull(),
    mfgDate: text("mfg_date"),
    expDate: text("exp_date"),
    qtyOnHand: numeric("qty_on_hand", { precision: 14, scale: 2 }).notNull().default("0"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uqBatch: uniqueIndex("uq_stock_batches_number").on(t.productId, t.warehouseId, t.batchNumber),
  })
);

export const stockMovements = pgTable(
  "stock_movements",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    warehouseId: integer("warehouse_id").notNull().references(() => warehouses.id, { onDelete: "cascade" }),
    batchId: integer("batch_id").references(() => stockBatches.id, { onDelete: "set null" }),
    movementType: text("movement_type").notNull(), // in/out/transfer/adjustment/return
    qty: numeric("qty", { precision: 14, scale: 2 }).notNull(),
    referenceType: text("reference_type"), // po/so/grn/adjustment
    referenceId: text("reference_id"),
    remarks: text("remarks"),
    createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxProductWarehouse: index("idx_stock_movements_product_warehouse").on(t.productId, t.warehouseId),
    idxCreatedAt: index("idx_stock_movements_created_at").on(t.createdAt),
  })
);

export const stockAdjustments = pgTable(
  "stock_adjustments",
  {
    id: serial("id").primaryKey(),
    adjustmentNumber: text("adjustment_number").notNull().unique(),
    warehouseId: integer("warehouse_id").notNull().references(() => warehouses.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("draft"), // draft/approved/completed
    reason: text("reason"),
    approvedBy: integer("approved_by").references(() => users.id, { onDelete: "set null" }),
    createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxWarehouse: index("idx_stock_adjustments_warehouse").on(t.warehouseId),
  })
);

/* ----------------------------- bom management -------------------- */
export const bomMaster = pgTable("bom_master", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  soId: integer("so_id").references(() => salesOrders.id, { onDelete: "set null" }),
  bomCode: text("bom_code").notNull().unique(),
  version: text("version").notNull().default("1.0"),
  isActive: boolean("is_active").notNull().default(true),
  laborCost: numeric("labor_cost", { precision: 14, scale: 2 }).notNull().default("0"),
  overheadCost: numeric("overhead_cost", { precision: 14, scale: 2 }).notNull().default("0"),
  notes: text("notes"),
  createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const bomItems = pgTable(
  "bom_items",
  {
    id: serial("id").primaryKey(),
    bomId: integer("bom_id").notNull().references(() => bomMaster.id, { onDelete: "cascade" }),
    rawMaterialId: integer("raw_material_id").references(() => products.id, { onDelete: "set null" }),
    supplierProductId: integer("supplier_product_id").references(() => supplierProducts.id, { onDelete: "set null" }),
    qtyPerUnit: numeric("qty_per_unit", { precision: 14, scale: 4 }).notNull(),
    unitName: text("unit_name"),
    wastagePercent: numeric("wastage_percent", { precision: 5, scale: 2 }).notNull().default("0"),
    notes: text("notes"),
  },
  (t) => ({
    idxBom: index("idx_bom_items_bom").on(t.bomId),
  })
);

export const productionOrders = pgTable(
  "production_orders",
  {
    id: serial("id").primaryKey(),
    productionNumber: text("production_number").notNull().unique(),
    bomId: integer("bom_id").references(() => bomMaster.id, { onDelete: "set null" }),
    productId: integer("product_id").notNull().references(() => products.id, { onDelete: "restrict" }),
    warehouseId: integer("warehouse_id").notNull().references(() => warehouses.id, { onDelete: "restrict" }),
    status: text("status").notNull().default("draft"), // draft/in_progress/completed/cancelled
    plannedQty: numeric("planned_qty", { precision: 14, scale: 2 }).notNull().default("0"),
    producedQty: numeric("produced_qty", { precision: 14, scale: 2 }).notNull().default("0"),
    startDate: text("start_date"),
    endDate: text("end_date"),
    notes: text("notes"),
    createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
    updatedBy: integer("updated_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxStatus: index("idx_production_orders_status").on(t.status),
    idxProduct: index("idx_production_orders_product").on(t.productId),
  }),
);

export const productionConsumption = pgTable(
  "production_consumption",
  {
    id: serial("id").primaryKey(),
    productionId: integer("production_id").notNull().references(() => productionOrders.id, { onDelete: "cascade" }),
    rawMaterialId: integer("raw_material_id").notNull().references(() => products.id, { onDelete: "restrict" }),
    qtyPlanned: numeric("qty_planned", { precision: 14, scale: 4 }).notNull().default("0"),
    qtyConsumed: numeric("qty_consumed", { precision: 14, scale: 4 }).notNull().default("0"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxProduction: index("idx_production_consumption_production").on(t.productionId),
  }),
);

export const productionOutput = pgTable(
  "production_output",
  {
    id: serial("id").primaryKey(),
    productionId: integer("production_id").notNull().references(() => productionOrders.id, { onDelete: "cascade" }),
    productId: integer("product_id").notNull().references(() => products.id, { onDelete: "restrict" }),
    warehouseId: integer("warehouse_id").notNull().references(() => warehouses.id, { onDelete: "restrict" }),
    qtyProduced: numeric("qty_produced", { precision: 14, scale: 4 }).notNull(),
    remarks: text("remarks"),
    createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxProduction: index("idx_production_output_production").on(t.productionId),
  }),
);

/* ----------------------------- sales orders ---------------------- */
export const salesOrders = pgTable(
  "sales_orders",
  {
    id: serial("id").primaryKey(),
    soNumber: text("so_number").notNull().unique(),
    orderDate: text("order_date").notNull(),
    quotationId: integer("quotation_id").references(() => quotations.id, { onDelete: "set null" }),
    customerId: integer("customer_id").notNull().references(() => customers.id, { onDelete: "restrict" }),
    status: text("status").notNull().default("draft"), // draft/confirmed/partially_dispatched/dispatched/cancelled
    currency: text("currency").notNull().default("INR"),
    subtotal: numeric("subtotal", { precision: 14, scale: 2 }).notNull().default("0"),
    discountAmount: numeric("discount_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    taxableAmount: numeric("taxable_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    gstAmount: numeric("gst_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    freightAmount: numeric("freight_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    grandTotal: numeric("grand_total", { precision: 14, scale: 2 }).notNull().default("0"),
    notes: text("notes"),
    createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
    updatedBy: integer("updated_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxCustomer: index("idx_sales_orders_customer").on(t.customerId),
    idxStatus: index("idx_sales_orders_status").on(t.status),
  }),
);

export const salesOrderItems = pgTable(
  "sales_order_items",
  {
    id: serial("id").primaryKey(),
    soId: integer("so_id").notNull().references(() => salesOrders.id, { onDelete: "cascade" }),
    productId: integer("product_id").references(() => products.id, { onDelete: "set null" }),
    productName: text("product_name").notNull(),
    unitName: text("unit_name"),
    qty: numeric("qty", { precision: 12, scale: 2 }).notNull().default("1"),
    dispatchedQty: numeric("dispatched_qty", { precision: 12, scale: 2 }).notNull().default("0"),
    unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull().default("0"),
    gstRate: numeric("gst_rate", { precision: 5, scale: 2 }).notNull().default("18"),
    lineSubtotal: numeric("line_subtotal", { precision: 14, scale: 2 }).notNull().default("0"),
    lineGst: numeric("line_gst", { precision: 14, scale: 2 }).notNull().default("0"),
    lineTotal: numeric("line_total", { precision: 14, scale: 2 }).notNull().default("0"),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => ({
    idxSo: index("idx_sales_order_items_so").on(t.soId),
  }),
);

export const dispatchOrders = pgTable(
  "dispatch_orders",
  {
    id: serial("id").primaryKey(),
    dispatchNumber: text("dispatch_number").notNull().unique(),
    soId: integer("so_id").notNull().references(() => salesOrders.id, { onDelete: "cascade" }),
    warehouseId: integer("warehouse_id").notNull().references(() => warehouses.id, { onDelete: "restrict" }),
    dispatchDate: text("dispatch_date").notNull(),
    status: text("status").notNull().default("draft"), // draft/dispatched/delivered/cancelled
    transporterName: text("transporter_name"),
    vehicleNumber: text("vehicle_number"),
    trackingNumber: text("tracking_number"),
    notes: text("notes"),
    createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxSo: index("idx_dispatch_orders_so").on(t.soId),
    idxWarehouse: index("idx_dispatch_orders_warehouse").on(t.warehouseId),
  }),
);

export const dispatchItems = pgTable(
  "dispatch_items",
  {
    id: serial("id").primaryKey(),
    dispatchId: integer("dispatch_id").notNull().references(() => dispatchOrders.id, { onDelete: "cascade" }),
    soItemId: integer("so_item_id").notNull().references(() => salesOrderItems.id, { onDelete: "cascade" }),
    productId: integer("product_id").references(() => products.id, { onDelete: "set null" }),
    qty: numeric("qty", { precision: 12, scale: 2 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxDispatch: index("idx_dispatch_items_dispatch").on(t.dispatchId),
    idxSoItem: index("idx_dispatch_items_so_item").on(t.soItemId),
  }),
);

/* ----------------------------- workflow engine ------------------- */
export const workflowInstances = pgTable(
  "workflow_instances",
  {
    id: serial("id").primaryKey(),
    tenantId: text("tenant_id").notNull().default("default"),
    entityType: text("entity_type").notNull(),
    entityId: integer("entity_id").notNull(),
    configVersion: integer("config_version").notNull().default(1),
    currentState: text("current_state").notNull(),
    createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
    updatedBy: integer("updated_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uqEntity: uniqueIndex("uq_workflow_instances_tenant_entity").on(t.tenantId, t.entityType, t.entityId),
    idxState: index("idx_workflow_instances_state").on(t.currentState),
  }),
);

export const workflowTransitionLogs = pgTable(
  "workflow_transition_logs",
  {
    id: serial("id").primaryKey(),
    tenantId: text("tenant_id").notNull().default("default"),
    workflowInstanceId: integer("workflow_instance_id")
      .notNull()
      .references(() => workflowInstances.id, { onDelete: "cascade" }),
    entityType: text("entity_type").notNull(),
    entityId: integer("entity_id").notNull(),
    action: text("action").notNull(),
    fromState: text("from_state").notNull(),
    toState: text("to_state").notNull(),
    userRole: text("user_role").notNull(),
    comment: text("comment"),
    metadata: text("metadata"),
    triggeredBy: integer("triggered_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxWorkflow: index("idx_workflow_transition_logs_workflow").on(t.workflowInstanceId),
    idxEntity: index("idx_workflow_transition_logs_entity").on(t.tenantId, t.entityType, t.entityId),
  }),
);

export const workflowEvents = pgTable(
  "workflow_events",
  {
    id: serial("id").primaryKey(),
    tenantId: text("tenant_id").notNull().default("default"),
    workflowInstanceId: integer("workflow_instance_id")
      .notNull()
      .references(() => workflowInstances.id, { onDelete: "cascade" }),
    entityType: text("entity_type").notNull(),
    entityId: integer("entity_id").notNull(),
    eventName: text("event_name").notNull(),
    payload: text("payload"),
    status: text("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    dispatchedAt: timestamp("dispatched_at", { withTimezone: true }),
  },
  (t) => ({
    idxStatus: index("idx_workflow_events_status").on(t.status),
    idxEntity: index("idx_workflow_events_entity").on(t.tenantId, t.entityType, t.entityId),
  }),
);

export const workflowVersions = pgTable(
  "workflow_versions",
  {
    id: serial("id").primaryKey(),
    tenantId: text("tenant_id").notNull().default("default"),
    entityType: text("entity_type").notNull(),
    entityId: integer("entity_id").notNull(),
    versionNo: integer("version_no").notNull(),
    isCurrent: boolean("is_current").notNull().default(true),
    snapshot: text("snapshot"),
    createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uqVersion: uniqueIndex("uq_workflow_versions_entity_version").on(
      t.tenantId,
      t.entityType,
      t.entityId,
      t.versionNo,
    ),
    idxCurrent: index("idx_workflow_versions_current").on(t.tenantId, t.entityType, t.entityId, t.isCurrent),
  }),
);

/* ----------------------------- rbac -------------------------------- */
export const roles = pgTable(
  "roles",
  {
    id: serial("id").primaryKey(),
    tenantId: text("tenant_id").notNull().default("default"),
    code: text("code").notNull(),
    name: text("name").notNull(),
    isSystem: boolean("is_system").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uqRoleCode: uniqueIndex("uq_roles_tenant_code").on(t.tenantId, t.code),
  }),
);

export const departments = pgTable(
  "departments",
  {
    id: serial("id").primaryKey(),
    tenantId: text("tenant_id").notNull().default("default"),
    code: text("code").notNull(),
    name: text("name").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uqDepartmentCode: uniqueIndex("uq_departments_tenant_code").on(t.tenantId, t.code),
  }),
);

export const userRoleBindings = pgTable(
  "user_role_bindings",
  {
    id: serial("id").primaryKey(),
    tenantId: text("tenant_id").notNull().default("default"),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roleId: integer("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    departmentId: integer("department_id").references(() => departments.id, {
      onDelete: "set null",
    }),
    scopeType: text("scope_type").notNull().default("department"),
    scopeRef: text("scope_ref"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxUserRole: index("idx_user_role_bindings_user").on(t.tenantId, t.userId),
  }),
);

export const workflowStateAccess = pgTable(
  "workflow_state_access",
  {
    id: serial("id").primaryKey(),
    tenantId: text("tenant_id").notNull().default("default"),
    workflowType: text("workflow_type").notNull(),
    stateCode: text("state_code").notNull(),
    roleId: integer("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    canView: boolean("can_view").notNull().default(true),
  },
  (t) => ({
    uqWorkflowStateRole: uniqueIndex("uq_workflow_state_access").on(
      t.tenantId,
      t.workflowType,
      t.stateCode,
      t.roleId,
    ),
  }),
);

export const workflowActionPermissions = pgTable(
  "workflow_action_permissions",
  {
    id: serial("id").primaryKey(),
    tenantId: text("tenant_id").notNull().default("default"),
    workflowType: text("workflow_type").notNull(),
    fromState: text("from_state").notNull(),
    actionCode: text("action_code").notNull(),
    toState: text("to_state"),
    roleId: integer("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    departmentId: integer("department_id").references(() => departments.id, {
      onDelete: "set null",
    }),
    effect: text("effect").notNull().default("allow"), // allow | deny
    guardKey: text("guard_key"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxWorkflowAction: index("idx_workflow_action_permissions_lookup").on(
      t.tenantId,
      t.workflowType,
      t.fromState,
      t.actionCode,
    ),
  }),
);

export const rbacDecisionAudit = pgTable(
  "rbac_decision_audit",
  {
    id: serial("id").primaryKey(),
    tenantId: text("tenant_id").notNull().default("default"),
    workflowType: text("workflow_type").notNull(),
    entityId: integer("entity_id").notNull(),
    currentState: text("current_state").notNull(),
    actionCode: text("action_code").notNull(),
    targetState: text("target_state").notNull(),
    actorUserId: integer("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    actorRole: text("actor_role").notNull(),
    departmentId: integer("department_id").references(() => departments.id, {
      onDelete: "set null",
    }),
    decision: text("decision").notNull(), // allow | deny
    reason: text("reason").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxWorkflowAudit: index("idx_rbac_decision_audit_workflow").on(
      t.tenantId,
      t.workflowType,
      t.entityId,
      t.createdAt,
    ),
  }),
);

/* ----------------------------- entity versioning -------------------- */

/**
 * entity_version_sets — one row per versioned entity (BOM, ORDER, etc.).
 * Acts as the anchor for all version rows.
 */
export const entityVersionSets = pgTable(
  "entity_version_sets",
  {
    id: serial("id").primaryKey(),
    tenantId: text("tenant_id").notNull().default("default"),
    entityType: text("entity_type").notNull(), // BOM | ORDER | PO
    entityId: integer("entity_id").notNull(),
    currentVersionId: integer("current_version_id"), // FK set after first version created
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uqEntity: uniqueIndex("uq_entity_version_sets").on(t.tenantId, t.entityType, t.entityId),
  }),
);

/**
 * entity_versions — immutable snapshot of entity data at a point in time.
 * Snapshot is stored as serialised JSON.
 */
export const entityVersions = pgTable(
  "entity_versions",
  {
    id: serial("id").primaryKey(),
    tenantId: text("tenant_id").notNull().default("default"),
    versionSetId: integer("version_set_id")
      .notNull()
      .references(() => entityVersionSets.id, { onDelete: "cascade" }),
    entityType: text("entity_type").notNull(),
    entityId: integer("entity_id").notNull(),
    versionNo: integer("version_no").notNull(),
    label: text("label"),          // e.g. "v1.0", "Revision after procurement hold"
    snapshot: text("snapshot").notNull(), // JSON blob of the entity at this version
    isCurrent: boolean("is_current").notNull().default(false),
    createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uqEntityVersion: uniqueIndex("uq_entity_versions_no").on(t.tenantId, t.entityType, t.entityId, t.versionNo),
    idxCurrent: index("idx_entity_versions_current").on(t.tenantId, t.entityType, t.entityId, t.isCurrent),
  }),
);

/**
 * entity_version_deltas — diff between two consecutive versions.
 * Computed and stored at version-creation time for fast querying.
 */
export const entityVersionDeltas = pgTable(
  "entity_version_deltas",
  {
    id: serial("id").primaryKey(),
    tenantId: text("tenant_id").notNull().default("default"),
    fromVersionId: integer("from_version_id")
      .notNull()
      .references(() => entityVersions.id, { onDelete: "cascade" }),
    toVersionId: integer("to_version_id")
      .notNull()
      .references(() => entityVersions.id, { onDelete: "cascade" }),
    delta: text("delta").notNull(), // JSON: { added, removed, changed } fields
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxDelta: index("idx_entity_version_deltas").on(t.fromVersionId, t.toVersionId),
  }),
);

/**
 * procurement_version_locks — records which version a procurement action resolved against.
 * Ensures procurement actions are always traceable to the exact entity version they used.
 */
export const procurementVersionLocks = pgTable(
  "procurement_version_locks",
  {
    id: serial("id").primaryKey(),
    tenantId: text("tenant_id").notNull().default("default"),
    procurementEntityType: text("procurement_entity_type").notNull(), // RFQ | PO
    procurementEntityId: integer("procurement_entity_id").notNull(),
    lockedVersionId: integer("locked_version_id")
      .notNull()
      .references(() => entityVersions.id, { onDelete: "restrict" }),
    lockedAt: timestamp("locked_at", { withTimezone: true }).notNull().defaultNow(),
    lockedBy: integer("locked_by").references(() => users.id, { onDelete: "set null" }),
  },
  (t) => ({
    uqProcurementLock: uniqueIndex("uq_procurement_version_locks").on(
      t.tenantId,
      t.procurementEntityType,
      t.procurementEntityId,
    ),
  }),
);

/**
 * version_audit_log — human-readable audit trail for all version-related operations.
 */
export const versionAuditLog = pgTable(
  "version_audit_log",
  {
    id: serial("id").primaryKey(),
    tenantId: text("tenant_id").notNull().default("default"),
    entityType: text("entity_type").notNull(),
    entityId: integer("entity_id").notNull(),
    versionId: integer("version_id").references(() => entityVersions.id, { onDelete: "set null" }),
    action: text("action").notNull(), // create_version | promote | lock | supersede
    actorUserId: integer("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    detail: text("detail"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxAuditEntity: index("idx_version_audit_log_entity").on(t.tenantId, t.entityType, t.entityId),
    idxAuditCreated: index("idx_version_audit_log_created").on(t.createdAt),
  }),
);

/* ====================================================================
 * CHANGE PROPAGATION
 * ====================================================================
 *
 * changePropagationEvents — one record per BOM version change event.
 *   Captures which BOM changed, to which version, and whether the
 *   downstream impact analysis has been completed.
 *
 * changeImpactRecords — one record per impacted downstream entity
 *   (production_order | purchase_order).  Tracks revision status,
 *   auto-action taken, and acknowledgement by a human actor.
 *
 * changeNotifications — pending notifications to send to role owners
 *   about specific impact records that need attention.
 */

export const changePropagationEvents = pgTable(
  "change_propagation_events",
  {
    id: serial("id").primaryKey(),
    tenantId: text("tenant_id").notNull().default("default"),
    /** BOM that changed — references bomMaster.id */
    bomId: integer("bom_id").notNull().references(() => bomMaster.id, { onDelete: "cascade" }),
    /** The new entity version that triggered this event */
    newVersionId: integer("new_version_id").references(() => entityVersions.id, { onDelete: "set null" }),
    /** Status of the propagation run */
    status: text("status").notNull().default("pending"), // pending | running | completed | failed
    impactCount: integer("impact_count").notNull().default(0),
    triggeredBy: integer("triggered_by").references(() => users.id, { onDelete: "set null" }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    errorDetail: text("error_detail"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxBom: index("idx_change_propagation_events_bom").on(t.tenantId, t.bomId),
    idxStatus: index("idx_change_propagation_events_status").on(t.status),
  }),
);

export const changeImpactRecords = pgTable(
  "change_impact_records",
  {
    id: serial("id").primaryKey(),
    tenantId: text("tenant_id").notNull().default("default"),
    propagationEventId: integer("propagation_event_id")
      .notNull()
      .references(() => changePropagationEvents.id, { onDelete: "cascade" }),
    /** What kind of downstream entity was impacted */
    impactedEntityType: text("impacted_entity_type").notNull(), // production_order | purchase_order
    impactedEntityId: integer("impacted_entity_id").notNull(),
    /** Human-readable description of why this record is impacted */
    impactReason: text("impact_reason").notNull(),
    /** Current revision status */
    revisionStatus: text("revision_status").notNull().default("needs_revision"), // needs_revision | acknowledged | resolved | auto_actioned
    /** If an auto-action was taken, record what was done */
    autoAction: text("auto_action"), // none | flagged | cancelled_draft | ...
    autoActionDetail: text("auto_action_detail"),
    /** Human acknowledgement */
    acknowledgedBy: integer("acknowledged_by").references(() => users.id, { onDelete: "set null" }),
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
    resolvedBy: integer("resolved_by").references(() => users.id, { onDelete: "set null" }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolutionNote: text("resolution_note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxEvent: index("idx_change_impact_records_event").on(t.propagationEventId),
    idxEntity: index("idx_change_impact_records_entity").on(
      t.tenantId, t.impactedEntityType, t.impactedEntityId,
    ),
    idxRevisionStatus: index("idx_change_impact_records_revision").on(t.revisionStatus),
  }),
);

export const changeNotifications = pgTable(
  "change_notifications",
  {
    id: serial("id").primaryKey(),
    tenantId: text("tenant_id").notNull().default("default"),
    impactRecordId: integer("impact_record_id")
      .notNull()
      .references(() => changeImpactRecords.id, { onDelete: "cascade" }),
    /** Role that should receive this notification */
    targetRole: text("target_role").notNull(),
    targetUserId: integer("target_user_id").references(() => users.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    body: text("body").notNull(),
    isRead: boolean("is_read").notNull().default(false),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxImpact: index("idx_change_notifications_impact").on(t.impactRecordId),
    idxUser: index("idx_change_notifications_user").on(t.targetUserId),
    idxUnread: index("idx_change_notifications_unread").on(t.tenantId, t.isRead),
  }),
);

