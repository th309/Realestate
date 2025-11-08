-- ============================================================================
-- Real Estate Market Database Schema V2
-- Aligned with Zillow's data structure
-- ============================================================================

-- Enable PostGIS for geographic features
CREATE EXTENSION IF NOT EXISTS postgis;

-- Drop existing tables if they exist
DROP TABLE IF EXISTS data_ingestion_logs CASCADE;
DROP TABLE IF EXISTS user_activity_logs CASCADE;
DROP TABLE IF EXISTS admin_users CASCADE;
DROP TABLE IF EXISTS ai_cache CASCADE;
DROP TABLE IF EXISTS price_alerts CASCADE;
DROP TABLE IF EXISTS user_favorites CASCADE;
DROP TABLE IF EXISTS tier_configs CASCADE;
DROP TABLE IF EXISTS user_subscriptions CASCADE;
DROP TABLE IF EXISTS current_scores CASCADE;
DROP TABLE IF EXISTS time_series_data CASCADE;
DROP TABLE IF EXISTS market_time_series CASCADE;
DROP TABLE IF EXISTS market_metadata CASCADE;
DROP TABLE IF EXISTS markets CASCADE;
DROP TABLE IF EXISTS geo_data CASCADE;

-- ============================================================================
-- CORE MARKET TABLES (Aligned with Zillow structure)
-- ============================================================================

