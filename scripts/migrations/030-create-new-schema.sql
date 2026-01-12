-- Migration 030: Create New PropertyIQ Schema
-- This creates 23 new tables for the restructured database
-- Old tables remain untouched for safe rollback

BEGIN;

-- ============================================================================
-- SECTION 1: RAW DATA TABLES (6)
-- ============================================================================

-- 1. Zillow Metro Data (Long Format)
CREATE TABLE IF NOT EXISTS zillow_metro (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id INTEGER NOT NULL,
  region_name TEXT NOT NULL,
  state_code TEXT,
  cbsa_code TEXT,
  period_date DATE NOT NULL,
  metric_name TEXT NOT NULL,
  value NUMERIC,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(region_id, period_date, metric_name)
);

CREATE INDEX IF NOT EXISTS idx_zillow_metro_region ON zillow_metro(region_id);
CREATE INDEX IF NOT EXISTS idx_zillow_metro_date ON zillow_metro(period_date);
CREATE INDEX IF NOT EXISTS idx_zillow_metro_metric ON zillow_metro(metric_name);
CREATE INDEX IF NOT EXISTS idx_zillow_metro_region_metric ON zillow_metro(region_id, metric_name);
CREATE INDEX IF NOT EXISTS idx_zillow_metro_cbsa ON zillow_metro(cbsa_code);

-- 2. Zillow County Data (Long Format)
CREATE TABLE IF NOT EXISTS zillow_county (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id INTEGER NOT NULL,
  region_name TEXT NOT NULL,
  state_code TEXT,
  fips_code TEXT,
  period_date DATE NOT NULL,
  metric_name TEXT NOT NULL,
  value NUMERIC,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(region_id, period_date, metric_name)
);

CREATE INDEX IF NOT EXISTS idx_zillow_county_region ON zillow_county(region_id);
CREATE INDEX IF NOT EXISTS idx_zillow_county_date ON zillow_county(period_date);
CREATE INDEX IF NOT EXISTS idx_zillow_county_metric ON zillow_county(metric_name);
CREATE INDEX IF NOT EXISTS idx_zillow_county_fips ON zillow_county(fips_code);
CREATE INDEX IF NOT EXISTS idx_zillow_county_state ON zillow_county(state_code);

-- 3. Zillow ZIP Data (Long Format)
CREATE TABLE IF NOT EXISTS zillow_zip (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id INTEGER NOT NULL,
  region_name TEXT NOT NULL,
  state_code TEXT,
  zip_code TEXT,
  metro_region_id INTEGER,
  county_fips TEXT,
  period_date DATE NOT NULL,
  metric_name TEXT NOT NULL,
  value NUMERIC,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(region_id, period_date, metric_name)
);

CREATE INDEX IF NOT EXISTS idx_zillow_zip_region ON zillow_zip(region_id);
CREATE INDEX IF NOT EXISTS idx_zillow_zip_date ON zillow_zip(period_date);
CREATE INDEX IF NOT EXISTS idx_zillow_zip_metric ON zillow_zip(metric_name);
CREATE INDEX IF NOT EXISTS idx_zillow_zip_zipcode ON zillow_zip(zip_code);
CREATE INDEX IF NOT EXISTS idx_zillow_zip_metro ON zillow_zip(metro_region_id);

-- 4. Zillow State Data (Long Format)
CREATE TABLE IF NOT EXISTS zillow_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id INTEGER NOT NULL,
  region_name TEXT NOT NULL,
  state_code TEXT NOT NULL,
  period_date DATE NOT NULL,
  metric_name TEXT NOT NULL,
  value NUMERIC,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(region_id, period_date, metric_name)
);

CREATE INDEX IF NOT EXISTS idx_zillow_state_region ON zillow_state(region_id);
CREATE INDEX IF NOT EXISTS idx_zillow_state_date ON zillow_state(period_date);
CREATE INDEX IF NOT EXISTS idx_zillow_state_metric ON zillow_state(metric_name);
CREATE INDEX IF NOT EXISTS idx_zillow_state_code ON zillow_state(state_code);

