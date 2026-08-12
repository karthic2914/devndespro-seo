-- Run in Railway Postgres console

CREATE TABLE IF NOT EXISTS custom_questions (
  id SERIAL PRIMARY KEY,
  site_id INTEGER NOT NULL,
  question TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_custom_questions_site ON custom_questions(site_id);

