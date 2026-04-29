CREATE TABLE IF NOT EXISTS "production_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"production_number" text NOT NULL,
	"bom_id" integer,
	"product_id" integer NOT NULL,
	"warehouse_id" integer NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"planned_qty" numeric(14, 2) DEFAULT '0' NOT NULL,
	"produced_qty" numeric(14, 2) DEFAULT '0' NOT NULL,
	"start_date" text,
	"end_date" text,
	"notes" text,
	"created_by" integer,
	"updated_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "production_orders_production_number_unique" UNIQUE("production_number")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "production_consumption" (
	"id" serial PRIMARY KEY NOT NULL,
	"production_id" integer NOT NULL,
	"raw_material_id" integer NOT NULL,
	"qty_planned" numeric(14, 4) DEFAULT '0' NOT NULL,
	"qty_consumed" numeric(14, 4) DEFAULT '0' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "production_output" (
	"id" serial PRIMARY KEY NOT NULL,
	"production_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"warehouse_id" integer NOT NULL,
	"qty_produced" numeric(14, 4) NOT NULL,
	"remarks" text,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_bom_id_bom_master_id_fk" FOREIGN KEY ("bom_id") REFERENCES "public"."bom_master"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "production_consumption" ADD CONSTRAINT "production_consumption_production_id_production_orders_id_fk" FOREIGN KEY ("production_id") REFERENCES "public"."production_orders"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "production_consumption" ADD CONSTRAINT "production_consumption_raw_material_id_products_id_fk" FOREIGN KEY ("raw_material_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "production_output" ADD CONSTRAINT "production_output_production_id_production_orders_id_fk" FOREIGN KEY ("production_id") REFERENCES "public"."production_orders"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "production_output" ADD CONSTRAINT "production_output_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "production_output" ADD CONSTRAINT "production_output_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "production_output" ADD CONSTRAINT "production_output_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_production_orders_status" ON "production_orders" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_production_orders_product" ON "production_orders" USING btree ("product_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_production_consumption_production" ON "production_consumption" USING btree ("production_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_production_output_production" ON "production_output" USING btree ("production_id");