-- 5. Census Data (Long Format)
CREATE TABLE IF NOT EXISTS census_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  geography_id TEXT NOT NULL,
  geography_type TEXT NOT NULL,
  geography_name TEXT,
  year INTEGER NOT NULL,
  category TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  value NUMERIC,
  source_table TEXT,
  margin_of_error NUMERIC,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(geography_id, geography_type, year, metric_name)
);

CREATE INDEX IF NOT EXISTS idx_census_geo ON census_data(geography_id, geography_type);
CREATE INDEX IF NOT EXISTS idx_census_year ON census_data(year);
CREATE INDEX IF NOT EXISTS idx_census_category ON census_data(category);
CREATE INDEX IF NOT EXISTS idx_census_metric ON census_data(metric_name);

-- 6. FRED Data (Long Format)
CREATE TABLE IF NOT EXISTS fred_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  geography_id TEXT NOT NULL,
  geography_type TEXT NOT NULL,
  period_date DATE NOT NULL,
  series_id TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  category TEXT NOT NULL,
  value NUMERIC,
  units TEXT,
  frequency TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(geography_id, series_id, period_date)
);

CREATE INDEX IF NOT EXISTS idx_fred_geo ON fred_data(geography_id, geography_type);
CREATE INDEX IF NOT EXISTS idx_fred_date ON fred_data(period_date);
CREATE INDEX IF NOT EXISTS idx_fred_series ON fred_data(series_id);
CREATE INDEX IF NOT EXISTS idx_fred_category ON fred_data(category);

-- ============================================================================
-- SECTION 2: REFERENCE TABLES (3)
-- ============================================================================

-- 7. Geographies (Unified geography reference)
CREATE TABLE IF NOT EXISTS geographies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  geography_id TEXT NOT NULL,
  geography_type TEXT NOT NULL,
  name TEXT NOT NULL,
  name_short TEXT,
  state_code TEXT,
  state_name TEXT,
  state_fips TEXT,
  parent_metro_id TEXT,
  parent_county_id TEXT,
  cbsa_code TEXT,
  cbsa_name TEXT,
  cbsa_type TEXT,
  fips_code TEXT,
  county_name TEXT,

  -- Zillow ID mappings (critical for data joins)
  zillow_region_id INTEGER,
  zillow_state_region_id INTEGER,
  zillow_county_region_id INTEGER,
  zillow_metro_region_id INTEGER,
  zillow_metro_name TEXT,

  -- Coordinates
  latitude NUMERIC(9,6),
  longitude NUMERIC(9,6),

  -- Risk zone flags
  is_coastal BOOLEAN DEFAULT FALSE,
  is_fire_zone BOOLEAN DEFAULT FALSE,
  is_flood_zone BOOLEAN DEFAULT FALSE,

  -- Demographics
  population INTEGER,
  land_area_sqmi NUMERIC(12,2),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(geography_id, geography_type)
);

CREATE INDEX IF NOT EXISTS idx_geo_type ON geographies(geography_type);
CREATE INDEX IF NOT EXISTS idx_geo_state ON geographies(state_code);
CREATE INDEX IF NOT EXISTS idx_geo_cbsa ON geographies(cbsa_code);
CREATE INDEX IF NOT EXISTS idx_geo_fips ON geographies(fips_code);
CREATE INDEX IF NOT EXISTS idx_geo_zillow_region ON geographies(zillow_region_id);
CREATE INDEX IF NOT EXISTS idx_geo_zillow_state ON geographies(zillow_state_region_id);
CREATE INDEX IF NOT EXISTS idx_geo_zillow_county ON geographies(zillow_county_region_id);
CREATE INDEX IF NOT EXISTS idx_geo_zillow_metro ON geographies(zillow_metro_region_id);
CREATE INDEX IF NOT EXISTS idx_geo_parent_metro ON geographies(parent_metro_id);

