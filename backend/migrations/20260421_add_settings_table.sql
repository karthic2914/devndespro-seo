-- Add a global settings table for admin toggles
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default for cold_emails_enabled if not present
INSERT INTO settings (key, value)
  VALUES ('cold_emails_enabled', 'true')
  ON CONFLICT (key) DO NOTHING;
