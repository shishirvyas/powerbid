-- Migration: 0012_procurement_bom_links
-- Adds supplier_products catalog, links BOMs to Sales Orders,
-- adds supplier_product_id to bom_items, and links POs to SO/BOM.

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "supplier_products" (
  "id" serial PRIMARY KEY NOT NULL,
  "supplier_id" integer,
  "code" text NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "unit_id" integer,
  "unit_name" text,
  "standard_price" numeric(14, 2) NOT NULL DEFAULT '0',
  "lead_days" integer NOT NULL DEFAULT 0,
  "hsn_code" text,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "supplier_products"
  ADD CONSTRAINT "supplier_products_supplier_id_suppliers_id_fk"
  FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id")
  ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "supplier_products"
  ADD CONSTRAINT "supplier_products_unit_id_units_id_fk"
  FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id")
  ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_supplier_products_supplier" ON "supplier_products" ("supplier_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_supplier_products_active" ON "supplier_products" ("is_active");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_supplier_products_code" ON "supplier_products" ("code");

--> statement-breakpoint
-- Add so_id to bom_master
ALTER TABLE "bom_master" ADD COLUMN IF NOT EXISTS "so_id" integer;
--> statement-breakpoint
ALTER TABLE "bom_master"
  ADD CONSTRAINT "bom_master_so_id_sales_orders_id_fk"
  FOREIGN KEY ("so_id") REFERENCES "public"."sales_orders"("id")
  ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_bom_master_so" ON "bom_master" ("so_id");

--> statement-breakpoint
-- Relax rawMaterialId NOT NULL in bom_items, add supplier_product_id
ALTER TABLE "bom_items" ALTER COLUMN "raw_material_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "bom_items" DROP CONSTRAINT IF EXISTS "bom_items_raw_material_id_products_id_fk";
--> statement-breakpoint
ALTER TABLE "bom_items"
  ADD CONSTRAINT "bom_items_raw_material_id_products_id_fk"
  FOREIGN KEY ("raw_material_id") REFERENCES "public"."products"("id")
  ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "bom_items" ADD COLUMN IF NOT EXISTS "supplier_product_id" integer;
--> statement-breakpoint
ALTER TABLE "bom_items"
  ADD CONSTRAINT "bom_items_supplier_product_id_supplier_products_id_fk"
  FOREIGN KEY ("supplier_product_id") REFERENCES "public"."supplier_products"("id")
  ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_bom_items_supplier_product" ON "bom_items" ("supplier_product_id");

--> statement-breakpoint
-- Add so_id + bom_id to purchase_orders
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "so_id" integer;
--> statement-breakpoint
ALTER TABLE "purchase_orders"
  ADD CONSTRAINT "purchase_orders_so_id_sales_orders_id_fk"
  FOREIGN KEY ("so_id") REFERENCES "public"."sales_orders"("id")
  ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "bom_id" integer;
--> statement-breakpoint
ALTER TABLE "purchase_orders"
  ADD CONSTRAINT "purchase_orders_bom_id_bom_master_id_fk"
  FOREIGN KEY ("bom_id") REFERENCES "public"."bom_master"("id")
  ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_po_so" ON "purchase_orders" ("so_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_po_bom" ON "purchase_orders" ("bom_id");
