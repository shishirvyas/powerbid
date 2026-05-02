const postgres = require('postgres');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const conn = process.env.POWERBID_DATABASE_URL;

async function run() {
  const sql = postgres(conn);
  console.log('Connected. Applying migration 0012...');

  try {
    // Run each statement separated by --> statement-breakpoint
    const migSql = fs.readFileSync(path.join(__dirname, 'drizzle/0012_procurement_bom_links.sql'), 'utf-8');
    // Split on the statement-breakpoint markers, strip leading comments from each chunk
    const statements = migSql
      .split(/--> statement-breakpoint/)
      .map(s => {
        // Remove leading SQL line comments but keep the actual SQL
        return s.replace(/^(\s*--[^\n]*\n)+/g, '').trim();
      })
      .filter(s => s.length > 0);

    for (const stmt of statements) {
      const preview = stmt.substring(0, 80).replace(/\n/g, ' ');
      try {
        await sql.unsafe(stmt);
        console.log('  ✓', preview);
      } catch (err) {
        const msg = err.message || '';
        // Ignore "already exists" errors — makes this idempotent
        if (
          msg.includes('already exists') ||
          msg.includes('does not exist') && msg.includes('DROP') 
        ) {
          console.log('  ~ skipped (already ok):', msg.split('\n')[0]);
        } else {
          throw err;
        }
      }
    }

    console.log('\n✓ Migration 0012 applied successfully');
  } catch (err) {
    console.error('✗ Error:', err.message);
    process.exit(1);
  } finally {
    await sql.end();
  }
}
run();
