ALTER TABLE sites
  ADD COLUMN IF NOT EXISTS authority_version TEXT DEFAULT '3.0',
  ADD COLUMN IF NOT EXISTS authority_breakdown JSONB DEFAULT '{}'::jsonb;

ALTER TABLE backlinks
  ADD COLUMN IF NOT EXISTS quality_breakdown JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS quality_updated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_backlinks_site_quality
  ON backlinks(site_id, quality_score DESC);

CREATE INDEX IF NOT EXISTS idx_backlinks_site_live_verified
  ON backlinks(site_id, is_live, verification_status);
