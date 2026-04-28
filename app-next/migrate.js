const postgres = require('postgres');
require('dotenv').config({ path: '.env.local' });

const connectionString = process.env.BID_DATABASE_URL || process.env.POWERBID_DATABASE_URL || process.env.DATABASE_URL;

async function migrate() {
  const sql = postgres(connectionString);

  try {
    console.log('Connected to database');

    // Drop constraints
    console.log('Dropping foreign key constraints...');
    await sql`ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "products_brand_id_brands_id_fk"`;
    await sql`ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "products_gst_slab_id_gst_slabs_id_fk"`;

    // Make sku nullable
    console.log('Making sku nullable...');
    await sql`ALTER TABLE "products" ALTER COLUMN "sku" DROP NOT NULL`;

    // Add hsm_code column
    console.log('Adding hsm_code column...');
    await sql`ALTER TABLE "products" ADD COLUMN "hsm_code" text`;

    // Drop old columns
    console.log('Dropping old columns...');
    await sql`ALTER TABLE "products" DROP COLUMN IF EXISTS "brand_id"`;
    await sql`ALTER TABLE "products" DROP COLUMN IF EXISTS "gst_slab_id"`;
    await sql`ALTER TABLE "products" DROP COLUMN IF EXISTS "base_price"`;
    await sql`ALTER TABLE "products" DROP COLUMN IF EXISTS "is_active"`;

    // Create unique index for nullable sku
    console.log('Creating unique index...');
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS uq_products_sku ON "products"("sku") WHERE "sku" IS NOT NULL`;

    console.log('✓ Migration completed successfully');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  }
}

migrate();
