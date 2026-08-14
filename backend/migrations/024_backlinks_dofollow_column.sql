-- Compatibility column used by summary / authority helpers.
-- Source of truth remains type + rel_nofollow; dofollow is derived.

ALTER TABLE backlinks
  ADD COLUMN IF NOT EXISTS dofollow BOOLEAN;

UPDATE backlinks
SET dofollow = CASE
  WHEN COALESCE(rel_nofollow, FALSE) = TRUE THEN FALSE
  WHEN LOWER(COALESCE(type, '')) = 'nofollow' THEN FALSE
  ELSE TRUE
END
WHERE dofollow IS NULL
   OR dofollow IS DISTINCT FROM (
     CASE
       WHEN COALESCE(rel_nofollow, FALSE) = TRUE THEN FALSE
       WHEN LOWER(COALESCE(type, '')) = 'nofollow' THEN FALSE
       ELSE TRUE
     END
   );

CREATE INDEX IF NOT EXISTS idx_backlinks_site_dofollow_live
  ON backlinks(site_id, dofollow)
  WHERE is_live = TRUE;
