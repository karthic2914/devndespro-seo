const { pool } = require('./clients')

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      photo TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS sites (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS seo_metrics (
      id SERIAL PRIMARY KEY,
      site_id INTEGER UNIQUE REFERENCES sites(id) ON DELETE CASCADE,
      dr INTEGER DEFAULT 0,
      clicks INTEGER DEFAULT 0,
      impressions INTEGER DEFAULT 0,
      health INTEGER DEFAULT 100,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS keywords (
      id SERIAL PRIMARY KEY,
      site_id INTEGER REFERENCES sites(id) ON DELETE CASCADE,
      keyword TEXT NOT NULL,
      volume INTEGER DEFAULT 0,
      difficulty TEXT DEFAULT 'Easy',
      position INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS backlinks (
      id SERIAL PRIMARY KEY,
      site_id INTEGER REFERENCES sites(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      dr INTEGER DEFAULT 0,
      status TEXT DEFAULT 'Todo',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    ALTER TABLE backlinks ADD COLUMN IF NOT EXISTS anchor TEXT DEFAULT '';
    ALTER TABLE backlinks ADD COLUMN IF NOT EXISTS url TEXT DEFAULT '';
    ALTER TABLE backlinks ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'dofollow';
    ALTER TABLE backlinks ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';
    CREATE TABLE IF NOT EXISTS competitors (
      id SERIAL PRIMARY KEY,
      site_id INTEGER REFERENCES sites(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      dr INTEGER DEFAULT 0,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS actions (
      id SERIAL PRIMARY KEY,
      site_id INTEGER REFERENCES sites(id) ON DELETE CASCADE,
      text TEXT NOT NULL,
      impact TEXT DEFAULT 'Medium',
      done BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS audit_results (
      id SERIAL PRIMARY KEY,
      site_id INTEGER REFERENCES sites(id) ON DELETE CASCADE,
      results JSONB,
      score INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS alerts (
      id SERIAL PRIMARY KEY,
      site_id INTEGER REFERENCES sites(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      severity TEXT DEFAULT 'info',
      read BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS integration_settings (
      site_id INTEGER PRIMARY KEY REFERENCES sites(id) ON DELETE CASCADE,
      ga4_connected BOOLEAN DEFAULT FALSE,
      ga4_property_id TEXT,
      ga4_measurement_id TEXT,
      ahrefs_connected BOOLEAN DEFAULT FALSE,
      ahrefs_last_import_at TIMESTAMPTZ,
      ahrefs_source TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS ahrefs_metrics (
      id SERIAL PRIMARY KEY,
      site_id INTEGER REFERENCES sites(id) ON DELETE CASCADE,
      dr INTEGER DEFAULT 0,
      backlinks INTEGER DEFAULT 0,
      ref_domains INTEGER DEFAULT 0,
      organic_traffic INTEGER DEFAULT 0,
      organic_keywords INTEGER DEFAULT 0,
      source TEXT DEFAULT 'manual',
      imported_at TIMESTAMPTZ DEFAULT NOW()
    );
    ALTER TABLE users ADD COLUMN IF NOT EXISTS gsc_refresh_token TEXT;
    ALTER TABLE competitors ADD COLUMN IF NOT EXISTS url TEXT DEFAULT '';

    CREATE TABLE IF NOT EXISTS email_report_settings (
      id SERIAL PRIMARY KEY,
      site_id INTEGER UNIQUE REFERENCES sites(id) ON DELETE CASCADE,
      enabled BOOLEAN DEFAULT FALSE,
      recipients TEXT[] DEFAULT ARRAY[]::TEXT[],
      send_hour INTEGER DEFAULT 8,
      last_sent_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Compatibility migrations for older deployments
    ALTER TABLE seo_metrics ADD COLUMN IF NOT EXISTS site_id INTEGER;
    ALTER TABLE seo_metrics ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
    ALTER TABLE keywords ADD COLUMN IF NOT EXISTS site_id INTEGER;
    ALTER TABLE keywords ADD COLUMN IF NOT EXISTS rank_state JSONB DEFAULT '{}'::jsonb;
    ALTER TABLE backlinks ADD COLUMN IF NOT EXISTS site_id INTEGER;
    ALTER TABLE competitors ADD COLUMN IF NOT EXISTS site_id INTEGER;
    ALTER TABLE actions ADD COLUMN IF NOT EXISTS site_id INTEGER;

    UPDATE seo_metrics sm SET site_id = sm.id WHERE sm.site_id IS NULL AND EXISTS (SELECT 1 FROM sites s WHERE s.id = sm.id);
    UPDATE keywords k SET site_id = k.id WHERE k.site_id IS NULL AND EXISTS (SELECT 1 FROM sites s WHERE s.id = k.id);
    UPDATE backlinks b SET site_id = b.id WHERE b.site_id IS NULL AND EXISTS (SELECT 1 FROM sites s WHERE s.id = b.id);
    UPDATE competitors c SET site_id = c.id WHERE c.site_id IS NULL AND EXISTS (SELECT 1 FROM sites s WHERE s.id = c.id);
    UPDATE actions a SET site_id = a.id WHERE a.site_id IS NULL AND EXISTS (SELECT 1 FROM sites s WHERE s.id = a.id);

    CREATE UNIQUE INDEX IF NOT EXISTS seo_metrics_site_id_uidx ON seo_metrics(site_id) WHERE site_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS keywords_site_id_idx ON keywords(site_id);
    CREATE INDEX IF NOT EXISTS backlinks_site_id_idx ON backlinks(site_id);
    CREATE INDEX IF NOT EXISTS competitors_site_id_idx ON competitors(site_id);
    CREATE INDEX IF NOT EXISTS actions_site_id_idx ON actions(site_id);

    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'seo_metrics_site_id_fkey') THEN
        ALTER TABLE seo_metrics ADD CONSTRAINT seo_metrics_site_id_fkey FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE;
      END IF;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'keywords_site_id_fkey') THEN
        ALTER TABLE keywords ADD CONSTRAINT keywords_site_id_fkey FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'backlinks_site_id_fkey') THEN
        ALTER TABLE backlinks ADD CONSTRAINT backlinks_site_id_fkey FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'competitors_site_id_fkey') THEN
        ALTER TABLE competitors ADD CONSTRAINT competitors_site_id_fkey FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'actions_site_id_fkey') THEN
        ALTER TABLE actions ADD CONSTRAINT actions_site_id_fkey FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE;
      END IF;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
    CREATE TABLE IF NOT EXISTS invited_users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      token TEXT,
      status TEXT DEFAULT 'pending',
      invited_by INTEGER REFERENCES users(id),
      invited_at TIMESTAMPTZ DEFAULT NOW(),
      accepted_at TIMESTAMPTZ
    );
    ALTER TABLE invited_users ADD COLUMN IF NOT EXISTS site_id INTEGER REFERENCES sites(id) ON DELETE CASCADE;
    
    CREATE TABLE IF NOT EXISTS site_access (
      id SERIAL PRIMARY KEY,
      site_id INTEGER REFERENCES sites(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(site_id, user_id)
    );
CREATE TABLE IF NOT EXISTS keyword_searches (
  id SERIAL PRIMARY KEY,
  site_id INTEGER REFERENCES sites(id) ON DELETE CASCADE UNIQUE,
  query TEXT NOT NULL,
  results JSONB NOT NULL,
  searched_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS keyword_searches_site_id_uidx ON keyword_searches(site_id);
  
  `)
  console.log('DB initialized')
}

module.exports = { initDB }
