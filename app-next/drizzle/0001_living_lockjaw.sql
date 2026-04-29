CREATE TABLE IF NOT EXISTS "bom_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"bom_id" integer NOT NULL,
	"raw_material_id" integer NOT NULL,
	"qty_per_unit" numeric(14, 4) NOT NULL,
	"unit_name" text,
	"wastage_percent" numeric(5, 2) DEFAULT '0' NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bom_master" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"bom_code" text NOT NULL,
	"version" text DEFAULT '1.0' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"labor_cost" numeric(14, 2) DEFAULT '0' NOT NULL,
	"overhead_cost" numeric(14, 2) DEFAULT '0' NOT NULL,
	"notes" text,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bom_master_bom_code_unique" UNIQUE("bom_code")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bom_items" ADD CONSTRAINT "bom_items_bom_id_bom_master_id_fk" FOREIGN KEY ("bom_id") REFERENCES "public"."bom_master"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bom_items" ADD CONSTRAINT "bom_items_raw_material_id_products_id_fk" FOREIGN KEY ("raw_material_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bom_master" ADD CONSTRAINT "bom_master_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bom_master" ADD CONSTRAINT "bom_master_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_bom_items_bom" ON "bom_items" USING btree ("bom_id");