-- 8. Metric Definitions
CREATE TABLE IF NOT EXISTS metric_definitions (
  metric_name TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  short_name TEXT,
  description TEXT,
  category TEXT,
  subcategory TEXT,
  format TEXT,
  precision INTEGER DEFAULT 0,
  prefix TEXT,
  suffix TEXT,
  direction TEXT,
  chart_type TEXT DEFAULT 'line',
  color_scale TEXT DEFAULT 'neutral',
  source TEXT,
  source_table TEXT,
  update_frequency TEXT,
  available_geo_types TEXT[],
  homeready_component TEXT,
  homeready_weight NUMERIC(5,4),
  investoredge_component TEXT,
  investoredge_weight NUMERIC(5,4),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_metric_category ON metric_definitions(category);
CREATE INDEX IF NOT EXISTS idx_metric_source ON metric_definitions(source);

-- 9. Metric Percentiles
CREATE TABLE IF NOT EXISTS metric_percentiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name TEXT NOT NULL,
  geography_type TEXT NOT NULL,
  period_date DATE NOT NULL,
  p10 NUMERIC,
  p20 NUMERIC,
  p30 NUMERIC,
  p40 NUMERIC,
  p50 NUMERIC,
  p60 NUMERIC,
  p70 NUMERIC,
  p80 NUMERIC,
  p90 NUMERIC,
  min_value NUMERIC,
  max_value NUMERIC,
  count_values INTEGER,
  mean_value NUMERIC,
  stddev_value NUMERIC,
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(metric_name, geography_type, period_date)
);

CREATE INDEX IF NOT EXISTS idx_percentile_metric ON metric_percentiles(metric_name);
CREATE INDEX IF NOT EXISTS idx_percentile_geo ON metric_percentiles(geography_type);
CREATE INDEX IF NOT EXISTS idx_percentile_date ON metric_percentiles(period_date);

-- ============================================================================
-- SECTION 3: CALCULATED METRICS (1)
-- ============================================================================

-- 10. Calculated Metrics
CREATE TABLE IF NOT EXISTS calculated_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  geography_id TEXT NOT NULL,
  geography_type TEXT NOT NULL,
  geography_name TEXT,
  period_date DATE NOT NULL,

  -- Derived from ZHVI/ZORI
  grm NUMERIC(8,2),
  rent_price_ratio NUMERIC(6,4),
  cap_rate_proxy NUMERIC(5,3),
  price_rent_ratio NUMERIC(8,2),

  -- YoY changes
  zhvi_yoy_change NUMERIC(6,3),
  zori_yoy_change NUMERIC(6,3),
  inventory_yoy_change NUMERIC(6,3),

  -- Multi-year changes
  zhvi_3y_change NUMERIC(6,3),
  zhvi_5y_change NUMERIC(6,3),

  -- 90-day momentum
  zhvi_90d_change NUMERIC(6,3),
  zori_90d_change NUMERIC(6,3),
  inventory_90d_change NUMERIC(6,3),
  dom_90d_change NUMERIC(6,3),

  -- Volatility (std dev)
  zhvi_stddev_12m NUMERIC(12,2),
  zhvi_stddev_36m NUMERIC(12,2),
  zori_stddev_12m NUMERIC(12,2),
  inventory_stddev_12m NUMERIC(12,2),
  dom_stddev_12m NUMERIC(8,2),

  -- Affordability derived
  income_gap_ratio NUMERIC(6,3),
  price_trend_deviation NUMERIC(6,3),

  -- Risk indicators
  inventory_vs_history_pct NUMERIC(5,2),
  affordability_percentile NUMERIC(5,2),
  months_of_supply NUMERIC(5,2),

  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(geography_id, geography_type, period_date)
);

CREATE INDEX IF NOT EXISTS idx_calc_geo ON calculated_metrics(geography_id, geography_type);
CREATE INDEX IF NOT EXISTS idx_calc_date ON calculated_metrics(period_date);

-- ============================================================================
-- SECTION 4: PROPERTYIQ SCORES (3)
-- ============================================================================

