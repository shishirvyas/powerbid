/**
 * Runtime DDL bootstrap for tables that may not yet exist in the dev D1
 * (real production should apply Drizzle migrations). Idempotent and cheap.
 */
let initialized = false;

export async function ensurePocTables(db: D1Database): Promise<void> {
  if (initialized) return;
  initialized = true;
  await db.batch([
    db.prepare(
      `CREATE TABLE IF NOT EXISTS customer_contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        designation TEXT,
        email TEXT,
        phone TEXT,
        is_primary INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_by INTEGER,
        updated_by INTEGER,
        is_active INTEGER NOT NULL DEFAULT 1
      )`,
    ),
    db.prepare(
      `CREATE INDEX IF NOT EXISTS idx_contacts_customer ON customer_contacts(customer_id)`,
    ),
    db.prepare(
      `CREATE TABLE IF NOT EXISTS notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity TEXT NOT NULL,
        entity_id INTEGER NOT NULL,
        body TEXT NOT NULL,
        created_by INTEGER,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
    ),
    db.prepare(
      `CREATE INDEX IF NOT EXISTS idx_notes_entity ON notes(entity, entity_id)`,
    ),
    db.prepare(
      `CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity TEXT NOT NULL,
        entity_id INTEGER NOT NULL,
        action TEXT NOT NULL,
        user_id INTEGER,
        payload TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
    ),
  ]);
  // Best-effort column additions for evolving quotations table.
  for (const col of [
    "ALTER TABLE quotations ADD COLUMN payment_terms TEXT",
    "ALTER TABLE quotations ADD COLUMN delivery_schedule TEXT",
    "ALTER TABLE quotations ADD COLUMN contact_person_id INTEGER",
  ]) {
    try {
      await db.prepare(col).run();
    } catch {
      // already exists
    }
  }
}
