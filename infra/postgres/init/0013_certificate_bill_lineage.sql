-- Links a certificate back to the bill it was issued from (or, for a
-- renewal, the bill its predecessor was issued from). Without this, a
-- reversed payment can only be matched to "whichever certificate is
-- currently active for this rickshaw" — wrong once a certificate has been
-- renewed or the rickshaw has been re-certified under a later bill.
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS bill_id uuid REFERENCES bills(id);
CREATE INDEX IF NOT EXISTS idx_certificates_bill ON certificates (bill_id);
