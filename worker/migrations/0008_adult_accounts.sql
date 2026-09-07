-- Self-attestation is not independent age or guardian verification.
-- Existing accounts must attest at their next login; no child records are deleted.
ALTER TABLE users ADD COLUMN adult_attested_at TEXT;
ALTER TABLE users ADD COLUMN adult_attestation_version TEXT;
