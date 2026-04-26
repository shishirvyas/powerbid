CREATE TABLE IF NOT EXISTS "communication_templates" (
  "id" serial PRIMARY KEY NOT NULL,
  "channel" text NOT NULL,
  "template_key" text NOT NULL,
  "name" text NOT NULL,
  "subject" text,
  "body" text NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "updated_by" integer,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "communication_templates" ADD CONSTRAINT "communication_templates_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "uq_comm_templates_channel_key" ON "communication_templates" USING btree ("channel","template_key");
CREATE INDEX IF NOT EXISTS "idx_comm_templates_active" ON "communication_templates" USING btree ("is_active");
