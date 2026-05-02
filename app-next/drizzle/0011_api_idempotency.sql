CREATE TABLE IF NOT EXISTS api_idempotency (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  method text NOT NULL,
  path text NOT NULL,
  action_type text,
  key text NOT NULL,
  fingerprint text,
  status text NOT NULL DEFAULT 'processing',
  response_status integer,
  response_body text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_api_idempotency_request
  ON api_idempotency (user_id, method, path, key);

CREATE INDEX IF NOT EXISTS idx_api_idempotency_created_at
  ON api_idempotency (created_at);
