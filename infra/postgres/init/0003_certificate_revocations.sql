CREATE TABLE IF NOT EXISTS certificate_revocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  certificate_id uuid NOT NULL REFERENCES certificates(id),
  reason_code text NOT NULL,
  revoked_by uuid NOT NULL REFERENCES users(id),
  revoked_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_certificate_revocations_certificate ON certificate_revocations (certificate_id, revoked_at DESC);
