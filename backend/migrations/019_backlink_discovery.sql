CREATE TABLE IF NOT EXISTS backlink_discovery_runs (
  id BIGSERIAL PRIMARY KEY,
  site_id BIGINT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'hybrid',
  status TEXT NOT NULL DEFAULT 'Running',
  queries_run INTEGER NOT NULL DEFAULT 0,
  candidates_found INTEGER NOT NULL DEFAULT 0,
  candidates_verified INTEGER NOT NULL DEFAULT 0,
  live_found INTEGER NOT NULL DEFAULT 0,
  lost_found INTEGER NOT NULL DEFAULT 0,
  broken_found INTEGER NOT NULL DEFAULT 0,
  errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS backlink_candidates (
  id BIGSERIAL PRIMARY KEY,
  site_id BIGINT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  discovery_run_id BIGINT REFERENCES backlink_discovery_runs(id) ON DELETE SET NULL,
  source_url TEXT NOT NULL,
  source_domain TEXT NOT NULL DEFAULT '',
  result_title TEXT DEFAULT '',
  result_description TEXT DEFAULT '',
  query TEXT DEFAULT '',
  provider TEXT NOT NULL DEFAULT 'unknown',
  candidate_status TEXT NOT NULL DEFAULT 'Candidate',
  verification_status TEXT DEFAULT 'Unverified',
  verification_reason TEXT DEFAULT '',
  discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verified_at TIMESTAMPTZ,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_backlink_candidate_site_url
  ON backlink_candidates(site_id, lower(source_url));

CREATE INDEX IF NOT EXISTS idx_backlink_candidates_site_status
  ON backlink_candidates(site_id, candidate_status);

CREATE INDEX IF NOT EXISTS idx_backlink_discovery_runs_site_started
  ON backlink_discovery_runs(site_id, started_at DESC);
