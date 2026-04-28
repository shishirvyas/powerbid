-- Migration: Products table restructuring
-- Remove: brand_id, gst_slab_id, base_price, is_active
-- Add: hsm_code
-- Modify: sku (make nullable)

ALTER TABLE products
DROP CONSTRAINT IF EXISTS uq_products_sku;

ALTER TABLE products
ALTER COLUMN sku DROP NOT NULL;

ALTER TABLE products
DROP COLUMN IF EXISTS brand_id;

ALTER TABLE products
DROP COLUMN IF EXISTS gst_slab_id;

ALTER TABLE products
DROP COLUMN IF EXISTS base_price;

ALTER TABLE products
DROP COLUMN IF EXISTS is_active;

ALTER TABLE products
ADD COLUMN hsm_code text;

CREATE UNIQUE INDEX IF NOT EXISTS uq_products_sku ON products(sku) WHERE sku IS NOT NULL;
