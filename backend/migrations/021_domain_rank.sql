ALTER TABLE sites
  ADD COLUMN IF NOT EXISTS domain_rank INTEGER,
  ADD COLUMN IF NOT EXISTS domain_rank_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS domain_rank_meta JSONB DEFAULT '{}'::jsonb;
