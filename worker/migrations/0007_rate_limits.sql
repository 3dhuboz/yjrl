-- Shared counters contain a keyed digest, never a raw visitor address.
CREATE TABLE rate_limit_buckets (
  bucket_key TEXT PRIMARY KEY,
  request_count INTEGER NOT NULL CHECK (request_count > 0),
  reset_at INTEGER NOT NULL
);
CREATE INDEX rate_limit_expiry ON rate_limit_buckets(reset_at);
