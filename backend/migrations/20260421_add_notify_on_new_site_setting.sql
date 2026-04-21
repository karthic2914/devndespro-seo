-- Add notify_on_new_site setting for admin notification toggle
INSERT INTO settings (key, value)
  VALUES ('notify_on_new_site', 'true')
  ON CONFLICT (key) DO NOTHING;
