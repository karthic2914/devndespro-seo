ALTER TABLE backlinks
  ADD COLUMN IF NOT EXISTS verification_source TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS provider_rank INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS provider_page_rank INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS provider_spam_score INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS provider_first_seen TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS provider_last_seen TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_backlinks_site_source
  ON backlinks(site_id, source);

CREATE INDEX IF NOT EXISTS idx_backlinks_site_verification_source
  ON backlinks(site_id, verification_source);
