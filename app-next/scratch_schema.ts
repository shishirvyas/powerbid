
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
    createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
    updatedBy: integer("updated_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxSupplier: index("idx_po_supplier").on(t.supplierId),
    idxStatus: index("idx_po_status").on(t.status),
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
    rawMaterialId: integer("raw_material_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    qtyPerUnit: numeric("qty_per_unit", { precision: 14, scale: 4 }).notNull(),
    unitName: text("unit_name"),
    wastagePercent: numeric("wastage_percent", { precision: 5, scale: 2 }).notNull().default("0"),
    notes: text("notes"),
  },
  (t) => ({
    idxBom: index("idx_bom_items_bom").on(t.bomId),
  })
);
