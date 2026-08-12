-- Run in Railway Postgres console

-- Section 3: raw per-question, per-engine test results
CREATE TABLE IF NOT EXISTS ai_visibility_results (
  id SERIAL PRIMARY KEY,
  site_id INTEGER NOT NULL,
  question TEXT NOT NULL,
  engine VARCHAR(20) NOT NULL,              -- 'chatgpt' | 'claude' | 'gemini' | 'perplexity'
  rankings JSONB NOT NULL,                  -- [{rank:1, name:"Semrush"}, ...] up to 10
  brand_rank INTEGER,                       -- null if not mentioned, 0 if mentioned but unranked
  raw_response TEXT,
  tested_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_avr_site ON ai_visibility_results(site_id);
CREATE INDEX IF NOT EXISTS idx_avr_site_question ON ai_visibility_results(site_id, question);

-- Section 7: weekly snapshot per engine, used for the trend chart
CREATE TABLE IF NOT EXISTS ai_visibility_history (
  id SERIAL PRIMARY KEY,
  site_id INTEGER NOT NULL,
  engine VARCHAR(20) NOT NULL,
  snapshot_date DATE NOT NULL,
  bucket VARCHAR(20) NOT NULL,              -- 'top3' | 'top10' | 'top20' | 'not_in_top20'
  avg_rank NUMERIC,
  UNIQUE(site_id, engine, snapshot_date)
);
CREATE INDEX IF NOT EXISTS idx_avh_site ON ai_visibility_history(site_id);

-- Section 5 & 6: cached reasoning + recommendations so we don't re-call Claude on every page load
CREATE TABLE IF NOT EXISTS ai_visibility_insights (
  id SERIAL PRIMARY KEY,
  site_id INTEGER NOT NULL UNIQUE,
  reasoning JSONB,                          -- [{issue, severity, detail}, ...]
  recommendations JSONB,                    -- [{title, priority, detail}, ...]
  generated_at TIMESTAMP DEFAULT NOW()
);

