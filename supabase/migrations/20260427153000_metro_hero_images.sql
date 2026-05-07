-- Cached long-form metro skyline images (downloaded once per CBSA, reused on render).
CREATE TABLE IF NOT EXISTS metro_hero_images (
  cbsa_code TEXT PRIMARY KEY,
  storage_path TEXT NOT NULL,
  source_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_metro_hero_images_updated ON metro_hero_images (updated_at DESC);

ALTER TABLE metro_hero_images ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_all ON metro_hero_images;
CREATE POLICY service_role_all ON metro_hero_images FOR ALL USING (true);
GRANT ALL ON metro_hero_images TO service_role;
GRANT SELECT ON metro_hero_images TO authenticated;
