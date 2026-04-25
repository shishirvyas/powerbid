-- =============================================================
-- Migration 0003: POC feature tables
--   - customer_contacts (multi-contact-person per customer)
--   - notes             (generic entity notes/timeline)
--   - audit_log         (activity feed)
--   - new columns on quotations: payment_terms, delivery_schedule,
--     contact_person_id, validity_days
-- =============================================================

-- ---------- customer_contacts ----------
CREATE TABLE IF NOT EXISTS customer_contacts (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id   INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  name          TEXT    NOT NULL,
  designation   TEXT,
  email         TEXT,
  phone         TEXT,
  is_primary    INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by    INTEGER,
  updated_by    INTEGER,
  is_active     INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_contacts_customer ON customer_contacts(customer_id);

-- ---------- notes ----------
CREATE TABLE IF NOT EXISTS notes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  entity      TEXT    NOT NULL,   -- 'customer' | 'inquiry' | 'quotation'
  entity_id   INTEGER NOT NULL,
  body        TEXT    NOT NULL,
  created_by  INTEGER,
  created_at  TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_notes_entity ON notes(entity, entity_id);

-- ---------- audit_log ----------
CREATE TABLE IF NOT EXISTS audit_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  entity      TEXT    NOT NULL,
  entity_id   INTEGER NOT NULL,
  action      TEXT    NOT NULL,
  user_id     INTEGER,
  payload     TEXT,               -- JSON string
  created_at  TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity, entity_id);

-- ---------- New columns on quotations ----------
-- Use plain ADD COLUMN for maximum compatibility with local Wrangler SQLite.
ALTER TABLE quotations ADD COLUMN payment_terms      TEXT;
ALTER TABLE quotations ADD COLUMN delivery_schedule  TEXT;
ALTER TABLE quotations ADD COLUMN contact_person_id  INTEGER;
