ALTER TABLE backlinks
  ADD COLUMN IF NOT EXISTS source_domain TEXT,
  ADD COLUMN IF NOT EXISTS target_url TEXT,
  ADD COLUMN IF NOT EXISTS first_seen TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_checked TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS http_status INTEGER,
  ADD COLUMN IF NOT EXISTS is_live BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_lost BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_broken BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS quality_score INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS spam_score INTEGER DEFAULT 0;

UPDATE backlinks
SET
  source_domain = COALESCE(NULLIF(source_domain, ''), NULLIF(name, '')),
  is_live = CASE WHEN status = 'Live' THEN TRUE ELSE COALESCE(is_live, FALSE) END,
  first_seen = COALESCE(first_seen, NOW()),
  last_seen = COALESCE(last_seen, CASE WHEN status = 'Live' THEN NOW() ELSE NULL END),
  last_checked = COALESCE(last_checked, NOW());

CREATE TABLE IF NOT EXISTS backlink_opportunities (
  id BIGSERIAL PRIMARY KEY,
  site_id BIGINT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  source_domain TEXT NOT NULL,
  source_url TEXT DEFAULT '',
  target_url TEXT DEFAULT '',
  strategy TEXT DEFAULT '',
  opportunity_type TEXT DEFAULT 'prospect',
  relevance TEXT DEFAULT '',
  estimated_dr INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Prospect',
  evidence TEXT DEFAULT '',
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_backlinks_site_live
  ON backlinks(site_id, status);

CREATE INDEX IF NOT EXISTS idx_backlinks_site_source_domain
  ON backlinks(site_id, source_domain);

CREATE INDEX IF NOT EXISTS idx_backlink_opportunities_site
  ON backlink_opportunities(site_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_backlink_opportunity_site_domain_url
  ON backlink_opportunities(
    site_id,
    lower(source_domain),
    lower(COALESCE(source_url, ''))
  );
