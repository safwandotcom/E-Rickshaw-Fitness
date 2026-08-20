ALTER TABLE outbox_events ADD COLUMN IF NOT EXISTS claimed_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_outbox_claimable ON outbox_events (occurred_at) WHERE published_at IS NULL;
