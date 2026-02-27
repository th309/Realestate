-- Migration 113: Create user analytics tables for SaaS analytics suite
-- Tables: user_events, user_sessions, visitor_identities, daily_analytics,
--         funnel_definitions, page_classifications, analytics_annotations

-- ============================================================
-- Table 1: user_events — Unified event store
-- ============================================================
CREATE TABLE IF NOT EXISTS user_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_event_id VARCHAR(50),

  -- Identity
  visitor_id VARCHAR(50) NOT NULL,
  session_id VARCHAR(50) NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  user_tier VARCHAR(20) DEFAULT 'anonymous',

  -- Event classification
  event_category VARCHAR(30) NOT NULL,
  event_action VARCHAR(50) NOT NULL,
  event_label VARCHAR(200),
  numeric_value NUMERIC,

  -- Page context
  page_path VARCHAR(500),
  previous_page_path VARCHAR(500),

  -- Flexible properties
  properties JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (session_id, client_event_id)
);

CREATE INDEX IF NOT EXISTS idx_user_events_session ON user_events(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_user_events_visitor ON user_events(visitor_id, created_at);
CREATE INDEX IF NOT EXISTS idx_user_events_category_time ON user_events(event_category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_events_user ON user_events(user_id, created_at DESC) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_events_page ON user_events(page_path, created_at DESC) WHERE event_category = 'pageview';
CREATE INDEX IF NOT EXISTS idx_user_events_numeric ON user_events(event_category, event_action, numeric_value) WHERE numeric_value IS NOT NULL;

-- ============================================================
-- Table 2: user_sessions — Session-level aggregates
-- ============================================================
CREATE TABLE IF NOT EXISTS user_sessions (
  session_id VARCHAR(50) PRIMARY KEY,
  visitor_id VARCHAR(50) NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  user_tier VARCHAR(20) DEFAULT 'anonymous',

  -- Timing
  started_at TIMESTAMPTZ NOT NULL,
  last_activity_at TIMESTAMPTZ NOT NULL,
  duration_seconds INTEGER DEFAULT 0,

  -- Navigation summary
  landing_page VARCHAR(500),
  exit_page VARCHAR(500),
  page_count INTEGER DEFAULT 0,
  is_bounce BOOLEAN DEFAULT TRUE,
  heartbeat_count INTEGER DEFAULT 0,

  -- Acquisition
  referrer VARCHAR(500),
  referrer_domain VARCHAR(200),
  utm_source VARCHAR(100),
  utm_medium VARCHAR(100),
  utm_campaign VARCHAR(100),
  entry_type VARCHAR(20) DEFAULT 'direct',

  -- Device
  device_type VARCHAR(20),
  screen_width INTEGER,
  browser VARCHAR(50),
  os VARCHAR(50),

  -- Engagement depth
  feature_events_count INTEGER DEFAULT 0,
  unique_features_used INTEGER DEFAULT 0,
  max_scroll_depth INTEGER DEFAULT 0,
  had_frustration_event BOOLEAN DEFAULT FALSE,

  -- Outcome
  converted BOOLEAN DEFAULT FALSE,
  conversion_type VARCHAR(50),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_visitor ON user_sessions(visitor_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id, started_at DESC) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_sessions_time ON user_sessions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_sessions_landing ON user_sessions(landing_page, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_sessions_source ON user_sessions(entry_type, utm_source, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_sessions_converted ON user_sessions(converted, started_at DESC) WHERE converted = TRUE;
CREATE INDEX IF NOT EXISTS idx_user_sessions_bounce ON user_sessions(is_bounce, started_at DESC);

-- ============================================================
-- Table 3: visitor_identities — Anonymous-to-user stitching
-- ============================================================
CREATE TABLE IF NOT EXISTS visitor_identities (
  visitor_id VARCHAR(50) NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  first_seen_at TIMESTAMPTZ NOT NULL,
  identified_at TIMESTAMPTZ DEFAULT NOW(),
  sessions_before_identification INTEGER DEFAULT 0,
  signup_cohort DATE,
  acquisition_source VARCHAR(100),
  PRIMARY KEY (visitor_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_visitor_identities_user ON visitor_identities(user_id);
CREATE INDEX IF NOT EXISTS idx_visitor_identities_cohort ON visitor_identities(signup_cohort);

-- ============================================================
-- Table 4: daily_analytics — Rolled-up aggregates
-- ============================================================
CREATE TABLE IF NOT EXISTS daily_analytics (
  date DATE NOT NULL,
  metric_name VARCHAR(50) NOT NULL,
  dimension VARCHAR(100) DEFAULT 'all',
  user_tier VARCHAR(20) DEFAULT 'all',
  value NUMERIC NOT NULL,
  PRIMARY KEY (date, metric_name, dimension, user_tier)
);

-- ============================================================
-- Table 5: funnel_definitions — Custom funnels
-- ============================================================
CREATE TABLE IF NOT EXISTS funnel_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  steps JSONB NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Table 6: page_classifications — Page grouping lookup
-- ============================================================
CREATE TABLE IF NOT EXISTS page_classifications (
  path_pattern VARCHAR(200) PRIMARY KEY,
  page_group VARCHAR(50) NOT NULL,
  page_name VARCHAR(100),
  is_conversion_page BOOLEAN DEFAULT FALSE
);

-- ============================================================
-- Table 7: analytics_annotations — Timeline markers
-- ============================================================
CREATE TABLE IF NOT EXISTS analytics_annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  annotation_date DATE NOT NULL,
  label VARCHAR(200) NOT NULL,
  description TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_annotations_date ON analytics_annotations(annotation_date);

-- ============================================================
-- RLS Policies
-- ============================================================
ALTER TABLE user_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE visitor_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE funnel_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE page_classifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_annotations ENABLE ROW LEVEL SECURITY;

-- Service role: full access to all tables
CREATE POLICY "service_role_all_user_events" ON user_events FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_user_sessions" ON user_sessions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_visitor_identities" ON visitor_identities FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_daily_analytics" ON daily_analytics FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_funnel_definitions" ON funnel_definitions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_page_classifications" ON page_classifications FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_analytics_annotations" ON analytics_annotations FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Authenticated users: INSERT events (for client-side tracking), SELECT own data
CREATE POLICY "authenticated_insert_user_events" ON user_events FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated_select_user_events" ON user_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_insert_user_sessions" ON user_sessions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated_select_user_sessions" ON user_sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_select_daily_analytics" ON daily_analytics FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_select_funnel_definitions" ON funnel_definitions FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_select_page_classifications" ON page_classifications FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_select_analytics_annotations" ON analytics_annotations FOR SELECT TO authenticated USING (true);

-- Anon users: INSERT events only (for anonymous tracking via backend)
CREATE POLICY "anon_insert_user_events" ON user_events FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_insert_user_sessions" ON user_sessions FOR INSERT TO anon WITH CHECK (true);

-- ============================================================
-- Seed Data: Page Classifications
-- ============================================================
INSERT INTO page_classifications (path_pattern, page_group, page_name, is_conversion_page) VALUES
  ('/', 'landing', 'Homepage', TRUE),
  ('/map', 'tool', 'Interactive Map', FALSE),
  ('/map/*', 'tool', 'Map View', FALSE),
  ('/markets/*', 'market_detail', 'Market Detail', FALSE),
  ('/reports/*', 'tool', 'Reports', FALSE),
  ('/pricing', 'conversion', 'Pricing', TRUE),
  ('/account/*', 'account', 'Account', FALSE),
  ('/login', 'conversion', 'Login', TRUE),
  ('/signup', 'conversion', 'Signup', TRUE),
  ('/blog/*', 'content', 'Blog', FALSE),
  ('/admin/*', 'admin', 'Admin', FALSE)
ON CONFLICT (path_pattern) DO NOTHING;

-- ============================================================
-- Seed Data: Default Funnel Definitions
-- ============================================================
INSERT INTO funnel_definitions (name, steps, is_default) VALUES
  ('Signup Funnel', '[{"event_category":"pageview","event_action":"view"},{"event_category":"conversion","event_action":"signup_start"},{"event_category":"conversion","event_action":"signup_complete"}]'::jsonb, TRUE),
  ('Conversion Funnel', '[{"event_category":"conversion","event_action":"signup_complete"},{"event_category":"conversion","event_action":"trial_start"},{"event_category":"conversion","event_action":"upgrade_complete"}]'::jsonb, TRUE)
ON CONFLICT DO NOTHING;
