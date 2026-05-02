ALTER TABLE purchase_orders
  ADD COLUMN IF NOT EXISTS approval_mode text NOT NULL DEFAULT 'workflow',
  ADD COLUMN IF NOT EXISTS approved_by integer REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS self_approval_scan_name text,
  ADD COLUMN IF NOT EXISTS self_approval_scan_path text,
  ADD COLUMN IF NOT EXISTS self_approval_scan_uploaded_by integer REFERENCES users(id) ON DELETE SET NULL;
