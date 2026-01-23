-- Migration 060: Create Performance Tracking Tables
--
-- This migration creates tables for tracking score prediction performance
-- per the SCORING_SYSTEM_SPEC.md performance tracking requirements.
--
-- Tables created:
-- 1. score_performance_tracking - Tracks predictions and validates against actual outcomes
-- 2. formula_versions - Stores formula versions for Option B retraining
-- 3. score_performance_metrics (view) - Aggregated performance metrics

-- ============================================================================
-- 1. Score Performance Tracking Table
-- ============================================================================
-- Stores predictions at the time they are made, then updates with actual
-- outcomes when data becomes available (12 months and 36 months later)

CREATE TABLE IF NOT EXISTS score_performance_tracking (
    id BIGSERIAL PRIMARY KEY,

    -- Location info
    geography VARCHAR(10) NOT NULL,        -- 'metro', 'county', 'zip'
    location_id VARCHAR(20) NOT NULL,      -- cbsa_code, fips, or zip
    location_name VARCHAR(255),
    score_type VARCHAR(20) NOT NULL,       -- 'homeready', 'investoredge', 'markethealth'

    -- What we predicted (snapshot at prediction time)
    prediction_date DATE NOT NULL,
    predicted_score DECIMAL(5,1),          -- 0-100
    predicted_grade VARCHAR(2),            -- A+ to F
    predicted_quintile INT,                -- 1-5 (1=bottom 20%, 5=top 20%)
    price_at_prediction DECIMAL(12,2),     -- Median price at time of prediction

    -- Actual outcomes (filled in later by validation job)
    actual_return_1y DECIMAL(6,2),         -- Filled 12 months later
    actual_return_3y_ann DECIMAL(6,2),     -- Filled 36 months later (annualized)
    beat_market_1y BOOLEAN,                -- Did it beat median at 1 year?
    beat_market_3y BOOLEAN,                -- Did it beat median at 3 years?

    -- Validation metadata
    validated_1y_at TIMESTAMPTZ,           -- When 1-year validation was performed
    validated_3y_at TIMESTAMPTZ,           -- When 3-year validation was performed

    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Each location can only have one prediction per score type per date
    UNIQUE(geography, location_id, score_type, prediction_date)
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_perf_validation
    ON score_performance_tracking(prediction_date, validated_1y_at);
CREATE INDEX IF NOT EXISTS idx_perf_geography
    ON score_performance_tracking(geography, score_type);
CREATE INDEX IF NOT EXISTS idx_perf_quintile
    ON score_performance_tracking(geography, score_type, predicted_quintile);
CREATE INDEX IF NOT EXISTS idx_perf_pending_1y
    ON score_performance_tracking(prediction_date)
    WHERE validated_1y_at IS NULL;

-- ============================================================================
-- 2. Formula Versions Table (for Option B retraining)
-- ============================================================================
-- Stores different formula versions for A/B testing and rollback

CREATE TABLE IF NOT EXISTS formula_versions (
    id BIGSERIAL PRIMARY KEY,

    version VARCHAR(20) NOT NULL,          -- e.g., 'v1.0', 'v2.0'
    geography VARCHAR(10) NOT NULL,        -- 'metro', 'county', 'zip'
    score_type VARCHAR(20) NOT NULL,       -- 'homeready', 'investoredge', 'markethealth'

    -- Formula definition (JSON format)
    formula JSONB NOT NULL,                -- {"metric_name": {"weight": 0.7, "direction": 1}, ...}

    -- Training metadata
    training_date DATE NOT NULL,
    training_data_start DATE,              -- Start of training window
    training_data_end DATE,                -- End of training window

    -- Validation metrics at time of training
    validation_correlation DECIMAL(4,3),   -- Correlation with actual outcomes
    validation_spread DECIMAL(5,2),        -- Top quintile return - bottom quintile return
    validation_top_beat_rate DECIMAL(5,2), -- % of top quintile that beat market

    -- Status
    status VARCHAR(20) DEFAULT 'draft',    -- draft, active, retired
    activated_at TIMESTAMPTZ,              -- When this version became active
    retired_at TIMESTAMPTZ,                -- When this version was retired

    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(version, geography, score_type)
);

-- Index for finding active formulas
CREATE INDEX IF NOT EXISTS idx_formula_active
    ON formula_versions(geography, score_type, status)
    WHERE status = 'active';

-- ============================================================================
-- 3. Insert Initial Formula Versions (v1.0)
-- ============================================================================
-- These are the fixed formulas from SCORING_SYSTEM_SPEC.md

INSERT INTO formula_versions (version, geography, score_type, formula, training_date, status, activated_at)
VALUES
-- Metro formulas
('v1.0', 'metro', 'homeready',
 '{"hotness_score":{"weight":0.706,"direction":1},"pending_ratio":{"weight":0.152,"direction":1},"unemployment_rate_yoy":{"weight":0.057,"direction":-1},"population_yoy":{"weight":0.054,"direction":-1},"demand_score":{"weight":0.031,"direction":1}}',
 CURRENT_DATE, 'active', NOW()),

('v1.0', 'metro', 'investoredge',
 '{"hotness_score":{"weight":0.317,"direction":1},"median_gross_rent":{"weight":0.315,"direction":-1},"affordability_ratio":{"weight":0.188,"direction":-1},"pending_ratio":{"weight":0.080,"direction":1},"homeownership_rate":{"weight":0.047,"direction":1},"population_yoy":{"weight":0.035,"direction":-1},"unemployment_rate_yoy":{"weight":0.018,"direction":-1}}',
 CURRENT_DATE, 'active', NOW()),

('v1.0', 'metro', 'markethealth',
 '{"hotness_score":{"weight":0.416,"direction":1},"demand_score":{"weight":0.345,"direction":1},"pending_ratio":{"weight":0.239,"direction":1}}',
 CURRENT_DATE, 'active', NOW()),

-- County formulas
('v1.0', 'county', 'homeready',
 '{"hotness_score":{"weight":0.403,"direction":1},"affordability_ratio":{"weight":0.132,"direction":1},"price_reduced_share":{"weight":0.119,"direction":-1},"population_yoy":{"weight":0.102,"direction":-1},"rent_price_ratio":{"weight":0.091,"direction":1},"pending_ratio":{"weight":0.072,"direction":1},"unemployment_rate_yoy":{"weight":0.049,"direction":1},"demand_score":{"weight":0.033,"direction":1}}',
 CURRENT_DATE, 'active', NOW()),

('v1.0', 'county', 'investoredge',
 '{"rent_price_ratio":{"weight":0.402,"direction":1},"hotness_score":{"weight":0.244,"direction":1},"affordability_ratio":{"weight":0.094,"direction":1},"price_reduced_share":{"weight":0.082,"direction":-1},"population_yoy":{"weight":0.059,"direction":-1},"pending_ratio":{"weight":0.054,"direction":1},"demand_score":{"weight":0.034,"direction":1},"unemployment_rate_yoy":{"weight":0.030,"direction":1}}',
 CURRENT_DATE, 'active', NOW()),

('v1.0', 'county', 'markethealth',
 '{"hotness_score":{"weight":0.533,"direction":1},"demand_score":{"weight":0.254,"direction":1},"pending_ratio":{"weight":0.213,"direction":1}}',
 CURRENT_DATE, 'active', NOW()),

-- ZIP formulas
('v1.0', 'zip', 'homeready',
 '{"hotness_score":{"weight":0.534,"direction":1},"demand_score":{"weight":0.184,"direction":1},"pending_ratio":{"weight":0.165,"direction":1},"active_listing_count_yy":{"weight":0.101,"direction":1},"price_reduced_count_yy":{"weight":0.016,"direction":1}}',
 CURRENT_DATE, 'active', NOW()),

('v1.0', 'zip', 'investoredge',
 '{"hotness_score":{"weight":0.534,"direction":1},"demand_score":{"weight":0.184,"direction":1},"pending_ratio":{"weight":0.165,"direction":1},"active_listing_count_yy":{"weight":0.101,"direction":1},"price_reduced_count_yy":{"weight":0.016,"direction":1}}',
 CURRENT_DATE, 'active', NOW()),

('v1.0', 'zip', 'markethealth',
 '{"hotness_score":{"weight":0.699,"direction":1},"demand_score":{"weight":0.301,"direction":1}}',
 CURRENT_DATE, 'active', NOW())

ON CONFLICT (version, geography, score_type) DO NOTHING;

-- ============================================================================
-- 4. Performance Metrics View
-- ============================================================================
-- Aggregates performance metrics for monitoring dashboard

CREATE OR REPLACE VIEW score_performance_metrics AS
WITH validated AS (
    SELECT
        geography,
        score_type,
        predicted_quintile,
        COUNT(*) as n,
        AVG(actual_return_1y) as avg_return,
        SUM(CASE WHEN beat_market_1y THEN 1 ELSE 0 END)::FLOAT / NULLIF(COUNT(*), 0) * 100 as beat_rate
    FROM score_performance_tracking
    WHERE validated_1y_at IS NOT NULL
    AND prediction_date >= NOW() - INTERVAL '24 months'
    GROUP BY geography, score_type, predicted_quintile
)
SELECT
    geography,
    score_type,
    -- Top quintile (Q5) performance
    MAX(CASE WHEN predicted_quintile = 5 THEN avg_return END) as top_quintile_return,
    MAX(CASE WHEN predicted_quintile = 5 THEN beat_rate END) as top_quintile_beat_rate,
    -- Bottom quintile (Q1) performance
    MAX(CASE WHEN predicted_quintile = 1 THEN avg_return END) as bottom_quintile_return,
    MAX(CASE WHEN predicted_quintile = 1 THEN beat_rate END) as bottom_quintile_beat_rate,
    -- Spread (top - bottom)
    MAX(CASE WHEN predicted_quintile = 5 THEN avg_return END) -
    MAX(CASE WHEN predicted_quintile = 1 THEN avg_return END) as spread,
    -- Sample size
    SUM(n) as total_predictions
FROM validated
GROUP BY geography, score_type;

-- ============================================================================
-- 5. Active Formulas View
-- ============================================================================
CREATE OR REPLACE VIEW active_formulas AS
SELECT * FROM formula_versions WHERE status = 'active';

-- ============================================================================
-- 6. Alert Check Function
-- ============================================================================
-- Returns any metrics that are below threshold

CREATE OR REPLACE FUNCTION check_score_performance()
RETURNS TABLE (
    geography VARCHAR,
    score_type VARCHAR,
    metric VARCHAR,
    current_value DECIMAL,
    threshold DECIMAL,
    status VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    -- Check top quintile beat rate (target: >70%)
    SELECT
        m.geography::VARCHAR,
        m.score_type::VARCHAR,
        'top_quintile_beat_rate'::VARCHAR as metric,
        m.top_quintile_beat_rate as current_value,
        70.0 as threshold,
        CASE
            WHEN m.top_quintile_beat_rate >= 70 THEN 'OK'
            WHEN m.top_quintile_beat_rate >= 55 THEN 'WARNING'
            ELSE 'CRITICAL'
        END as status
    FROM score_performance_metrics m
    WHERE m.top_quintile_beat_rate < 70

    UNION ALL

    -- Check spread (target: >3%)
    SELECT
        m.geography::VARCHAR,
        m.score_type::VARCHAR,
        'spread'::VARCHAR,
        m.spread,
        3.0,
        CASE
            WHEN m.spread >= 3 THEN 'OK'
            WHEN m.spread >= 1.5 THEN 'WARNING'
            ELSE 'CRITICAL'
        END
    FROM score_performance_metrics m
    WHERE m.spread < 3

    UNION ALL

    -- Check bottom quintile beat rate (target: <30% - inverted, lower is better)
    SELECT
        m.geography::VARCHAR,
        m.score_type::VARCHAR,
        'bottom_quintile_beat_rate'::VARCHAR,
        m.bottom_quintile_beat_rate,
        30.0,
        CASE
            WHEN m.bottom_quintile_beat_rate <= 30 THEN 'OK'
            WHEN m.bottom_quintile_beat_rate <= 45 THEN 'WARNING'
            ELSE 'CRITICAL'
        END
    FROM score_performance_metrics m
    WHERE m.bottom_quintile_beat_rate > 30;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 7. Grant Permissions
-- ============================================================================
GRANT SELECT, INSERT, UPDATE ON score_performance_tracking TO service_role;
GRANT SELECT, INSERT, UPDATE ON formula_versions TO service_role;
GRANT SELECT ON score_performance_metrics TO service_role;
GRANT SELECT ON active_formulas TO service_role;
GRANT USAGE ON SEQUENCE score_performance_tracking_id_seq TO service_role;
GRANT USAGE ON SEQUENCE formula_versions_id_seq TO service_role;

-- ============================================================================
-- 8. Comments
-- ============================================================================
COMMENT ON TABLE score_performance_tracking IS
    'Tracks score predictions and validates against actual outcomes for performance monitoring';
COMMENT ON TABLE formula_versions IS
    'Stores formula versions for the scoring system, supporting A/B testing and rollback';
COMMENT ON VIEW score_performance_metrics IS
    'Aggregated performance metrics per geography and score type';
COMMENT ON FUNCTION check_score_performance() IS
    'Returns performance metrics that are below threshold for alerting';
