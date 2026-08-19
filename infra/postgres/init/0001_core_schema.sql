CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE rickshaw_status AS ENUM ('pending', 'pre_approved', 'certified', 'expired', 'suspended');
CREATE TYPE inspection_status AS ENUM ('draft', 'submitted', 'passed', 'failed', 'voided', 'superseded');
CREATE TYPE payment_status AS ENUM ('unpaid', 'paid', 'expired', 'failed', 'reversed', 'reconciliation_required');
CREATE TYPE certificate_status AS ENUM ('issued', 'active', 'expired', 'revoked', 'superseded');

CREATE TABLE districts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  district_id uuid NOT NULL REFERENCES districts(id),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_subject text NOT NULL UNIQUE,
  display_name text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'disabled')),
  mfa_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE roles (
  code text PRIMARY KEY,
  description text NOT NULL
);

CREATE TABLE user_roles (
  user_id uuid NOT NULL REFERENCES users(id),
  role_code text NOT NULL REFERENCES roles(code),
  PRIMARY KEY (user_id, role_code)
);

CREATE TABLE user_geographies (
  user_id uuid NOT NULL REFERENCES users(id),
  district_id uuid NOT NULL REFERENCES districts(id),
  zone_id uuid NOT NULL REFERENCES zones(id),
  PRIMARY KEY (user_id, district_id, zone_id)
);

CREATE TABLE rickshaws (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chassis_number text NOT NULL UNIQUE,
  motor_number text,
  owner_phone_encrypted bytea NOT NULL,
  district_id uuid NOT NULL REFERENCES districts(id),
  zone_id uuid NOT NULL REFERENCES zones(id),
  status rickshaw_status NOT NULL DEFAULT 'pending',
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE inspection_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text NOT NULL UNIQUE,
  vehicle_type text NOT NULL,
  schema_json jsonb NOT NULL,
  effective_from timestamptz NOT NULL,
  effective_to timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE inspections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rickshaw_id uuid NOT NULL REFERENCES rickshaws(id),
  inspector_id uuid NOT NULL REFERENCES users(id),
  template_id uuid NOT NULL REFERENCES inspection_templates(id),
  checklist_data jsonb NOT NULL,
  result text CHECK (result IN ('pass', 'fail')),
  status inspection_status NOT NULL DEFAULT 'draft',
  client_timestamp timestamptz,
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_code text NOT NULL UNIQUE CHECK (bill_code ~ '^[0-9]{6,8}$'),
  rickshaw_id uuid NOT NULL REFERENCES rickshaws(id),
  inspection_id uuid NOT NULL REFERENCES inspections(id),
  amount_paisa bigint NOT NULL CHECK (amount_paisa > 0),
  currency char(3) NOT NULL DEFAULT 'BDT',
  expires_at timestamptz NOT NULL,
  status payment_status NOT NULL DEFAULT 'unpaid',
  fee_rule_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id uuid NOT NULL REFERENCES bills(id),
  provider text NOT NULL,
  provider_transaction_id text NOT NULL,
  callback_event_id text NOT NULL,
  amount_paisa bigint NOT NULL CHECK (amount_paisa > 0),
  status payment_status NOT NULL,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_transaction_id),
  UNIQUE (provider, callback_event_id)
);

CREATE TABLE certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  certificate_number text NOT NULL UNIQUE,
  rickshaw_id uuid NOT NULL REFERENCES rickshaws(id),
  qr_hash bytea NOT NULL UNIQUE,
  key_id text NOT NULL,
  short_code text NOT NULL UNIQUE,
  issued_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  status certificate_status NOT NULL DEFAULT 'issued',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES users(id),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  before_json jsonb,
  after_json jsonb,
  request_id text,
  ip inet,
  device_id text,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE outbox_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  aggregate_type text NOT NULL,
  aggregate_id uuid NOT NULL,
  payload jsonb NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  attempts integer NOT NULL DEFAULT 0
);

CREATE INDEX idx_rickshaws_geography_status ON rickshaws (district_id, zone_id, status);
CREATE INDEX idx_inspections_rickshaw_submitted ON inspections (rickshaw_id, submitted_at DESC);
CREATE INDEX idx_bills_status_expiry ON bills (status, expires_at);
CREATE INDEX idx_certificates_status_expiry ON certificates (status, expires_at);
CREATE INDEX idx_outbox_unpublished ON outbox_events (occurred_at) WHERE published_at IS NULL;

INSERT INTO roles (code, description) VALUES
  ('inspector', 'Conducts assigned inspections'),
  ('hub_supervisor', 'Reviews hub exceptions'),
  ('district_administrator', 'Administers district operations'),
  ('central_administrator', 'Administers nationwide configuration'),
  ('finance_operator', 'Reconciles payments'),
  ('traffic_police_verifier', 'Performs certificate verification');
