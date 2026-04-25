-- =============================================================
-- Seed: built-in roles + reference masters (idempotent)
-- =============================================================

INSERT OR IGNORE INTO roles (id, code, name, description, permissions, is_system) VALUES
  ('00000000-0000-4000-8000-000000000001', 'admin',  'Administrator', 'Full access',                 '["*"]',                                  1),
  ('00000000-0000-4000-8000-000000000002', 'sales',  'Sales',         'Create/manage quotations',    '["inquiry:*","quotation:*","master:read"]', 1),
  ('00000000-0000-4000-8000-000000000003', 'viewer', 'Viewer',        'Read-only access',            '["*:read"]',                              1);

INSERT OR IGNORE INTO gst_slabs (id, name, rate) VALUES
  ('10000000-0000-4000-8000-000000000000', 'GST 0',  0),
  ('10000000-0000-4000-8000-000000000005', 'GST 5',  5),
  ('10000000-0000-4000-8000-000000000012', 'GST 12', 12),
  ('10000000-0000-4000-8000-000000000018', 'GST 18', 18),
  ('10000000-0000-4000-8000-000000000028', 'GST 28', 28);

INSERT OR IGNORE INTO units (id, code, name) VALUES
  ('20000000-0000-4000-8000-000000000001', 'NOS',  'Numbers'),
  ('20000000-0000-4000-8000-000000000002', 'MTR',  'Meter'),
  ('20000000-0000-4000-8000-000000000003', 'BOX',  'Box'),
  ('20000000-0000-4000-8000-000000000004', 'COIL', 'Coil'),
  ('20000000-0000-4000-8000-000000000005', 'KG',   'Kilogram');

INSERT OR IGNORE INTO brands (id, name) VALUES
  ('30000000-0000-4000-8000-000000000001', 'Generic');
