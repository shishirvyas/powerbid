-- =============================================================
-- PowerBid initial schema (Cloudflare D1 / SQLite)
-- All ids are TEXT UUIDs (generated app-side via crypto.randomUUID()).
-- All tables include audit columns (created_at, updated_at, created_by,
-- updated_by) and a soft-delete column (deleted_at) where useful.
-- Foreign keys are declared; enable enforcement per-connection with:
--     PRAGMA foreign_keys = ON;
-- =============================================================

-- ---------- 1. ROLES ----------
CREATE TABLE roles (
  id          TEXT PRIMARY KEY,                           -- uuid
  code        TEXT NOT NULL UNIQUE,                       -- 'admin' | 'sales' | 'viewer' ...
  name        TEXT NOT NULL,
  description TEXT,
  permissions TEXT NOT NULL DEFAULT '[]',                 -- JSON array of permission keys
  is_system   INTEGER NOT NULL DEFAULT 0,                 -- 1 = built-in, cannot delete
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  created_by  TEXT,
  updated_by  TEXT,
  deleted_at  TEXT
);
CREATE INDEX idx_roles_code ON roles(code) WHERE deleted_at IS NULL;

-- ---------- 2. USERS ----------
CREATE TABLE users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL,
  phone         TEXT,
  role_id       TEXT NOT NULL,
  is_active     INTEGER NOT NULL DEFAULT 1,
  last_login_at TEXT,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  created_by    TEXT,
  updated_by    TEXT,
  deleted_at    TEXT,
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX uq_users_email_active
  ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_role ON users(role_id);

