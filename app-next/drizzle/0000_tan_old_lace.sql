CREATE TABLE IF NOT EXISTS "audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"entity" text NOT NULL,
	"entity_id" integer NOT NULL,
	"action" text NOT NULL,
	"user_id" integer,
	"payload" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "brands" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "brands_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "communication_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"entity" text NOT NULL,
	"entity_id" integer NOT NULL,
	"channel" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"recipient" text NOT NULL,
	"subject" text,
	"message" text,
	"provider_message_id" text,
	"provider_payload" text,
	"error" text,
	"sent_at" timestamp with time zone,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "communication_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"channel" text NOT NULL,
	"template_key" text NOT NULL,
	"name" text NOT NULL,
	"subject" text,
	"body" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"updated_by" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customer_contacts" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"name" text NOT NULL,
	"designation" text,
	"email" text,
	"phone" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customers" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"contact_person" text,
	"email" text,
	"phone" text,
	"gstin" text,
	"pan" text,
	"address_line1" text,
	"address_line2" text,
	"city" text,
	"state" text,
	"pincode" text,
	"country" text DEFAULT 'IN' NOT NULL,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "gst_slabs" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"rate" numeric(5, 2) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inquiries" (
	"id" serial PRIMARY KEY NOT NULL,
	"inquiry_no" text NOT NULL,
	"customer_id" integer,
	"customer_name" text,
	"source" text DEFAULT 'walkin' NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"requirement" text,
	"expected_closure" text,
	"date_of_inquiry" text,
	"reference_number" text,
	"assigned_to" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inquiries_inquiry_no_unique" UNIQUE("inquiry_no")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inquiry_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"inquiry_id" integer NOT NULL,
	"product_id" integer,
	"product_name" text NOT NULL,
	"unit_name" text,
	"qty" numeric(12, 2) DEFAULT '1' NOT NULL,
	"remarks" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"entity" text NOT NULL,
	"entity_id" integer NOT NULL,
	"body" text NOT NULL,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"sku" text,
	"name" text NOT NULL,
	"description" text,
	"unit_id" integer,
	"hsm_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "purchase_approvals" (
	"id" serial PRIMARY KEY NOT NULL,
	"po_id" integer NOT NULL,
	"approver_id" integer,
	"status" text DEFAULT 'pending' NOT NULL,
	"comments" text,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "purchase_order_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"po_id" integer NOT NULL,
	"product_id" integer,
	"product_name" text NOT NULL,
	"unit_name" text,
	"qty" numeric(12, 2) DEFAULT '1' NOT NULL,
	"received_qty" numeric(12, 2) DEFAULT '0' NOT NULL,
	"unit_price" numeric(12, 2) DEFAULT '0' NOT NULL,
	"discount_percent" numeric(5, 2) DEFAULT '0' NOT NULL,
	"gst_rate" numeric(5, 2) DEFAULT '18' NOT NULL,
	"gst_slab_id" integer,
	"line_subtotal" numeric(14, 2) DEFAULT '0' NOT NULL,
	"line_gst" numeric(14, 2) DEFAULT '0' NOT NULL,
	"line_total" numeric(14, 2) DEFAULT '0' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "purchase_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"po_number" text NOT NULL,
	"supplier_id" integer,
	"expected_date" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"subtotal" numeric(14, 2) DEFAULT '0' NOT NULL,
	"discount_type" text DEFAULT 'percent' NOT NULL,
	"discount_value" numeric(10, 2) DEFAULT '0' NOT NULL,
	"discount_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"taxable_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"gst_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"freight_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"grand_total" numeric(14, 2) DEFAULT '0' NOT NULL,
	"remarks" text,
	"terms_conditions" text,
	"payment_terms" text,
	"created_by" integer,
	"updated_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_orders_po_number_unique" UNIQUE("po_number")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "quotation_attachments" (
	"id" serial PRIMARY KEY NOT NULL,
	"quotation_id" integer NOT NULL,
	"file_name" text NOT NULL,
	"file_path" text NOT NULL,
	"file_size" integer,
	"mime_type" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "quotation_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"quotation_id" integer NOT NULL,
	"product_id" integer,
	"product_name" text NOT NULL,
	"unit_name" text,
	"qty_breakup" text,
	"qty" numeric(12, 2) DEFAULT '1' NOT NULL,
	"unit_price" numeric(12, 2) DEFAULT '0' NOT NULL,
	"discount_percent" numeric(5, 2) DEFAULT '0' NOT NULL,
	"gst_rate" numeric(5, 2) DEFAULT '18' NOT NULL,
	"gst_slab_id" integer,
	"line_subtotal" numeric(14, 2) DEFAULT '0' NOT NULL,
	"line_gst" numeric(14, 2) DEFAULT '0' NOT NULL,
	"line_total" numeric(14, 2) DEFAULT '0' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "quotations" (
	"id" serial PRIMARY KEY NOT NULL,
	"quotation_no" text NOT NULL,
	"reference_no" text,
	"quotation_date" text NOT NULL,
	"subject" text,
	"project_name" text,
	"customer_attention" text,
	"intro_text" text,
	"validity_days" integer DEFAULT 15 NOT NULL,
	"inquiry_id" integer,
	"customer_id" integer NOT NULL,
	"contact_person_id" integer,
	"subject_template_id" integer,
	"status" text DEFAULT 'draft' NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"subtotal" numeric(14, 2) DEFAULT '0' NOT NULL,
	"discount_type" text DEFAULT 'percent' NOT NULL,
	"discount_value" numeric(10, 2) DEFAULT '0' NOT NULL,
	"discount_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"taxable_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"gst_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"freight_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"grand_total" numeric(14, 2) DEFAULT '0' NOT NULL,
	"terms_conditions" text,
	"payment_terms" text,
	"delivery_schedule" text,
	"notes" text,
	"signature_mode" text,
	"signature_data" text,
	"signature_name" text,
	"signature_designation" text,
	"signature_mobile" text,
	"signature_email" text,
	"sent_at" text,
	"closed_at" text,
	"created_by" integer,
	"updated_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quotations_quotation_no_unique" UNIQUE("quotation_no")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stock_adjustments" (
	"id" serial PRIMARY KEY NOT NULL,
	"adjustment_number" text NOT NULL,
	"warehouse_id" integer NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"reason" text,
	"approved_by" integer,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_adjustments_adjustment_number_unique" UNIQUE("adjustment_number")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stock_batches" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"warehouse_id" integer NOT NULL,
	"batch_number" text NOT NULL,
	"mfg_date" text,
	"exp_date" text,
	"qty_on_hand" numeric(14, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stock_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"warehouse_id" integer NOT NULL,
	"qty_on_hand" numeric(14, 2) DEFAULT '0' NOT NULL,
	"qty_reserved" numeric(14, 2) DEFAULT '0' NOT NULL,
	"qty_available" numeric(14, 2) DEFAULT '0' NOT NULL,
	"bin_location" text,
	"reorder_level" numeric(14, 2) DEFAULT '0' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stock_movements" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"warehouse_id" integer NOT NULL,
	"batch_id" integer,
	"movement_type" text NOT NULL,
	"qty" numeric(14, 2) NOT NULL,
	"reference_type" text,
	"reference_id" text,
	"remarks" text,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "subject_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"subject_text" text NOT NULL,
	"intro_paragraph" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subject_templates_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "supplier_addresses" (
	"id" serial PRIMARY KEY NOT NULL,
	"supplier_id" integer NOT NULL,
	"type" text DEFAULT 'billing' NOT NULL,
	"address_line1" text,
	"address_line2" text,
	"city" text,
	"state" text,
	"pincode" text,
	"country" text DEFAULT 'IN' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "supplier_bank_details" (
	"id" serial PRIMARY KEY NOT NULL,
	"supplier_id" integer NOT NULL,
	"account_name" text NOT NULL,
	"account_number" text NOT NULL,
	"bank_name" text NOT NULL,
	"branch_name" text,
	"ifsc_code" text NOT NULL,
	"swift_code" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "supplier_contacts" (
	"id" serial PRIMARY KEY NOT NULL,
	"supplier_id" integer NOT NULL,
	"name" text NOT NULL,
	"designation" text,
	"email" text,
	"phone" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "suppliers" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"company_name" text NOT NULL,
	"gstin" text,
	"pan" text,
	"msme_status" text,
	"payment_terms" text,
	"email" text,
	"phone" text,
	"rating" numeric(3, 1),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "suppliers_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "units" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "units_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text NOT NULL,
	"role" text DEFAULT 'sales' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "warehouses" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"location" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "warehouses_code_unique" UNIQUE("code")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "communication_logs" ADD CONSTRAINT "communication_logs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "communication_templates" ADD CONSTRAINT "communication_templates_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_contacts" ADD CONSTRAINT "customer_contacts_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inquiry_items" ADD CONSTRAINT "inquiry_items_inquiry_id_inquiries_id_fk" FOREIGN KEY ("inquiry_id") REFERENCES "public"."inquiries"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inquiry_items" ADD CONSTRAINT "inquiry_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notes" ADD CONSTRAINT "notes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "products" ADD CONSTRAINT "products_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "purchase_approvals" ADD CONSTRAINT "purchase_approvals_po_id_purchase_orders_id_fk" FOREIGN KEY ("po_id") REFERENCES "public"."purchase_orders"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "purchase_approvals" ADD CONSTRAINT "purchase_approvals_approver_id_users_id_fk" FOREIGN KEY ("approver_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_po_id_purchase_orders_id_fk" FOREIGN KEY ("po_id") REFERENCES "public"."purchase_orders"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_gst_slab_id_gst_slabs_id_fk" FOREIGN KEY ("gst_slab_id") REFERENCES "public"."gst_slabs"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "quotation_attachments" ADD CONSTRAINT "quotation_attachments_quotation_id_quotations_id_fk" FOREIGN KEY ("quotation_id") REFERENCES "public"."quotations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_quotation_id_quotations_id_fk" FOREIGN KEY ("quotation_id") REFERENCES "public"."quotations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_gst_slab_id_gst_slabs_id_fk" FOREIGN KEY ("gst_slab_id") REFERENCES "public"."gst_slabs"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "quotations" ADD CONSTRAINT "quotations_inquiry_id_inquiries_id_fk" FOREIGN KEY ("inquiry_id") REFERENCES "public"."inquiries"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "quotations" ADD CONSTRAINT "quotations_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "quotations" ADD CONSTRAINT "quotations_contact_person_id_customer_contacts_id_fk" FOREIGN KEY ("contact_person_id") REFERENCES "public"."customer_contacts"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "quotations" ADD CONSTRAINT "quotations_subject_template_id_subject_templates_id_fk" FOREIGN KEY ("subject_template_id") REFERENCES "public"."subject_templates"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "quotations" ADD CONSTRAINT "quotations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "quotations" ADD CONSTRAINT "quotations_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stock_batches" ADD CONSTRAINT "stock_batches_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stock_batches" ADD CONSTRAINT "stock_batches_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stock_items" ADD CONSTRAINT "stock_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stock_items" ADD CONSTRAINT "stock_items_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_batch_id_stock_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."stock_batches"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "supplier_addresses" ADD CONSTRAINT "supplier_addresses_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "supplier_bank_details" ADD CONSTRAINT "supplier_bank_details_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "supplier_contacts" ADD CONSTRAINT "supplier_contacts_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_comm_logs_entity" ON "communication_logs" USING btree ("entity","entity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_comm_logs_channel" ON "communication_logs" USING btree ("channel");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_comm_templates_channel_key" ON "communication_templates" USING btree ("channel","template_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_comm_templates_active" ON "communication_templates" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_contacts_customer" ON "customer_contacts" USING btree ("customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_customers_code" ON "customers" USING btree ("code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_customers_name" ON "customers" USING btree ("name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_inquiries_customer" ON "inquiries" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_inquiries_status" ON "inquiries" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_inquiries_created_at" ON "inquiries" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_inquiry_items_inquiry" ON "inquiry_items" USING btree ("inquiry_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_products_sku" ON "products" USING btree ("sku");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_purchase_approvals_po" ON "purchase_approvals" USING btree ("po_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_po_items_po" ON "purchase_order_items" USING btree ("po_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_po_supplier" ON "purchase_orders" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_po_status" ON "purchase_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_quotation_attachments_quotation" ON "quotation_attachments" USING btree ("quotation_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_quotation_items_quotation" ON "quotation_items" USING btree ("quotation_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_quotation_items_sort" ON "quotation_items" USING btree ("quotation_id","sort_order");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_quotations_customer" ON "quotations" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_quotations_inquiry" ON "quotations" USING btree ("inquiry_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_quotations_status" ON "quotations" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_quotations_created_at" ON "quotations" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_stock_adjustments_warehouse" ON "stock_adjustments" USING btree ("warehouse_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_stock_batches_number" ON "stock_batches" USING btree ("product_id","warehouse_id","batch_number");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_stock_items_product_warehouse" ON "stock_items" USING btree ("product_id","warehouse_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_stock_movements_product_warehouse" ON "stock_movements" USING btree ("product_id","warehouse_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_stock_movements_created_at" ON "stock_movements" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_subject_templates_name" ON "subject_templates" USING btree ("name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_subject_templates_is_default" ON "subject_templates" USING btree ("is_default");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_supplier_addresses_supplier" ON "supplier_addresses" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_supplier_bank_details_supplier" ON "supplier_bank_details" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_supplier_contacts_supplier" ON "supplier_contacts" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_suppliers_company_name" ON "suppliers" USING btree ("company_name");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_users_email" ON "users" USING btree ("email");