-- 11. PropertyIQ Scores (Main)
CREATE TABLE IF NOT EXISTS propertyiq_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  geography_id TEXT NOT NULL,
  geography_type TEXT NOT NULL,
  geography_name TEXT NOT NULL,
  state_code TEXT,
  parent_geography_id TEXT,
  period_date DATE NOT NULL,

  -- HomeReady Score (Homebuyers/Renters) - 0 to 100
  homeready_score NUMERIC(5,2),
  homeready_affordability NUMERIC(5,2),
  homeready_stability NUMERIC(5,2),
  homeready_value NUMERIC(5,2),
  homeready_livability NUMERIC(5,2),
  homeready_momentum NUMERIC(5,2),
  homeready_trend TEXT,
  homeready_trend_change NUMERIC(5,2),

  -- InvestorEdge Score (Investors) - 0 to 100
  investoredge_score NUMERIC(5,2),
  investoredge_cashflow NUMERIC(5,2),
  investoredge_growth NUMERIC(5,2),
  investoredge_demand NUMERIC(5,2),
  investoredge_entrypoint NUMERIC(5,2),
  investoredge_risk NUMERIC(5,2),
  investoredge_trend TEXT,
  investoredge_trend_change NUMERIC(5,2),

  -- Confidence
  confidence_level TEXT NOT NULL DEFAULT 'medium',
  metrics_available INTEGER,
  metrics_total INTEGER,
  data_freshness_days INTEGER,

  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  calculation_version TEXT,
  UNIQUE(geography_id, geography_type, period_date)
);

CREATE INDEX IF NOT EXISTS idx_piq_geo ON propertyiq_scores(geography_id, geography_type);
CREATE INDEX IF NOT EXISTS idx_piq_date ON propertyiq_scores(period_date);
CREATE INDEX IF NOT EXISTS idx_piq_homeready ON propertyiq_scores(homeready_score);
CREATE INDEX IF NOT EXISTS idx_piq_investoredge ON propertyiq_scores(investoredge_score);
CREATE INDEX IF NOT EXISTS idx_piq_state ON propertyiq_scores(state_code);

-- 12. PropertyIQ Score Details (Pro Tier)
CREATE TABLE IF NOT EXISTS propertyiq_score_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  score_id UUID REFERENCES propertyiq_scores(id) ON DELETE CASCADE,
  score_type TEXT NOT NULL,
  component TEXT NOT NULL,
  component_score NUMERIC(5,2),
  component_weight NUMERIC(5,4),
  weighted_contribution NUMERIC(5,2),
  metrics JSONB NOT NULL,
  helping_factors TEXT[],
  hurting_factors TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_piq_detail_score ON propertyiq_score_details(score_id);
CREATE INDEX IF NOT EXISTS idx_piq_detail_type ON propertyiq_score_details(score_type);

-- 13. PropertyIQ Score History (Backtesting)
CREATE TABLE IF NOT EXISTS propertyiq_score_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  geography_id TEXT NOT NULL,
  geography_type TEXT NOT NULL,
  period_date DATE NOT NULL,
  homeready_score NUMERIC(5,2),
  investoredge_score NUMERIC(5,2),
  homeready_components JSONB,
  investoredge_components JSONB,

  -- Actual outcomes (filled retrospectively)
  actual_appreciation_12m NUMERIC(6,3),
  actual_appreciation_24m NUMERIC(6,3),
  actual_rent_growth_12m NUMERIC(6,3),
  actual_rent_growth_24m NUMERIC(6,3),
  actual_dom_avg_12m NUMERIC(6,2),
  actual_inventory_change_12m NUMERIC(6,3),
  prediction_error_12m NUMERIC(6,3),
  prediction_error_24m NUMERIC(6,3),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  outcomes_updated_at TIMESTAMPTZ,
  UNIQUE(geography_id, geography_type, period_date)
);

CREATE INDEX IF NOT EXISTS idx_piq_hist_geo ON propertyiq_score_history(geography_id, geography_type);
CREATE INDEX IF NOT EXISTS idx_piq_hist_date ON propertyiq_score_history(period_date);

-- ============================================================================
-- SECTION 5: REPORTS (3)
-- ============================================================================

