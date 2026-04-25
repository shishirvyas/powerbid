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
    sku: text("sku").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    brandId: integer("brand_id").references(() => brands.id),
    unitId: integer("unit_id").references(() => units.id),
    gstSlabId: integer("gst_slab_id").references(() => gstSlabs.id),
    basePrice: numeric("base_price", { precision: 12, scale: 2 }).notNull().default("0"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ uqSku: uniqueIndex("uq_products_sku").on(t.sku) }),
);

/* ----------------------------- inquiries ------------------------- */
export const inquiries = pgTable("inquiries", {
  id: serial("id").primaryKey(),
  inquiryNo: text("inquiry_no").notNull().unique(),
  customerId: integer("customer_id").references(() => customers.id, {
    onDelete: "set null",
  }),
  customerName: text("customer_name"),
  source: text("source").notNull().default("walkin"), // walkin/phone/email/web/other
  priority: text("priority").notNull().default("medium"), // low/medium/high/urgent
  status: text("status").notNull().default("new"), // new/in_progress/quoted/won/lost/closed
  requirement: text("requirement"),
  expectedClosure: text("expected_closure"),
  assignedTo: integer("assigned_to").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const inquiryItems = pgTable("inquiry_items", {
  id: serial("id").primaryKey(),
  inquiryId: integer("inquiry_id")
    .notNull()
    .references(() => inquiries.id, { onDelete: "cascade" }),
  productId: integer("product_id").references(() => products.id, { onDelete: "set null" }),
  productName: text("product_name").notNull(),
  qty: numeric("qty", { precision: 12, scale: 2 }).notNull().default("1"),
  remarks: text("remarks"),
});

/* ----------------------------- quotations ------------------------ */
export const quotations = pgTable("quotations", {
  id: serial("id").primaryKey(),
  quotationNo: text("quotation_no").notNull().unique(),
  quotationDate: text("quotation_date").notNull(),
  validityDays: integer("validity_days").notNull().default(15),
  inquiryId: integer("inquiry_id").references(() => inquiries.id, { onDelete: "set null" }),
  customerId: integer("customer_id")
    .notNull()
    .references(() => customers.id, { onDelete: "restrict" }),
  contactPersonId: integer("contact_person_id").references(() => customerContacts.id, {
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
  sentAt: text("sent_at"),
  closedAt: text("closed_at"),
  createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
  updatedBy: integer("updated_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const quotationItems = pgTable("quotation_items", {
  id: serial("id").primaryKey(),
  quotationId: integer("quotation_id")
    .notNull()
    .references(() => quotations.id, { onDelete: "cascade" }),
  productId: integer("product_id").references(() => products.id, { onDelete: "set null" }),
  productName: text("product_name").notNull(),
  unitName: text("unit_name"),
  qty: numeric("qty", { precision: 12, scale: 2 }).notNull().default("1"),
  unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull().default("0"),
  discountPercent: numeric("discount_percent", { precision: 5, scale: 2 }).notNull().default("0"),
  gstRate: numeric("gst_rate", { precision: 5, scale: 2 }).notNull().default("18"),
  lineSubtotal: numeric("line_subtotal", { precision: 14, scale: 2 }).notNull().default("0"),
  lineGst: numeric("line_gst", { precision: 14, scale: 2 }).notNull().default("0"),
  lineTotal: numeric("line_total", { precision: 14, scale: 2 }).notNull().default("0"),
  sortOrder: integer("sort_order").notNull().default(0),
});

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
