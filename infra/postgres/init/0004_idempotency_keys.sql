CREATE TABLE IF NOT EXISTS idempotency_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  key text NOT NULL,
  request_hash bytea NOT NULL,
  status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
  response_status integer,
  response_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE (user_id, key)
);

CREATE INDEX IF NOT EXISTS idx_idempotency_created ON idempotency_keys (created_at);
