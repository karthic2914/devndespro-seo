CREATE TABLE IF NOT EXISTS link_index_pages (
  id BIGSERIAL PRIMARY KEY,
  url TEXT NOT NULL,
  normalized_url TEXT NOT NULL,
  domain TEXT NOT NULL,
  http_status INTEGER,
  content_type TEXT DEFAULT '',
  page_title TEXT DEFAULT '',
  canonical_url TEXT DEFAULT '',
  robots_allowed BOOLEAN DEFAULT TRUE,
  crawl_status TEXT NOT NULL DEFAULT 'Pending',
  crawl_depth INTEGER NOT NULL DEFAULT 0,
  first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_crawled TIMESTAMPTZ,
  next_crawl TIMESTAMPTZ,
  last_error TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_link_index_pages_normalized_url
  ON link_index_pages(lower(normalized_url));

CREATE TABLE IF NOT EXISTS link_index_edges (
  id BIGSERIAL PRIMARY KEY,
  source_url TEXT NOT NULL,
  source_domain TEXT NOT NULL,
  target_url TEXT NOT NULL,
  target_domain TEXT NOT NULL,
  anchor_text TEXT DEFAULT '',
  rel_nofollow BOOLEAN DEFAULT FALSE,
  rel_sponsored BOOLEAN DEFAULT FALSE,
  rel_ugc BOOLEAN DEFAULT FALSE,
  link_position TEXT DEFAULT '',
  first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_checked TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_present BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_link_index_edge
  ON link_index_edges(
    lower(source_url),
    lower(target_url),
    lower(anchor_text)
  );

CREATE INDEX IF NOT EXISTS idx_link_index_edges_target_domain
  ON link_index_edges(lower(target_domain));

CREATE TABLE IF NOT EXISTS link_index_runs (
  id BIGSERIAL PRIMARY KEY,
  site_id BIGINT REFERENCES sites(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'Running',
  seed_count INTEGER NOT NULL DEFAULT 0,
  pages_crawled INTEGER NOT NULL DEFAULT 0,
  pages_skipped INTEGER NOT NULL DEFAULT 0,
  links_extracted INTEGER NOT NULL DEFAULT 0,
  backlinks_detected INTEGER NOT NULL DEFAULT 0,
  errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);
