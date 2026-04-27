ALTER TABLE "customers"
  ADD COLUMN IF NOT EXISTS "onboarded_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "inactive_since" timestamp with time zone;

ALTER TABLE "inquiries"
  ADD COLUMN IF NOT EXISTS "first_response_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "acknowledgement_due_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "quotation_due_at" timestamp with time zone;

ALTER TABLE "quotations"
  ADD COLUMN IF NOT EXISTS "followup_due_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "last_followup_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "won_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "lost_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "lost_reason" text;

CREATE INDEX IF NOT EXISTS "idx_customers_inactive_since" ON "customers" USING btree ("inactive_since");
CREATE INDEX IF NOT EXISTS "idx_inquiries_ack_due_at" ON "inquiries" USING btree ("acknowledgement_due_at");
CREATE INDEX IF NOT EXISTS "idx_inquiries_quote_due_at" ON "inquiries" USING btree ("quotation_due_at");
CREATE INDEX IF NOT EXISTS "idx_quotations_followup_due_at" ON "quotations" USING btree ("followup_due_at");
CREATE INDEX IF NOT EXISTS "idx_quotations_won_at" ON "quotations" USING btree ("won_at");
CREATE INDEX IF NOT EXISTS "idx_quotations_lost_at" ON "quotations" USING btree ("lost_at");
CREATE INDEX IF NOT EXISTS "idx_quotations_lost_reason" ON "quotations" USING btree ("lost_reason");
