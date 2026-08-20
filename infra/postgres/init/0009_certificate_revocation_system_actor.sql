-- A payment reversal from the MFS provider can revoke a certificate
-- automatically (no human actor initiated it), unlike the existing
-- privileged revoke endpoint. Allow a null revoked_by for that case.
ALTER TABLE certificate_revocations ALTER COLUMN revoked_by DROP NOT NULL;
