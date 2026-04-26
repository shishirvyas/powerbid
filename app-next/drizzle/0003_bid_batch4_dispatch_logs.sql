CREATE TABLE IF NOT EXISTS "communication_logs" (
  "id" serial PRIMARY KEY NOT NULL,
  "entity" text NOT NULL,
  "entity_id" integer NOT NULL,
  "channel" text NOT NULL,
  "status" text DEFAULT 'queued' NOT NULL,
  "recipient" text NOT NULL,
  "subject" text,
  "message" text,
  "provider_message_id" text,
  "provider_payload" text,
  "error" text,
  "sent_at" timestamp with time zone,
  "created_by" integer,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "communication_logs" ADD CONSTRAINT "communication_logs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "idx_comm_logs_entity" ON "communication_logs" USING btree ("entity","entity_id");
CREATE INDEX IF NOT EXISTS "idx_comm_logs_channel" ON "communication_logs" USING btree ("channel");