-- Markets table (replaces geo_data)
-- Stores all geographic regions: countries, states, metros, cities, zip codes
CREATE TABLE markets (
    region_id VARCHAR(50) PRIMARY KEY,  -- Matches Zillow's RegionID
    region_name VARCHAR(255) NOT NULL,  -- Matches Zillow's RegionName
    region_type VARCHAR(50) NOT NULL,   -- country, state, msa (metro), city, zip
    state_name VARCHAR(100),            -- Full state name
    state_code VARCHAR(2),              -- Two-letter state code
    metro_name VARCHAR(255),            -- Metro area name if applicable
    county_name VARCHAR(255),           -- County name if applicable
    size_rank INTEGER,                  -- Matches Zillow's SizeRank
    population BIGINT,                  -- Population count
    households INTEGER,                 -- Number of households
    median_income DECIMAL(10, 2),       -- Median household income
    latitude DECIMAL(10, 8),            -- Center point latitude
    longitude DECIMAL(11, 8),           -- Center point longitude
    geometry GEOMETRY(MultiPolygon, 4326), -- Geographic boundaries
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for markets table
CREATE INDEX idx_markets_region_type ON markets (region_type);
CREATE INDEX idx_markets_state ON markets (state_code);
CREATE INDEX idx_markets_metro ON markets (metro_name);
CREATE INDEX idx_markets_name ON markets (region_name);

-- Market metadata (additional info not in time series)
CREATE TABLE market_metadata (
    region_id VARCHAR(50) REFERENCES markets(region_id),
    metadata_type VARCHAR(50) NOT NULL, -- 'demographic', 'economic', 'geographic'
    metadata_key VARCHAR(100) NOT NULL,
    metadata_value TEXT,
    valid_from DATE,
    valid_to DATE,
    source VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    PRIMARY KEY (region_id, metadata_type, metadata_key)
);

-- Create index for metadata table
CREATE INDEX idx_metadata_type ON market_metadata (metadata_type);

-- ============================================================================
-- TIME SERIES DATA (Matches Zillow's structure)
-- ============================================================================

-- Market time series data (all metrics over time)
CREATE TABLE market_time_series (
    id BIGSERIAL PRIMARY KEY,
    region_id VARCHAR(50) REFERENCES markets(region_id),
    date DATE NOT NULL,                 -- Month-end date from Zillow
    metric_name VARCHAR(100) NOT NULL,  -- 'zhvi', 'zori', 'inventory', etc.
    metric_value DECIMAL(15, 2),        -- The actual value
    data_source VARCHAR(50) NOT NULL,   -- 'zillow', 'realtor', 'redfin', etc.
    
    -- Additional Zillow-specific fields
    property_type VARCHAR(50),          -- 'sfr', 'condo', 'all', etc.
    tier VARCHAR(50),                   -- 'bottom', 'middle', 'top', etc.
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Unique constraint to prevent duplicates
    UNIQUE(region_id, date, metric_name, data_source, property_type, tier),
    
    -- Indexes will be created separately after table creation
    -- due to PostgreSQL syntax requirements
) PARTITION BY RANGE (date);

-- Create partitions for time series data (by year)
CREATE TABLE market_time_series_2020 PARTITION OF market_time_series
    FOR VALUES FROM ('2020-01-01') TO ('2021-01-01');
    
CREATE TABLE market_time_series_2021 PARTITION OF market_time_series
    FOR VALUES FROM ('2021-01-01') TO ('2022-01-01');
    
CREATE TABLE market_time_series_2022 PARTITION OF market_time_series
    FOR VALUES FROM ('2022-01-01') TO ('2023-01-01');
    
CREATE TABLE market_time_series_2023 PARTITION OF market_time_series
    FOR VALUES FROM ('2023-01-01') TO ('2024-01-01');
    
CREATE TABLE market_time_series_2024 PARTITION OF market_time_series
    FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');
    
CREATE TABLE market_time_series_2025 PARTITION OF market_time_series
    FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');

-- Create indexes on the time series table (after table creation)
CREATE INDEX idx_time_series_region_date ON market_time_series (region_id, date DESC);
CREATE INDEX idx_time_series_metric ON market_time_series (metric_name);
CREATE INDEX idx_time_series_source ON market_time_series (data_source);
CREATE INDEX idx_time_series_date ON market_time_series (date DESC);

-- ============================================================================
-- CALCULATED METRICS & SCORES
-- ============================================================================

-- Current market scores (latest calculated metrics)
CREATE TABLE current_scores (
    region_id VARCHAR(50) REFERENCES markets(region_id),
    score_type VARCHAR(50) NOT NULL,    -- 'investment', 'growth', 'stability'
    score_value DECIMAL(5, 2),          -- 0-100 score
    score_components JSONB,             -- Breakdown of score calculation
    calculated_date DATE NOT NULL,
    confidence_level DECIMAL(3, 2),     -- 0-1 confidence in score
    
    PRIMARY KEY (region_id, score_type)
);

-- Create indexes for scores table
CREATE INDEX idx_scores_type ON current_scores (score_type);
CREATE INDEX idx_scores_value ON current_scores (score_value DESC);

-- ============================================================================
-- USER-RELATED TABLES
-- ============================================================================

-- User subscription tiers
CREATE TABLE tier_configs (
    tier_name VARCHAR(50) PRIMARY KEY,
    display_name VARCHAR(100) NOT NULL,
    price_monthly DECIMAL(10, 2),
    price_annual DECIMAL(10, 2),
    max_markets INTEGER,                -- Number of markets user can track
    ai_requests_monthly INTEGER,        -- AI analysis requests per month
    features JSONB,                     -- Additional features as JSON
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User subscriptions
CREATE TABLE user_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,              -- From Supabase Auth
    tier_name VARCHAR(50) REFERENCES tier_configs(tier_name),
    status VARCHAR(20) NOT NULL,        -- 'active', 'cancelled', 'expired'
    current_period_start DATE,
    current_period_end DATE,
    stripe_subscription_id VARCHAR(255),
    stripe_customer_id VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User favorites/watchlist
CREATE TABLE user_favorites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    region_id VARCHAR(50) REFERENCES markets(region_id),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id, region_id),
    INDEX idx_fav_user (user_id)
);

-- Price alerts
CREATE TABLE price_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    region_id VARCHAR(50) REFERENCES markets(region_id),
    metric_name VARCHAR(100) NOT NULL,
    condition VARCHAR(20) NOT NULL,     -- 'above', 'below', 'change_percent'
    threshold_value DECIMAL(15, 2),
    is_active BOOLEAN DEFAULT true,
    last_triggered TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    INDEX idx_alerts_user (user_id),
    INDEX idx_alerts_active (is_active)
);

