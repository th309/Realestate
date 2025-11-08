-- Real Estate Intelligence Platform - Database Schema
-- Optimized for 120,000+ markets (states, metros, cities, zip codes)

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis"; -- For geographic queries

-- ============================================
-- GEOGRAPHIC DATA TABLE
-- ============================================
CREATE TABLE geo_data (
  geo_code VARCHAR(20) PRIMARY KEY,
  geo_name VARCHAR(255) NOT NULL,
  state_code VARCHAR(2),
  geo_type VARCHAR(20) CHECK (geo_type IN ('state', 'metro', 'county', 'city', 'zipcode')),
  geometry JSONB, -- GeoJSON for mapping (full precision)
  simplified_geometry JSONB, -- Ultra-light version for mobile (4 decimal precision)
  bounds JSONB, -- Bounding box for map zoom
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Critical indexes for performance
CREATE INDEX idx_geo_type_state ON geo_data(geo_type, state_code);
CREATE INDEX idx_geo_name_search ON geo_data USING gin(to_tsvector('english', geo_name));
CREATE INDEX idx_geo_type ON geo_data(geo_type);

-- ============================================
-- TIME SERIES DATA (Partitioned by Year)
-- ============================================
CREATE TABLE time_series_data (
  id BIGSERIAL,
  geo_code VARCHAR(20) NOT NULL REFERENCES geo_data(geo_code) ON DELETE CASCADE,
  date DATE NOT NULL,
  
  -- Home values
  home_value NUMERIC(12,2),
  home_value_growth_rate NUMERIC(5,2),
  
  -- Market activity
  days_on_market NUMERIC(5,1),
  total_active_inventory INTEGER,
  new_listings INTEGER,
  price_cuts_count INTEGER,
  
  -- Rentals
  rent_for_apartments NUMERIC(10,2),
  rent_for_houses NUMERIC(10,2),
  
  -- Demographics (annual, but stored monthly for consistency)
  population INTEGER,
  median_household_income NUMERIC(10,2),
  poverty_rate NUMERIC(5,2),
  unemployment_rate NUMERIC(5,2),
  
  -- Mortgage rates (national, but stored per market for easy querying)
  mortgage_rate_30yr NUMERIC(5,3),
  
  -- Data source tracking
  data_source VARCHAR(50), -- 'zillow', 'census', 'fred', etc.
  last_validated TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (geo_code, date)
) PARTITION BY RANGE (date);

-- Create yearly partitions (2019-2025, extend as needed)
CREATE TABLE time_series_2019 PARTITION OF time_series_data
  FOR VALUES FROM ('2019-01-01') TO ('2020-01-01');
CREATE TABLE time_series_2020 PARTITION OF time_series_data
  FOR VALUES FROM ('2020-01-01') TO ('2021-01-01');
CREATE TABLE time_series_2021 PARTITION OF time_series_data
  FOR VALUES FROM ('2021-01-01') TO ('2022-01-01');
CREATE TABLE time_series_2022 PARTITION OF time_series_data
  FOR VALUES FROM ('2022-01-01') TO ('2023-01-01');
CREATE TABLE time_series_2023 PARTITION OF time_series_data
  FOR VALUES FROM ('2023-01-01') TO ('2024-01-01');
CREATE TABLE time_series_2024 PARTITION OF time_series_data
  FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');
CREATE TABLE time_series_2025 PARTITION OF time_series_data
  FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');

-- Performance indexes on partitioned table
CREATE INDEX idx_timeseries_geo_date ON time_series_data(geo_code, date DESC);
CREATE INDEX idx_timeseries_date ON time_series_data(date DESC);

-- ============================================
-- CURRENT SCORES TABLE
-- ============================================
CREATE TABLE current_scores (
  geo_code VARCHAR(20) PRIMARY KEY REFERENCES geo_data(geo_code) ON DELETE CASCADE,
  calculated_date DATE NOT NULL,
  
  -- Component scores (0-100)
  home_price_momentum_score NUMERIC(5,2),
  recent_appreciation_score NUMERIC(5,2),
  days_on_market_score NUMERIC(5,2),
  mortgage_rates_score NUMERIC(5,2),
  inventory_levels_score NUMERIC(5,2),
  price_cuts_score NUMERIC(5,2),
  
  -- Investor component scores
  long_term_appreciation_percentile NUMERIC(5,2),
  poverty_rate_percentile NUMERIC(5,2),
  median_household_income_percentile NUMERIC(5,2),
  demographic_growth_percentile NUMERIC(5,2),
  overvaluation_percentile NUMERIC(5,2),
  value_income_ratio_percentile NUMERIC(5,2),
  wealth_income_percentile NUMERIC(5,2),
  cap_rate_percentile NUMERIC(5,2),
  rent_percentile NUMERIC(5,2),
  
  -- Composite scores
  home_buyer_score NUMERIC(5,2),
  investor_score NUMERIC(5,2),
  
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Composite index for sorting/filtering
CREATE INDEX idx_scores_composite ON current_scores(home_buyer_score DESC, investor_score DESC);
CREATE INDEX idx_scores_updated ON current_scores(updated_at DESC);
CREATE INDEX idx_scores_investor ON current_scores(investor_score DESC);

-- ============================================
-- USER SUBSCRIPTIONS & TIERS
-- ============================================
CREATE TABLE user_subscriptions (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tier VARCHAR(20) DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'api', 'whitelabel')),
  markets_accessed INTEGER DEFAULT 0,
  ai_uses_this_month INTEGER DEFAULT 0,
  subscription_start DATE,
  subscription_end DATE,
  stripe_customer_id VARCHAR(255),
  stripe_subscription_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_tier ON user_subscriptions(tier);
CREATE INDEX idx_subscriptions_stripe_customer ON user_subscriptions(stripe_customer_id);

-- ============================================
-- TIER CONFIGURATIONS (Admin Editable)
-- ============================================
CREATE TABLE tier_configs (
  tier_name VARCHAR(50) PRIMARY KEY,
  price DECIMAL(10,2) NOT NULL,
  markets_limit INTEGER, -- NULL = unlimited
  ai_uses_monthly INTEGER, -- NULL = unlimited
  features JSONB NOT NULL, -- Flexible feature flags
  updated_at TIMESTAMP DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Insert default tier configurations
INSERT INTO tier_configs (tier_name, price, markets_limit, ai_uses_monthly, features) VALUES
('free', 0, 2, 2, '{"export_enabled": false, "api_access": false, "support_level": "community"}'),
('pro', 29.99, NULL, NULL, '{"export_enabled": true, "api_access": false, "support_level": "email"}'),
('api', 99.00, NULL, NULL, '{"export_enabled": true, "api_access": true, "support_level": "email", "rate_limit": 10000}'),
('whitelabel', 199.00, NULL, NULL, '{"export_enabled": true, "api_access": true, "support_level": "priority", "custom_branding": true}');

-- ============================================
-- USER FAVORITES
-- ============================================
CREATE TABLE user_favorites (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  geo_code VARCHAR(20) REFERENCES geo_data(geo_code) ON DELETE CASCADE,
  added_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id, geo_code)
);

CREATE INDEX idx_favorites_user ON user_favorites(user_id);
CREATE INDEX idx_favorites_geo ON user_favorites(geo_code);

-- ============================================
-- PRICE ALERTS
-- ============================================
CREATE TABLE price_alerts (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  geo_code VARCHAR(20) REFERENCES geo_data(geo_code) ON DELETE CASCADE,
  alert_type VARCHAR(50) CHECK (alert_type IN ('price_drop', 'score_change', 'threshold')),
  threshold_value NUMERIC,
  is_active BOOLEAN DEFAULT true,
  last_triggered TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_alerts_user ON price_alerts(user_id, is_active);
CREATE INDEX idx_alerts_geo ON price_alerts(geo_code);

-- ============================================
-- AI CACHE (30-day retention)
-- ============================================
CREATE TABLE ai_cache (
  id BIGSERIAL PRIMARY KEY,
  geo_code VARCHAR(20) NOT NULL,
  query_hash VARCHAR(64) NOT NULL, -- Hash of query parameters
  response JSONB NOT NULL,
  model_used VARCHAR(50), -- 'gpt-3.5-turbo' or 'claude-3.5-sonnet'
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '30 days')
);

CREATE INDEX idx_ai_cache_lookup ON ai_cache(geo_code, query_hash, expires_at);
CREATE INDEX idx_ai_cache_expires ON ai_cache(expires_at);

-- ============================================
-- ADMIN USERS
-- ============================================
CREATE TABLE admin_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE NOT NULL,
  role VARCHAR(50) CHECK (role IN ('super_admin', 'support', 'analyst')) DEFAULT 'analyst',
  two_factor_enabled BOOLEAN DEFAULT false,
  last_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_admin_users_email ON admin_users(email);
CREATE INDEX idx_admin_users_role ON admin_users(role);

-- ============================================
-- USER ACTIVITY LOGS
-- ============================================
CREATE TABLE user_activity_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action VARCHAR(255) NOT NULL,
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  timestamp TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_activity_user ON user_activity_logs(user_id, timestamp DESC);
CREATE INDEX idx_activity_action ON user_activity_logs(action, timestamp DESC);
CREATE INDEX idx_activity_timestamp ON user_activity_logs(timestamp DESC);

-- ============================================
-- DATA INGESTION LOGS
-- ============================================
CREATE TABLE data_ingestion_logs (
  id BIGSERIAL PRIMARY KEY,
  source_name VARCHAR(100) NOT NULL,
  ingestion_date TIMESTAMP DEFAULT NOW(),
  records_processed INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,
  status VARCHAR(20) CHECK (status IN ('success', 'failed', 'partial')),
  error_message TEXT,
  duration_seconds INTEGER,
  metadata JSONB
);

CREATE INDEX idx_ingestion_date ON data_ingestion_logs(ingestion_date DESC);
CREATE INDEX idx_ingestion_status ON data_ingestion_logs(status, ingestion_date DESC);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers
CREATE TRIGGER update_geo_data_updated_at BEFORE UPDATE ON geo_data
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_subscriptions_updated_at BEFORE UPDATE ON user_subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tier_configs_updated_at BEFORE UPDATE ON tier_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Clean expired AI cache entries (run via cron)
CREATE OR REPLACE FUNCTION clean_expired_ai_cache()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM ai_cache WHERE expires_at < NOW();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on user tables
ALTER TABLE user_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can only see their own favorites
CREATE POLICY "Users can view own favorites" ON user_favorites
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own favorites" ON user_favorites
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own favorites" ON user_favorites
    FOR DELETE USING (auth.uid() = user_id);

-- Users can only see their own alerts
CREATE POLICY "Users can view own alerts" ON price_alerts
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own alerts" ON price_alerts
    FOR ALL USING (auth.uid() = user_id);

-- Users can view their own subscription
CREATE POLICY "Users can view own subscription" ON user_subscriptions
    FOR SELECT USING (auth.uid() = user_id);

-- ============================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================
COMMENT ON TABLE geo_data IS 'Geographic entities: states, metros, cities, zip codes';
COMMENT ON TABLE time_series_data IS 'Historical market data partitioned by year for performance';
COMMENT ON TABLE current_scores IS 'Current investment scores for all markets';
COMMENT ON TABLE user_subscriptions IS 'User subscription tiers and usage tracking';
COMMENT ON TABLE tier_configs IS 'Admin-editable tier configurations';
COMMENT ON TABLE ai_cache IS 'Cached AI responses with 30-day expiration';

