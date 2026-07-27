-- Durable per-metro b-roll cache for the video-card feed lane.
--
-- Mirrors metro_hero_images (the photo cache) so both media chains behave the
-- same way: one Pexels call per metro ever, bytes persisted to the
-- content-pipeline storage bucket, and the row is the cache index. The sample
-- script cached b-roll on local disk, which does not survive a deploy and is
-- invisible to other workers — this replaces that.
--
-- Only clips that passed the slug/tags alignment gate are ever written here, so
-- a cache hit is by definition a city-confident clip.

CREATE TABLE IF NOT EXISTS metro_broll_videos (
  cbsa_code TEXT NOT NULL,
  -- "pexels-<id>", matching the option_id convention in metro_hero_images.
  option_id TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  source_url TEXT NOT NULL,
  duration_sec INTEGER,
  width INTEGER,
  height INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (cbsa_code, option_id)
);

CREATE INDEX IF NOT EXISTS idx_metro_broll_videos_updated
  ON metro_broll_videos (updated_at DESC);

ALTER TABLE metro_broll_videos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_all ON metro_broll_videos;
CREATE POLICY service_role_all ON metro_broll_videos FOR ALL USING (true);
GRANT ALL ON metro_broll_videos TO service_role;
GRANT SELECT ON metro_broll_videos TO authenticated;