-- ---------- 3. CUSTOMERS ----------
CREATE TABLE customers (
  id              TEXT PRIMARY KEY,
  code            TEXT NOT NULL,                          -- short business code, e.g. CUST-0001
  name            TEXT NOT NULL,
  contact_person  TEXT,
  email           TEXT,
  phone           TEXT,
  gstin           TEXT,
  pan             TEXT,
  address_line1   TEXT,
  address_line2   TEXT,
  city            TEXT,
  state           TEXT,
  pincode         TEXT,
  country         TEXT NOT NULL DEFAULT 'IN',
  notes           TEXT,
  is_active       INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  created_by      TEXT,
  updated_by      TEXT,
  deleted_at      TEXT,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX uq_customers_code_active
  ON customers(code) WHERE deleted_at IS NULL;
CREATE INDEX idx_customers_name   ON customers(name)   WHERE deleted_at IS NULL;
CREATE INDEX idx_customers_email  ON customers(email)  WHERE deleted_at IS NULL;
CREATE INDEX idx_customers_phone  ON customers(phone)  WHERE deleted_at IS NULL;
CREATE INDEX idx_customers_gstin  ON customers(gstin)  WHERE deleted_at IS NULL;

-- ---------- 4. GST SLABS ----------
CREATE TABLE gst_slabs (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,                              -- 'GST 18'
  rate        REAL NOT NULL,                              -- 18.0
  description TEXT,
  is_active   INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  created_by  TEXT,
  updated_by  TEXT,
  deleted_at  TEXT,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX uq_gst_slabs_rate_active
  ON gst_slabs(rate) WHERE deleted_at IS NULL;

-- ---------- 5. BRANDS ----------
CREATE TABLE brands (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  is_active   INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  created_by  TEXT,
  updated_by  TEXT,
  deleted_at  TEXT,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX uq_brands_name_active
  ON brands(name) WHERE deleted_at IS NULL;

-- ---------- 6. UNITS ----------
CREATE TABLE units (
  id          TEXT PRIMARY KEY,
  code        TEXT NOT NULL,                              -- 'NOS', 'MTR', 'BOX', 'COIL', 'KG'
  name        TEXT NOT NULL,
  is_active   INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  created_by  TEXT,
  updated_by  TEXT,
  deleted_at  TEXT,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX uq_units_code_active
  ON units(code) WHERE deleted_at IS NULL;

-- ---------- 7. PRODUCTS ----------
CREATE TABLE products (
  id            TEXT PRIMARY KEY,
  sku           TEXT NOT NULL,
  name          TEXT NOT NULL,
  description   TEXT,
  brand_id      TEXT,
  unit_id       TEXT,
  gst_slab_id   TEXT,
  base_price    REAL NOT NULL DEFAULT 0,
  is_active     INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  created_by    TEXT,
  updated_by    TEXT,
  deleted_at    TEXT,
  FOREIGN KEY (brand_id)    REFERENCES brands(id)    ON DELETE SET NULL,
  FOREIGN KEY (unit_id)     REFERENCES units(id)     ON DELETE SET NULL,
  FOREIGN KEY (gst_slab_id) REFERENCES gst_slabs(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by)  REFERENCES users(id)     ON DELETE SET NULL,
  FOREIGN KEY (updated_by)  REFERENCES users(id)     ON DELETE SET NULL
);
CREATE UNIQUE INDEX uq_products_sku_active
  ON products(sku) WHERE deleted_at IS NULL;
CREATE INDEX idx_products_name      ON products(name)     WHERE deleted_at IS NULL;
CREATE INDEX idx_products_brand     ON products(brand_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_products_active    ON products(is_active);

-- ---------- 8. INQUIRIES ----------
CREATE TABLE inquiries (
  id                TEXT PRIMARY KEY,
  inquiry_no        TEXT NOT NULL,                         -- INQ-YYYY-####
  customer_id       TEXT,                                  -- nullable for walk-ins
  customer_snapshot TEXT,                                  -- JSON of name/phone/email at time of entry
  source            TEXT NOT NULL DEFAULT 'walkin'
                       CHECK (source IN ('walkin','phone','email','web','other')),
  priority          TEXT NOT NULL DEFAULT 'medium'
                       CHECK (priority IN ('low','medium','high','urgent')),
  status            TEXT NOT NULL DEFAULT 'new'
                       CHECK (status IN ('new','in_progress','quoted','won','lost','closed')),
  requirement       TEXT,
  expected_closure  TEXT,                                  -- ISO date
  assigned_to       TEXT,                                  -- users.id
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  created_by        TEXT,
  updated_by        TEXT,
  deleted_at        TEXT,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
  FOREIGN KEY (assigned_to) REFERENCES users(id)     ON DELETE SET NULL,
  FOREIGN KEY (created_by)  REFERENCES users(id)     ON DELETE SET NULL,
  FOREIGN KEY (updated_by)  REFERENCES users(id)     ON DELETE SET NULL
);
CREATE UNIQUE INDEX uq_inquiries_no_active
  ON inquiries(inquiry_no) WHERE deleted_at IS NULL;
CREATE INDEX idx_inquiries_status     ON inquiries(status)      WHERE deleted_at IS NULL;
CREATE INDEX idx_inquiries_customer   ON inquiries(customer_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_inquiries_assigned   ON inquiries(assigned_to) WHERE deleted_at IS NULL;
CREATE INDEX idx_inquiries_created_at ON inquiries(created_at);

-- ---------- 9. INQUIRY ITEMS ----------
CREATE TABLE inquiry_items (
  id            TEXT PRIMARY KEY,
  inquiry_id    TEXT NOT NULL,
  product_id    TEXT,
  product_name  TEXT NOT NULL,                            -- snapshot
  qty           REAL NOT NULL DEFAULT 1,
  remarks       TEXT,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (inquiry_id) REFERENCES inquiries(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id)  ON DELETE SET NULL
);
CREATE INDEX idx_inquiry_items_inquiry ON inquiry_items(inquiry_id);
CREATE INDEX idx_inquiry_items_product ON inquiry_items(product_id);

-- ---------- 10. QUOTATIONS ----------
CREATE TABLE quotations (
  id                 TEXT PRIMARY KEY,
  quotation_no       TEXT NOT NULL,                        -- Q-YYYY-####
  quotation_date     TEXT NOT NULL DEFAULT (date('now')),  -- ISO date
  validity_days      INTEGER NOT NULL DEFAULT 15,
  inquiry_id         TEXT,
  customer_id        TEXT NOT NULL,
  customer_snapshot  TEXT,                                 -- JSON of billing details at quote time
  status             TEXT NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft','final','sent','won','lost','expired')),
  currency           TEXT NOT NULL DEFAULT 'INR',
  subtotal           REAL NOT NULL DEFAULT 0,
  discount_type      TEXT NOT NULL DEFAULT 'percent'
                        CHECK (discount_type IN ('percent','amount')),
  discount_value     REAL NOT NULL DEFAULT 0,
  discount_amount    REAL NOT NULL DEFAULT 0,
  taxable_amount     REAL NOT NULL DEFAULT 0,
  gst_amount         REAL NOT NULL DEFAULT 0,
  freight_amount     REAL NOT NULL DEFAULT 0,
  grand_total        REAL NOT NULL DEFAULT 0,
  terms_conditions   TEXT,
  notes              TEXT,
  pdf_r2_key         TEXT,                                 -- key in R2 bucket
  sent_at            TEXT,
  followup_at        TEXT,
  closed_at          TEXT,
  close_reason       TEXT,
  parent_quotation_id TEXT,                                -- for clones / revisions
  revision           INTEGER NOT NULL DEFAULT 0,
  created_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  created_by         TEXT,
  updated_by         TEXT,
  deleted_at         TEXT,
  FOREIGN KEY (inquiry_id)          REFERENCES inquiries(id)  ON DELETE SET NULL,
  FOREIGN KEY (customer_id)         REFERENCES customers(id)  ON DELETE RESTRICT,
  FOREIGN KEY (parent_quotation_id) REFERENCES quotations(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by)          REFERENCES users(id)      ON DELETE SET NULL,
  FOREIGN KEY (updated_by)          REFERENCES users(id)      ON DELETE SET NULL
);
CREATE UNIQUE INDEX uq_quotations_no_active
  ON quotations(quotation_no) WHERE deleted_at IS NULL;
CREATE INDEX idx_quotations_status      ON quotations(status)         WHERE deleted_at IS NULL;
CREATE INDEX idx_quotations_customer    ON quotations(customer_id)    WHERE deleted_at IS NULL;
CREATE INDEX idx_quotations_inquiry     ON quotations(inquiry_id)     WHERE deleted_at IS NULL;
CREATE INDEX idx_quotations_date        ON quotations(quotation_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_quotations_followup_at ON quotations(followup_at)    WHERE deleted_at IS NULL;

-- ---------- 11. QUOTATION ITEMS ----------
CREATE TABLE quotation_items (
  id                TEXT PRIMARY KEY,
  quotation_id      TEXT NOT NULL,
  product_id        TEXT,
  product_name      TEXT NOT NULL,
  description       TEXT,
  unit_name         TEXT,
  qty               REAL NOT NULL DEFAULT 1,
  unit_price        REAL NOT NULL DEFAULT 0,
  discount_percent  REAL NOT NULL DEFAULT 0,
  gst_rate          REAL NOT NULL DEFAULT 0,
  line_subtotal     REAL NOT NULL DEFAULT 0,    -- qty * unit_price - discount
  line_gst          REAL NOT NULL DEFAULT 0,
  line_total        REAL NOT NULL DEFAULT 0,    -- subtotal + gst
  sort_order        INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id)   REFERENCES products(id)   ON DELETE SET NULL
);
CREATE INDEX idx_quotation_items_quotation ON quotation_items(quotation_id);
CREATE INDEX idx_quotation_items_product   ON quotation_items(product_id);

-- ---------- 12. EMAIL LOGS ----------
CREATE TABLE email_logs (
  id              TEXT PRIMARY KEY,
  related_entity  TEXT,                                   -- 'quotation' | 'inquiry' | ...
  related_id      TEXT,                                   -- FK by convention (no constraint)
  to_email        TEXT NOT NULL,
  cc              TEXT,                                   -- comma separated
  bcc             TEXT,
  from_email      TEXT NOT NULL,
  subject         TEXT NOT NULL,
  body_html       TEXT,
  body_text       TEXT,
  template_code   TEXT,
  status          TEXT NOT NULL DEFAULT 'queued'
                    CHECK (status IN ('queued','sent','failed','bounced')),
  provider        TEXT,                                   -- 'mailchannels' | 'resend' | ...
  provider_msg_id TEXT,
  error           TEXT,
  attempts        INTEGER NOT NULL DEFAULT 0,
  attachments     TEXT,                                   -- JSON: [{name, r2_key, contentType}]
  sent_at         TEXT,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  created_by      TEXT,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX idx_email_logs_related    ON email_logs(related_entity, related_id);
CREATE INDEX idx_email_logs_status     ON email_logs(status);
CREATE INDEX idx_email_logs_to         ON email_logs(to_email);
CREATE INDEX idx_email_logs_created_at ON email_logs(created_at);

-- ---------- 13. ACTIVITY LOGS (audit trail) ----------
CREATE TABLE activity_logs (
  id          TEXT PRIMARY KEY,
  entity      TEXT NOT NULL,                              -- 'quotation', 'customer', ...
  entity_id   TEXT NOT NULL,
  action      TEXT NOT NULL,                              -- 'create','update','delete','status_change',...
  user_id     TEXT,
  ip_address  TEXT,
  user_agent  TEXT,
  before_data TEXT,                                       -- JSON snapshot before change
  after_data  TEXT,                                       -- JSON snapshot after change
  message     TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX idx_activity_logs_entity    ON activity_logs(entity, entity_id);
CREATE INDEX idx_activity_logs_user      ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_action    ON activity_logs(action);
CREATE INDEX idx_activity_logs_created   ON activity_logs(created_at);

-- =============================================================
-- Triggers: keep updated_at fresh on row mutation
-- (D1 supports SQLite triggers; lightweight and keeps schema source of truth)
-- =============================================================

CREATE TRIGGER trg_roles_updated_at AFTER UPDATE ON roles
BEGIN UPDATE roles SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = NEW.id; END;

CREATE TRIGGER trg_users_updated_at AFTER UPDATE ON users
BEGIN UPDATE users SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = NEW.id; END;

CREATE TRIGGER trg_customers_updated_at AFTER UPDATE ON customers
BEGIN UPDATE customers SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = NEW.id; END;

CREATE TRIGGER trg_gst_slabs_updated_at AFTER UPDATE ON gst_slabs
BEGIN UPDATE gst_slabs SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = NEW.id; END;

CREATE TRIGGER trg_brands_updated_at AFTER UPDATE ON brands
BEGIN UPDATE brands SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = NEW.id; END;

CREATE TRIGGER trg_units_updated_at AFTER UPDATE ON units
BEGIN UPDATE units SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = NEW.id; END;

CREATE TRIGGER trg_products_updated_at AFTER UPDATE ON products
BEGIN UPDATE products SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = NEW.id; END;

CREATE TRIGGER trg_inquiries_updated_at AFTER UPDATE ON inquiries
BEGIN UPDATE inquiries SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = NEW.id; END;

CREATE TRIGGER trg_inquiry_items_updated_at AFTER UPDATE ON inquiry_items
BEGIN UPDATE inquiry_items SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = NEW.id; END;

CREATE TRIGGER trg_quotations_updated_at AFTER UPDATE ON quotations
BEGIN UPDATE quotations SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = NEW.id; END;

CREATE TRIGGER trg_quotation_items_updated_at AFTER UPDATE ON quotation_items
BEGIN UPDATE quotation_items SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = NEW.id; END;

CREATE TRIGGER trg_email_logs_updated_at AFTER UPDATE ON email_logs
BEGIN UPDATE email_logs SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = NEW.id; END;
