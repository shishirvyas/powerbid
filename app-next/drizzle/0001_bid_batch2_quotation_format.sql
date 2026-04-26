ALTER TABLE quotations
  ADD COLUMN IF NOT EXISTS reference_no text,
  ADD COLUMN IF NOT EXISTS subject text,
  ADD COLUMN IF NOT EXISTS project_name text,
  ADD COLUMN IF NOT EXISTS customer_attention text,
  ADD COLUMN IF NOT EXISTS intro_text text;

ALTER TABLE quotation_items
  ADD COLUMN IF NOT EXISTS qty_breakup text;