-- 14. Reports
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  organization_id UUID,
  report_type TEXT NOT NULL,
  title TEXT NOT NULL,
  primary_geography_id TEXT NOT NULL,
  primary_geography_type TEXT NOT NULL,
  primary_geography_name TEXT NOT NULL,
  comparison_geographies JSONB,
  user_inputs JSONB,
  static_content JSONB,
  ai_narrative JSONB,
  ai_model_used TEXT,
  ai_model_version TEXT,
  scores_snapshot JSONB,
  news_snapshot JSONB,
  status TEXT DEFAULT 'generating',
  error_message TEXT,
  generation_started_at TIMESTAMPTZ,
  generation_completed_at TIMESTAMPTZ,
  data_as_of_date DATE,
  branding JSONB,
  view_count INTEGER DEFAULT 0,
  last_viewed_at TIMESTAMPTZ,
  pdf_generated_at TIMESTAMPTZ,
  pdf_url TEXT,
  is_public BOOLEAN DEFAULT FALSE,
  public_slug TEXT UNIQUE,
  share_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_reports_user ON reports(user_id);
CREATE INDEX IF NOT EXISTS idx_reports_org ON reports(organization_id);
CREATE INDEX IF NOT EXISTS idx_reports_type ON reports(report_type);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_slug ON reports(public_slug);

-- 15. Report Conversations
CREATE TABLE IF NOT EXISTS report_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID REFERENCES reports(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  messages JSONB NOT NULL DEFAULT '[]',
  message_count INTEGER DEFAULT 0,
  learned_profile JSONB,
  exchanges_used INTEGER DEFAULT 0,
  exchanges_limit INTEGER,
  status TEXT DEFAULT 'active',
  context_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_conv_report ON report_conversations(report_id);
CREATE INDEX IF NOT EXISTS idx_conv_user ON report_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conv_status ON report_conversations(status);

-- 16. User Report Memory (Pro Tier)
CREATE TABLE IF NOT EXISTS user_report_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  researched_geographies JSONB DEFAULT '[]',
  investment_criteria JSONB,
  personal_context JSONB,
  ruled_out_markets JSONB,
  favorite_markets JSONB,
  key_insights JSONB DEFAULT '[]',
  preferred_report_types TEXT[],
  communication_style TEXT,
  remember_preferences BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_memory_user ON user_report_memory(user_id);

-- ============================================================================
-- SECTION 6: APPLICATION TABLES (4)
-- ============================================================================

-- 17. News Cache
CREATE TABLE IF NOT EXISTS news_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  geography_id TEXT NOT NULL,
  geography_type TEXT NOT NULL,
  news_category TEXT NOT NULL,
  news_items JSONB NOT NULL,
  item_count INTEGER DEFAULT 0,
  search_query TEXT,
  source_api TEXT,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  UNIQUE(geography_id, geography_type, news_category)
);

CREATE INDEX IF NOT EXISTS idx_news_geo ON news_cache(geography_id, geography_type);
CREATE INDEX IF NOT EXISTS idx_news_expires ON news_cache(expires_at);

-- 18. User Profiles
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  subscription_tier TEXT DEFAULT 'free',
  subscription_status TEXT DEFAULT 'active',
  subscription_started_at TIMESTAMPTZ,
  subscription_ends_at TIMESTAMPTZ,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  reports_generated_this_month INTEGER DEFAULT 0,
  reports_limit INTEGER DEFAULT 2,
  billing_period_start DATE,
  billing_period_end DATE,
  organization_id UUID,
  organization_role TEXT,
  default_geography_id TEXT,
  default_geography_type TEXT,
  preferred_report_type TEXT,
  email_notifications BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_profile_email ON user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_profile_org ON user_profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_profile_tier ON user_profiles(subscription_tier);

-- 19. Organizations (Enterprise/White Label)
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  primary_color TEXT,
  secondary_color TEXT,
  accent_color TEXT,
  website_url TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  custom_domain TEXT,
  show_powered_by BOOLEAN DEFAULT TRUE,
  custom_disclaimer TEXT,
  custom_footer TEXT,
  subscription_tier TEXT DEFAULT 'enterprise',
  subscription_status TEXT DEFAULT 'active',
  max_users INTEGER DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_slug ON organizations(slug);

