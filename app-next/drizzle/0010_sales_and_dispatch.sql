CREATE TABLE IF NOT EXISTS "sales_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"so_number" text NOT NULL,
	"order_date" text NOT NULL,
	"quotation_id" integer,
	"customer_id" integer NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"subtotal" numeric(14, 2) DEFAULT '0' NOT NULL,
	"discount_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"taxable_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"gst_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"freight_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"grand_total" numeric(14, 2) DEFAULT '0' NOT NULL,
	"notes" text,
	"created_by" integer,
	"updated_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sales_orders_so_number_unique" UNIQUE("so_number")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sales_order_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"so_id" integer NOT NULL,
	"product_id" integer,
	"product_name" text NOT NULL,
	"unit_name" text,
	"qty" numeric(12, 2) DEFAULT '1' NOT NULL,
	"dispatched_qty" numeric(12, 2) DEFAULT '0' NOT NULL,
	"unit_price" numeric(12, 2) DEFAULT '0' NOT NULL,
	"gst_rate" numeric(5, 2) DEFAULT '18' NOT NULL,
	"line_subtotal" numeric(14, 2) DEFAULT '0' NOT NULL,
	"line_gst" numeric(14, 2) DEFAULT '0' NOT NULL,
	"line_total" numeric(14, 2) DEFAULT '0' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "dispatch_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"dispatch_number" text NOT NULL,
	"so_id" integer NOT NULL,
	"warehouse_id" integer NOT NULL,
	"dispatch_date" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"transporter_name" text,
	"vehicle_number" text,
	"tracking_number" text,
	"notes" text,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dispatch_orders_dispatch_number_unique" UNIQUE("dispatch_number")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "dispatch_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"dispatch_id" integer NOT NULL,
	"so_item_id" integer NOT NULL,
	"product_id" integer,
	"qty" numeric(12, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_quotation_id_quotations_id_fk" FOREIGN KEY ("quotation_id") REFERENCES "public"."quotations"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sales_order_items" ADD CONSTRAINT "sales_order_items_so_id_sales_orders_id_fk" FOREIGN KEY ("so_id") REFERENCES "public"."sales_orders"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sales_order_items" ADD CONSTRAINT "sales_order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dispatch_orders" ADD CONSTRAINT "dispatch_orders_so_id_sales_orders_id_fk" FOREIGN KEY ("so_id") REFERENCES "public"."sales_orders"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dispatch_orders" ADD CONSTRAINT "dispatch_orders_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dispatch_orders" ADD CONSTRAINT "dispatch_orders_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dispatch_items" ADD CONSTRAINT "dispatch_items_dispatch_id_dispatch_orders_id_fk" FOREIGN KEY ("dispatch_id") REFERENCES "public"."dispatch_orders"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dispatch_items" ADD CONSTRAINT "dispatch_items_so_item_id_sales_order_items_id_fk" FOREIGN KEY ("so_item_id") REFERENCES "public"."sales_order_items"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dispatch_items" ADD CONSTRAINT "dispatch_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sales_orders_customer" ON "sales_orders" USING btree ("customer_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sales_orders_status" ON "sales_orders" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sales_order_items_so" ON "sales_order_items" USING btree ("so_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_dispatch_orders_so" ON "dispatch_orders" USING btree ("so_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_dispatch_orders_warehouse" ON "dispatch_orders" USING btree ("warehouse_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_dispatch_items_dispatch" ON "dispatch_items" USING btree ("dispatch_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_dispatch_items_so_item" ON "dispatch_items" USING btree ("so_item_id");
