const postgres = require('postgres');
require('dotenv').config({ path: '.env.local' });

const connectionString = process.env.BID_DATABASE_URL || process.env.POWERBID_DATABASE_URL || process.env.DATABASE_URL;

async function main() {
  if (!connectionString) {
    throw new Error('Missing database connection string in .env.local');
  }

  const sql = postgres(connectionString);
  try {
    const year = new Date().getFullYear();
    const poNumber = `PO-${year}-TST001`;

    const existing = await sql.unsafe('select id from purchase_orders where po_number = $1', [poNumber]);
    let poId = existing[0]?.id;

    if (!poId) {
      const inserted = await sql.unsafe(
        `insert into purchase_orders (
          po_number, supplier_id, so_id, bom_id, expected_date, status, currency,
          subtotal, discount_type, discount_value, discount_amount,
          taxable_amount, gst_amount, freight_amount, grand_total,
          remarks, created_at, updated_at
        ) values (
          $1,$2,$3,$4,$5,$6,$7,
          $8,$9,$10,$11,
          $12,$13,$14,$15,
          $16, now(), now()
        )
        returning id`,
        [
          poNumber,
          1,
          null,
          6,
          new Date().toISOString().slice(0, 10),
          'draft',
          'INR',
          '1000',
          'percent',
          '0',
          '0',
          '1000',
          '180',
          '0',
          '1180',
          'Workflow test PO linked to BOM 6',
        ],
      );
      poId = inserted[0].id;

      await sql.unsafe(
        `insert into purchase_order_items (
          po_id, product_id, product_name, unit_name,
          qty, received_qty, unit_price, discount_percent,
          gst_rate, line_subtotal, line_gst, line_total, sort_order
        ) values (
          $1,$2,$3,$4,
          $5,$6,$7,$8,
          $9,$10,$11,$12,$13
        )`,
        [poId, 1, 'MCB 32A C-Curve', 'PCS', '10', '0', '100', '0', '18', '1000', '180', '1180', 0],
      );

      console.log('Created test PO:', poId, poNumber);
    } else {
      console.log('Test PO already exists:', poId, poNumber);
    }

    const rows = await sql.unsafe(
      'select id, po_number, status, so_id, bom_id from purchase_orders order by id desc limit 10',
    );
    console.log(JSON.stringify(rows, null, 2));
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
