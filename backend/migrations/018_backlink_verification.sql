ALTER TABLE backlinks
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'Unverified',
  ADD COLUMN IF NOT EXISTS verification_reason TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS source_final_url TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS source_page_title TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS source_language TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS source_canonical TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS source_robots_noindex BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS rel_nofollow BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS rel_sponsored BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS rel_ugc BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS link_position TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS link_context TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS verification_evidence JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_backlinks_site_verification_status
  ON backlinks(site_id, verification_status);

CREATE INDEX IF NOT EXISTS idx_backlinks_site_verified_at
  ON backlinks(site_id, verified_at DESC);
