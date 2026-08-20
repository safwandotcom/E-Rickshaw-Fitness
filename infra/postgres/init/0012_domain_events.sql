-- Append-only durable log of domain events consumed off the RabbitMQ
-- outbox exchange, kept for support/replay/analytics. Distinct from
-- audit_events, which records actor-driven privileged actions.
CREATE TABLE IF NOT EXISTS domain_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id text NOT NULL UNIQUE,
  type text NOT NULL,
  aggregate_type text NOT NULL,
  aggregate_id uuid NOT NULL,
  payload jsonb NOT NULL,
  occurred_at timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_domain_events_aggregate ON domain_events (aggregate_type, aggregate_id, occurred_at);
