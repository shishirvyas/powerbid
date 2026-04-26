ALTER TABLE quotations
  ADD COLUMN IF NOT EXISTS signature_mode text,
  ADD COLUMN IF NOT EXISTS signature_data text,
  ADD COLUMN IF NOT EXISTS signature_name text,
  ADD COLUMN IF NOT EXISTS signature_designation text,
  ADD COLUMN IF NOT EXISTS signature_mobile text,
  ADD COLUMN IF NOT EXISTS signature_email text;
