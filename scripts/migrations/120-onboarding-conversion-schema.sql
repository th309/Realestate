-- scripts/migrations/120-onboarding-conversion-schema.sql
-- Onboarding & Conversion System Schema Changes

-- ─── user_profiles: new columns ───
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS onboarding_market JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS onboarding_checklist JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS dismissed_beacons JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS usage_stats JSONB DEFAULT '{"markets_viewed":0,"scores_checked":0,"reports_generated":0}'::jsonb,
  ADD COLUMN IF NOT EXISTS free_report_credits INTEGER DEFAULT 1;

COMMENT ON COLUMN user_profiles.onboarding_market IS 'Market selected during guided onboarding: {geoLevel, geoId, name}';
COMMENT ON COLUMN user_profiles.onboarding_checklist IS 'Array of completed checklist task IDs';
COMMENT ON COLUMN user_profiles.dismissed_beacons IS 'Array of dismissed beacon IDs';
COMMENT ON COLUMN user_profiles.usage_stats IS 'Aggregated usage counters for personalized paywall';
COMMENT ON COLUMN user_profiles.free_report_credits IS 'Remaining free report credits post-trial (default 1)';

-- ─── market_engagement_stats: social proof aggregation ───
CREATE TABLE IF NOT EXISTS market_engagement_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  geo_level TEXT NOT NULL,
  geo_id TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  view_count INTEGER DEFAULT 0,
  score_check_count INTEGER DEFAULT 0,
  report_count INTEGER DEFAULT 0,
  tracking_user_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (geo_level, geo_id, date)
);

CREATE INDEX idx_engagement_stats_geo ON market_engagement_stats (geo_level, geo_id, date DESC);

-- RLS
ALTER TABLE market_engagement_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read engagement stats"
  ON market_engagement_stats FOR SELECT TO authenticated USING (true);
GRANT SELECT ON market_engagement_stats TO authenticated;
GRANT ALL ON market_engagement_stats TO service_role;

-- ─── email_triggers: behavioral email dedup ───
CREATE TABLE IF NOT EXISTS email_triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  trigger_name TEXT NOT NULL,
  fired_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb,
  UNIQUE (user_id, trigger_name)
);

CREATE INDEX idx_email_triggers_user ON email_triggers (user_id);

ALTER TABLE email_triggers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only for email_triggers"
  ON email_triggers FOR ALL TO service_role USING (true);
GRANT ALL ON email_triggers TO service_role;

-- ─── aggregate_market_engagement: nightly social proof aggregation ───
CREATE OR REPLACE FUNCTION aggregate_market_engagement(target_date DATE)
RETURNS TABLE (geo_level TEXT, geo_id TEXT, date DATE, view_count INT, score_check_count INT, report_count INT, tracking_user_count INT)
LANGUAGE sql STABLE AS $$
  SELECT
    (properties->>'geo_level')::text AS geo_level,
    (properties->>'geo_id')::text AS geo_id,
    target_date AS date,
    COUNT(*) FILTER (WHERE event_action = 'page_view')::int AS view_count,
    COUNT(*) FILTER (WHERE event_action = 'score_view')::int AS score_check_count,
    COUNT(*) FILTER (WHERE event_action = 'report_generate')::int AS report_count,
    COUNT(DISTINCT user_id)::int AS tracking_user_count
  FROM user_events
  WHERE created_at::date = target_date
    AND properties->>'geo_level' IS NOT NULL
    AND properties->>'geo_id' IS NOT NULL
  GROUP BY properties->>'geo_level', properties->>'geo_id';
$$;

-- ─── trial_config: enable reverse trial for all new signups ───
UPDATE trial_config SET is_enabled = true, show_banner = true WHERE id = (SELECT id FROM trial_config LIMIT 1);