-- 20. User Alerts
CREATE TABLE IF NOT EXISTS user_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  geography_id TEXT NOT NULL,
  geography_type TEXT NOT NULL,
  geography_name TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  condition_type TEXT NOT NULL,
  threshold_value NUMERIC,
  threshold_percent NUMERIC,
  is_active BOOLEAN DEFAULT TRUE,
  is_triggered BOOLEAN DEFAULT FALSE,
  last_checked_at TIMESTAMPTZ,
  last_triggered_at TIMESTAMPTZ,
  trigger_count INTEGER DEFAULT 0,
  notify_email BOOLEAN DEFAULT TRUE,
  notify_push BOOLEAN DEFAULT FALSE,
  source_report_id UUID REFERENCES reports(id) ON DELETE SET NULL,
  source_conversation_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_alert_user ON user_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_alert_geo ON user_alerts(geography_id, geography_type);
CREATE INDEX IF NOT EXISTS idx_alert_active ON user_alerts(is_active);

-- ============================================================================
-- SECTION 7: INFRASTRUCTURE TABLES (3)
-- ============================================================================

-- 21. Data Ingestion Log
CREATE TABLE IF NOT EXISTS data_ingestion_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id TEXT,
  source TEXT NOT NULL,
  table_name TEXT NOT NULL,
  metric_name TEXT,
  geography_type TEXT,
  records_processed INTEGER DEFAULT 0,
  records_inserted INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,
  status TEXT DEFAULT 'running',
  error_message TEXT,
  error_details JSONB,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  source_url TEXT,
  source_file_date DATE,
  data_period_start DATE,
  data_period_end DATE
);

CREATE INDEX IF NOT EXISTS idx_ingest_source ON data_ingestion_log(source);
CREATE INDEX IF NOT EXISTS idx_ingest_table ON data_ingestion_log(table_name);
CREATE INDEX IF NOT EXISTS idx_ingest_status ON data_ingestion_log(status);
CREATE INDEX IF NOT EXISTS idx_ingest_started ON data_ingestion_log(started_at);

-- 22. Data Source Registry
CREATE TABLE IF NOT EXISTS data_source_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_name TEXT NOT NULL,
  table_name TEXT NOT NULL,
  metric_name TEXT,
  source_url TEXT,
  source_type TEXT,
  update_frequency TEXT,
  expected_update_day INTEGER,
  is_active BOOLEAN DEFAULT TRUE,
  last_successful_ingestion TIMESTAMPTZ,
  last_attempted_ingestion TIMESTAMPTZ,
  last_error TEXT,
  consecutive_failures INTEGER DEFAULT 0,
  earliest_data_date DATE,
  latest_data_date DATE,
  record_count INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source_name, table_name, metric_name)
);

CREATE INDEX IF NOT EXISTS idx_registry_source ON data_source_registry(source_name);
CREATE INDEX IF NOT EXISTS idx_registry_active ON data_source_registry(is_active);

-- 23. Score Calculation Log
CREATE TABLE IF NOT EXISTS score_calculation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id TEXT,
  calculation_version TEXT,
  period_date DATE NOT NULL,
  geography_type TEXT,
  geographies_processed INTEGER DEFAULT 0,
  scores_calculated INTEGER DEFAULT 0,
  scores_failed INTEGER DEFAULT 0,
  distribution_check_passed BOOLEAN,
  anomaly_count INTEGER,
  anomalies JSONB,
  status TEXT DEFAULT 'running',
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_seconds INTEGER
);

CREATE INDEX IF NOT EXISTS idx_scorelog_date ON score_calculation_log(period_date);
CREATE INDEX IF NOT EXISTS idx_scorelog_status ON score_calculation_log(status);

