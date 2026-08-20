-- Certificate renewal supersedes the old certificate rather than deleting
-- it, so its historical QR keeps reporting an accurate status online.
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS superseded_by_certificate_id uuid REFERENCES certificates(id);
