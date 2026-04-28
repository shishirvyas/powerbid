const postgres = require('postgres');
require('dotenv').config({ path: '.env.local' });

const connectionString = process.env.BID_DATABASE_URL || process.env.POWERBID_DATABASE_URL || process.env.DATABASE_URL;
const fs = require('fs');
const path = require('path');

async function migrate() {
  const sql = postgres(connectionString);

  try {
    console.log('Connected to database');

    // Read and execute the migration SQL
    const migrationSql = fs.readFileSync(path.join(__dirname, 'drizzle/0007_add_masters_and_inquiry_fields.sql'), 'utf-8');
    
    // Split by semicolon and execute each statement
    const statements = migrationSql.split(';').filter(s => s.trim());
    
    for (const statement of statements) {
      if (statement.trim()) {
        console.log('Executing:', statement.substring(0, 60) + '...');
        await sql.unsafe(statement);
      }
    }

    console.log('✓ Migration completed successfully');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  }
}

migrate();
