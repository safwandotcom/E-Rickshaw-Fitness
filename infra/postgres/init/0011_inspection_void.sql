-- A submitted inspection is immutable (see docs/01), so correcting one
-- requires an authorized void event rather than an edit. These columns
-- record who voided it, when, and why.
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS void_reason text;
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS voided_at timestamptz;
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS voided_by uuid REFERENCES users(id);
