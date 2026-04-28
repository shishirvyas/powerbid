-- Add subject_templates master table
CREATE TABLE IF NOT EXISTS subject_templates (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  subject_text TEXT NOT NULL,
  intro_paragraph TEXT,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_subject_templates_name ON subject_templates(name);
CREATE INDEX IF NOT EXISTS idx_subject_templates_is_default ON subject_templates(is_default) WHERE is_default = TRUE;

-- Add inquiry fields
ALTER TABLE inquiries 
ADD COLUMN IF NOT EXISTS date_of_inquiry TEXT,
ADD COLUMN IF NOT EXISTS reference_number TEXT;

-- Update quotation to use only INR currency (remove currency field won't work as it has data)
-- We'll handle currency removal in the application layer

-- Add subject_template_id to quotations for template reference
ALTER TABLE quotations
ADD COLUMN IF NOT EXISTS subject_template_id INTEGER REFERENCES subject_templates(id) ON DELETE SET NULL;

-- Create attachments table for quotations (for annexure in PDF)
CREATE TABLE IF NOT EXISTS quotation_attachments (
  id SERIAL PRIMARY KEY,
  quotation_id INTEGER NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quotation_attachments_quotation ON quotation_attachments(quotation_id);

-- Add gst_slab_id to quotation_items for GST selection
ALTER TABLE quotation_items
ADD COLUMN IF NOT EXISTS gst_slab_id INTEGER REFERENCES gst_slabs(id) ON DELETE SET NULL;

-- Note: Removed columns from quotations (status, currency, discount, freight) 
-- will be handled via application logic and gradual migration