-- ============================================================================
-- AI & CACHING
-- ============================================================================

-- AI analysis cache
CREATE TABLE ai_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    region_id VARCHAR(50) REFERENCES markets(region_id),
    analysis_type VARCHAR(50) NOT NULL, -- 'investment', 'forecast', 'comparison'
    prompt_hash VARCHAR(64) NOT NULL,   -- Hash of the prompt for deduplication
    model_used VARCHAR(50),             -- 'gpt-3.5', 'claude-3.5', etc.
    response_data JSONB NOT NULL,
    tokens_used INTEGER,
    cost_usd DECIMAL(10, 4),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    
    INDEX idx_ai_cache_region (region_id),
    INDEX idx_ai_cache_hash (prompt_hash),
    INDEX idx_ai_cache_expires (expires_at)
);

-- ============================================================================
-- ADMIN & LOGGING
-- ============================================================================

-- Admin users
CREATE TABLE admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(50) NOT NULL,          -- 'super_admin', 'admin', 'support'
    permissions JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User activity logs
CREATE TABLE user_activity_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID,
    action VARCHAR(100) NOT NULL,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    INDEX idx_activity_user (user_id),
    INDEX idx_activity_action (action),
    INDEX idx_activity_time (created_at DESC)
);

-- Data ingestion logs
CREATE TABLE data_ingestion_logs (
    id BIGSERIAL PRIMARY KEY,
    source VARCHAR(50) NOT NULL,        -- 'zillow', 'realtor', etc.
    dataset VARCHAR(100),               -- 'zhvi', 'inventory', etc.
    status VARCHAR(20) NOT NULL,        -- 'started', 'success', 'failed'
    records_processed INTEGER,
    records_inserted INTEGER,
    records_updated INTEGER,
    error_message TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    
    INDEX idx_ingestion_source (source),
    INDEX idx_ingestion_status (status),
    INDEX idx_ingestion_time (started_at DESC)
);

-- ============================================================================
-- INITIAL DATA
-- ============================================================================

-- Insert subscription tiers
INSERT INTO tier_configs (tier_name, display_name, price_monthly, price_annual, max_markets, ai_requests_monthly, features) VALUES
('free', 'Free', 0, 0, 2, 2, '{"basic_analysis": true, "monthly_updates": true}'),
('pro', 'Professional', 29.99, 299.99, -1, 100, '{"advanced_analysis": true, "daily_updates": true, "api_access": false, "export_data": true}'),
('api', 'API Access', 99.00, 999.00, -1, 1000, '{"api_access": true, "advanced_analysis": true, "daily_updates": true, "export_data": true}'),
('enterprise', 'Enterprise', 199.00, 1999.00, -1, -1, '{"white_label": true, "api_access": true, "priority_support": true, "custom_reports": true}');

-- ============================================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add update triggers to relevant tables
CREATE TRIGGER update_markets_updated_at BEFORE UPDATE ON markets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tier_configs_updated_at BEFORE UPDATE ON tier_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_subscriptions_updated_at BEFORE UPDATE ON user_subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on user-specific tables
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_alerts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own subscriptions" ON user_subscriptions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own favorites" ON user_favorites
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own alerts" ON price_alerts
    FOR ALL USING (auth.uid() = user_id);

-- Public read access to market data
CREATE POLICY "Public can view markets" ON markets
    FOR SELECT USING (true);

CREATE POLICY "Public can view time series" ON market_time_series
    FOR SELECT USING (true);

CREATE POLICY "Public can view scores" ON current_scores
    FOR SELECT USING (true);