-- ============================================================================
-- UPDATE TRIGGERS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to tables with updated_at
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOR tbl IN
        SELECT unnest(ARRAY[
            'zillow_metro', 'zillow_county', 'zillow_zip', 'zillow_state',
            'census_data', 'fred_data', 'geographies', 'metric_definitions',
            'reports', 'report_conversations', 'user_report_memory',
            'user_profiles', 'organizations', 'user_alerts', 'data_source_registry'
        ])
    LOOP
        EXECUTE format('
            DROP TRIGGER IF EXISTS update_%I_updated_at ON %I;
            CREATE TRIGGER update_%I_updated_at
                BEFORE UPDATE ON %I
                FOR EACH ROW
                EXECUTE FUNCTION update_updated_at_column();
        ', tbl, tbl, tbl, tbl);
    END LOOP;
END $$;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on user-specific tables
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_report_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_alerts ENABLE ROW LEVEL SECURITY;

-- Policies for reports
CREATE POLICY "Users can view own reports" ON reports
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own reports" ON reports
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own reports" ON reports
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own reports" ON reports
    FOR DELETE USING (auth.uid() = user_id);

-- Policies for report_conversations
CREATE POLICY "Users can view own conversations" ON report_conversations
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own conversations" ON report_conversations
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own conversations" ON report_conversations
    FOR UPDATE USING (auth.uid() = user_id);

-- Policies for user_report_memory
CREATE POLICY "Users can view own memory" ON user_report_memory
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own memory" ON user_report_memory
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own memory" ON user_report_memory
    FOR UPDATE USING (auth.uid() = user_id);

-- Policies for user_profiles
CREATE POLICY "Users can view own profile" ON user_profiles
    FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON user_profiles
    FOR UPDATE USING (auth.uid() = id);

-- Policies for user_alerts
CREATE POLICY "Users can view own alerts" ON user_alerts
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own alerts" ON user_alerts
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own alerts" ON user_alerts
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own alerts" ON user_alerts
    FOR DELETE USING (auth.uid() = user_id);

-- Public read access for data tables (service role bypasses RLS anyway)
ALTER TABLE zillow_metro ENABLE ROW LEVEL SECURITY;
ALTER TABLE zillow_county ENABLE ROW LEVEL SECURITY;
ALTER TABLE zillow_zip ENABLE ROW LEVEL SECURITY;
ALTER TABLE zillow_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE census_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE fred_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE geographies ENABLE ROW LEVEL SECURITY;
ALTER TABLE metric_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE metric_percentiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE calculated_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE propertyiq_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE propertyiq_score_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE propertyiq_score_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE news_cache ENABLE ROW LEVEL SECURITY;

-- Allow public read for data tables
CREATE POLICY "Public read zillow_metro" ON zillow_metro FOR SELECT USING (true);
CREATE POLICY "Public read zillow_county" ON zillow_county FOR SELECT USING (true);
CREATE POLICY "Public read zillow_zip" ON zillow_zip FOR SELECT USING (true);
CREATE POLICY "Public read zillow_state" ON zillow_state FOR SELECT USING (true);
CREATE POLICY "Public read census_data" ON census_data FOR SELECT USING (true);
CREATE POLICY "Public read fred_data" ON fred_data FOR SELECT USING (true);
CREATE POLICY "Public read geographies" ON geographies FOR SELECT USING (true);
CREATE POLICY "Public read metric_definitions" ON metric_definitions FOR SELECT USING (true);
CREATE POLICY "Public read metric_percentiles" ON metric_percentiles FOR SELECT USING (true);
CREATE POLICY "Public read calculated_metrics" ON calculated_metrics FOR SELECT USING (true);
CREATE POLICY "Public read propertyiq_scores" ON propertyiq_scores FOR SELECT USING (true);
CREATE POLICY "Public read propertyiq_score_details" ON propertyiq_score_details FOR SELECT USING (true);
CREATE POLICY "Public read propertyiq_score_history" ON propertyiq_score_history FOR SELECT USING (true);
CREATE POLICY "Public read news_cache" ON news_cache FOR SELECT USING (true);

COMMIT;

-- Log completion
DO $$
BEGIN
    RAISE NOTICE 'Migration 030 completed successfully: Created 23 new tables with indexes and RLS policies';
END $$;
