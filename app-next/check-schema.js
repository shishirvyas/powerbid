const postgres = require('postgres');
require('dotenv').config({ path: '.env.local' });
const conn = process.env.POWERBID_DATABASE_URL;

async function run() {
  const sql = postgres(conn);
  const r = await sql`SELECT column_name FROM information_schema.columns WHERE table_name='bom_master' AND column_name='so_id'`;
  const t = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name='supplier_products'`;
  const c = await sql`SELECT column_name FROM information_schema.columns WHERE table_name='purchase_orders' AND column_name IN ('so_id','bom_id') ORDER BY column_name`;
  const bi = await sql`SELECT column_name FROM information_schema.columns WHERE table_name='bom_items' AND column_name='supplier_product_id'`;
  console.log('bom_master.so_id:', r.length ? 'EXISTS' : 'MISSING');
  console.log('supplier_products table:', t.length ? 'EXISTS' : 'MISSING');
  console.log('purchase_orders so_id/bom_id:', c.map(x=>x.column_name).join(',') || 'MISSING');
  console.log('bom_items.supplier_product_id:', bi.length ? 'EXISTS' : 'MISSING');
  await sql.end();
}
run().catch(e=>{console.error(e.message);process.exit(1)});
