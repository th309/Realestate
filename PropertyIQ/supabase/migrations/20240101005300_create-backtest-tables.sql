-- ============================================================================
-- Migration: Create Backtest & Confidence Tables
-- Description: Tables for backtesting scores, tracking confidence, alerts,
--              formula versioning, and A/B testing
-- ============================================================================

-- ============================================================================
-- 1. Formula Versions Table
-- Stores different versions of scoring formulas for A/B testing and rollback
-- ============================================================================

CREATE TABLE IF NOT EXISTS propertyiq_formula_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version VARCHAR(20) NOT NULL UNIQUE, -- e.g., '1.0.0', '1.1.0'
    score_type VARCHAR(20) NOT NULL, -- 'market_health', 'homeready', 'investoredge'
    formula_config JSONB NOT NULL, -- Full formula definition (weights, metrics, normalization)
    description TEXT,
    created_by VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT FALSE,
    is_default BOOLEAN DEFAULT FALSE,
    parent_version VARCHAR(20), -- For tracking version lineage
    change_notes TEXT,
    CONSTRAINT valid_score_type CHECK (score_type IN ('market_health', 'homeready', 'investoredge'))
);

-- Index for quick active version lookup
CREATE INDEX IF NOT EXISTS idx_formula_versions_active
    ON propertyiq_formula_versions(score_type, is_active)
    WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_formula_versions_default
    ON propertyiq_formula_versions(score_type, is_default)
    WHERE is_default = TRUE;

-- ============================================================================
-- 2. Backtest Results Table
-- Stores correlation and error metrics from backtesting
-- ============================================================================

CREATE TABLE IF NOT EXISTS propertyiq_backtest_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL, -- Groups results from same backtest run
    score_type VARCHAR(20) NOT NULL,
    component_name VARCHAR(50), -- NULL for overall score
    geography_type VARCHAR(20) NOT NULL,
    formula_version VARCHAR(20) NOT NULL,

    -- Time parameters
    backtest_start_date DATE NOT NULL,
    backtest_end_date DATE NOT NULL,
    outcome_horizon VARCHAR(10) NOT NULL, -- '6m', '1y', '3y', '5y'

    -- Sample info
    sample_count INTEGER NOT NULL,
    geography_count INTEGER NOT NULL,

    -- Correlation metrics
    r_squared DECIMAL(5,4), -- 0.0000 to 1.0000
    pearson_correlation DECIMAL(5,4),
    spearman_correlation DECIMAL(5,4),

    -- Error metrics
    mean_absolute_error DECIMAL(10,4),
    root_mean_squared_error DECIMAL(10,4),
    mean_absolute_percentage_error DECIMAL(8,4),

    -- Distribution metrics
    score_mean DECIMAL(6,2),
    score_std_dev DECIMAL(6,2),
    outcome_mean DECIMAL(10,4),
    outcome_std_dev DECIMAL(10,4),

    -- Additional metrics
    hit_rate DECIMAL(5,4), -- % of correct direction predictions
    decile_spread DECIMAL(6,2), -- Spread between top and bottom decile outcomes

    created_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB, -- Additional analysis data

    CONSTRAINT valid_backtest_score_type CHECK (score_type IN ('market_health', 'homeready', 'investoredge')),
    CONSTRAINT valid_backtest_geo_type CHECK (geography_type IN ('national', 'state', 'metro', 'county', 'city', 'zip')),
    CONSTRAINT valid_outcome_horizon CHECK (outcome_horizon IN ('6m', '1y', '3y', '5y'))
);

-- Indexes for querying backtest results
CREATE INDEX IF NOT EXISTS idx_backtest_results_run
    ON propertyiq_backtest_results(run_id);

CREATE INDEX IF NOT EXISTS idx_backtest_results_lookup
    ON propertyiq_backtest_results(score_type, geography_type, formula_version);

CREATE INDEX IF NOT EXISTS idx_backtest_results_created
    ON propertyiq_backtest_results(created_at DESC);

-- ============================================================================
-- 3. Backtest Outcomes Table
-- Stores actual outcomes for comparison with historical scores
-- ============================================================================

CREATE TABLE IF NOT EXISTS propertyiq_backtest_outcomes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    geography_id VARCHAR(20) NOT NULL,
    geography_type VARCHAR(20) NOT NULL,
    score_type VARCHAR(20) NOT NULL,

    -- Score at prediction time
    score_date DATE NOT NULL,
    score_value DECIMAL(5,2),

    -- Actual outcomes at various horizons
    outcome_6m_date DATE,
    outcome_6m_value DECIMAL(10,4),
    outcome_1y_date DATE,
    outcome_1y_value DECIMAL(10,4),
    outcome_3y_date DATE,
    outcome_3y_value DECIMAL(10,4),
    outcome_5y_date DATE,
    outcome_5y_value DECIMAL(10,4),

    -- Outcome metrics (depends on score type)
    -- HomeReady: price change %, CAGR, volatility
    -- InvestorEdge: rent growth %, cap rate change, appreciation
    -- Market Health: price stability, transaction volume change
    outcome_metrics JSONB,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT valid_outcome_score_type CHECK (score_type IN ('market_health', 'homeready', 'investoredge')),
    CONSTRAINT valid_outcome_geo_type CHECK (geography_type IN ('national', 'state', 'metro', 'county', 'city', 'zip')),
    UNIQUE(geography_id, geography_type, score_type, score_date)
);

CREATE INDEX IF NOT EXISTS idx_backtest_outcomes_lookup
    ON propertyiq_backtest_outcomes(geography_id, geography_type, score_type, score_date);

-- ============================================================================
-- 4. Confidence Table
-- Current confidence levels for each score/geography combination
-- ============================================================================

CREATE TABLE IF NOT EXISTS propertyiq_confidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    score_type VARCHAR(20) NOT NULL,
    geography_type VARCHAR(20) NOT NULL,
    formula_version VARCHAR(20) NOT NULL,

    -- Confidence metrics
    confidence_score DECIMAL(5,2) NOT NULL, -- 0-100
    confidence_level VARCHAR(10) NOT NULL, -- 'high', 'medium', 'low', 'broken'

    -- Component scores
    correlation_score DECIMAL(5,2), -- Based on R²
    sample_size_score DECIMAL(5,2), -- Based on number of observations
    recency_score DECIMAL(5,2), -- Based on how recent the backtest data is

    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'healthy', -- 'healthy', 'monitor', 'review', 'broken'

    -- Metadata
    last_backtest_date DATE,
    sample_count INTEGER,
    r_squared DECIMAL(5,4),

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT valid_confidence_score_type CHECK (score_type IN ('market_health', 'homeready', 'investoredge')),
    CONSTRAINT valid_confidence_geo_type CHECK (geography_type IN ('national', 'state', 'metro', 'county', 'city', 'zip')),
    CONSTRAINT valid_confidence_level CHECK (confidence_level IN ('high', 'medium', 'low', 'broken')),
    CONSTRAINT valid_confidence_status CHECK (status IN ('healthy', 'monitor', 'review', 'broken')),
    UNIQUE(score_type, geography_type, formula_version)
);

CREATE INDEX IF NOT EXISTS idx_confidence_lookup
    ON propertyiq_confidence(score_type, geography_type);

CREATE INDEX IF NOT EXISTS idx_confidence_status
    ON propertyiq_confidence(status)
    WHERE status != 'healthy';

-- ============================================================================
-- 5. Confidence History Table
-- Tracks confidence changes over time
-- ============================================================================

CREATE TABLE IF NOT EXISTS propertyiq_confidence_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    confidence_id UUID REFERENCES propertyiq_confidence(id) ON DELETE CASCADE,
    score_type VARCHAR(20) NOT NULL,
    geography_type VARCHAR(20) NOT NULL,
    formula_version VARCHAR(20) NOT NULL,

    -- Snapshot of confidence at this point
    confidence_score DECIMAL(5,2) NOT NULL,
    confidence_level VARCHAR(10) NOT NULL,
    status VARCHAR(20) NOT NULL,

    -- What triggered this record
    change_type VARCHAR(20) NOT NULL, -- 'backtest', 'manual', 'alert', 'recovery'
    change_reason TEXT,

    -- Metrics at this point
    r_squared DECIMAL(5,4),
    sample_count INTEGER,

    recorded_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT valid_history_score_type CHECK (score_type IN ('market_health', 'homeready', 'investoredge')),
    CONSTRAINT valid_history_geo_type CHECK (geography_type IN ('national', 'state', 'metro', 'county', 'city', 'zip')),
    CONSTRAINT valid_history_change_type CHECK (change_type IN ('backtest', 'manual', 'alert', 'recovery'))
);

CREATE INDEX IF NOT EXISTS idx_confidence_history_lookup
    ON propertyiq_confidence_history(score_type, geography_type, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_confidence_history_confidence
    ON propertyiq_confidence_history(confidence_id, recorded_at DESC);

-- ============================================================================
-- 6. Confidence Alerts Table
-- Stores alerts when confidence drops below thresholds
-- ============================================================================

CREATE TABLE IF NOT EXISTS propertyiq_confidence_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    confidence_id UUID REFERENCES propertyiq_confidence(id) ON DELETE CASCADE,
    score_type VARCHAR(20) NOT NULL,
    geography_type VARCHAR(20) NOT NULL,
    formula_version VARCHAR(20) NOT NULL,

    -- Alert details
    alert_type VARCHAR(20) NOT NULL, -- 'threshold', 'degradation', 'anomaly'
    severity VARCHAR(10) NOT NULL, -- 'warning', 'critical'

    -- Thresholds
    previous_confidence DECIMAL(5,2),
    current_confidence DECIMAL(5,2),
    threshold_crossed DECIMAL(5,2),

    -- Diagnostic info
    diagnostic_signals JSONB, -- What metrics triggered the alert
    recommended_actions TEXT[],

    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'open', -- 'open', 'acknowledged', 'resolved', 'dismissed'
    acknowledged_by VARCHAR(100),
    acknowledged_at TIMESTAMPTZ,
    resolved_by VARCHAR(100),
    resolved_at TIMESTAMPTZ,
    resolution_notes TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT valid_alert_score_type CHECK (score_type IN ('market_health', 'homeready', 'investoredge')),
    CONSTRAINT valid_alert_geo_type CHECK (geography_type IN ('national', 'state', 'metro', 'county', 'city', 'zip')),
    CONSTRAINT valid_alert_type CHECK (alert_type IN ('threshold', 'degradation', 'anomaly')),
    CONSTRAINT valid_alert_severity CHECK (severity IN ('warning', 'critical')),
    CONSTRAINT valid_alert_status CHECK (status IN ('open', 'acknowledged', 'resolved', 'dismissed'))
);

CREATE INDEX IF NOT EXISTS idx_alerts_open
    ON propertyiq_confidence_alerts(status, severity, created_at DESC)
    WHERE status = 'open';

CREATE INDEX IF NOT EXISTS idx_alerts_score_type
    ON propertyiq_confidence_alerts(score_type, geography_type, created_at DESC);

-- ============================================================================
-- 7. A/B Tests Table
-- Tracks A/B tests between formula versions
-- ============================================================================

CREATE TABLE IF NOT EXISTS propertyiq_ab_tests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    score_type VARCHAR(20) NOT NULL,

    -- Versions being tested
    control_version VARCHAR(20) NOT NULL,
    treatment_version VARCHAR(20) NOT NULL,

    -- Test parameters
    traffic_split DECIMAL(4,2) NOT NULL DEFAULT 0.10, -- % of calculations using treatment
    min_sample_size INTEGER NOT NULL DEFAULT 1000,
    min_duration_days INTEGER NOT NULL DEFAULT 30,

    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'draft', -- 'draft', 'running', 'paused', 'completed', 'rolled_back'

    -- Results
    control_confidence DECIMAL(5,2),
    treatment_confidence DECIMAL(5,2),
    p_value DECIMAL(6,4),
    is_significant BOOLEAN,
    winner VARCHAR(20), -- 'control', 'treatment', 'no_difference'

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    created_by VARCHAR(100),

    -- Metadata
    test_config JSONB,
    results_data JSONB,

    CONSTRAINT valid_ab_score_type CHECK (score_type IN ('market_health', 'homeready', 'investoredge')),
    CONSTRAINT valid_ab_status CHECK (status IN ('draft', 'running', 'paused', 'completed', 'rolled_back')),
    CONSTRAINT valid_ab_winner CHECK (winner IS NULL OR winner IN ('control', 'treatment', 'no_difference'))
);

CREATE INDEX IF NOT EXISTS idx_ab_tests_running
    ON propertyiq_ab_tests(score_type, status)
    WHERE status = 'running';

-- ============================================================================
-- 8. Grant permissions
-- ============================================================================

GRANT SELECT, INSERT, UPDATE ON propertyiq_formula_versions TO service_role;
GRANT SELECT, INSERT, UPDATE ON propertyiq_backtest_results TO service_role;
GRANT SELECT, INSERT, UPDATE ON propertyiq_backtest_outcomes TO service_role;
GRANT SELECT, INSERT, UPDATE ON propertyiq_confidence TO service_role;
GRANT SELECT, INSERT, UPDATE ON propertyiq_confidence_history TO service_role;
GRANT SELECT, INSERT, UPDATE ON propertyiq_confidence_alerts TO service_role;
GRANT SELECT, INSERT, UPDATE ON propertyiq_ab_tests TO service_role;

-- Read-only access for authenticated users (admin dashboard)
GRANT SELECT ON propertyiq_formula_versions TO authenticated;
GRANT SELECT ON propertyiq_backtest_results TO authenticated;
GRANT SELECT ON propertyiq_confidence TO authenticated;
GRANT SELECT ON propertyiq_confidence_history TO authenticated;
GRANT SELECT ON propertyiq_confidence_alerts TO authenticated;
GRANT SELECT ON propertyiq_ab_tests TO authenticated;

-- ============================================================================
-- 9. Insert initial formula versions
-- ============================================================================

INSERT INTO propertyiq_formula_versions (version, score_type, formula_config, description, is_active, is_default)
VALUES
    ('1.0.0', 'market_health', '{
        "components": {
            "demand_strength": {"weight": 0.35, "metrics": ["pending_ratio", "median_days_on_market", "hotness_score"]},
            "supply_balance": {"weight": 0.25, "metrics": ["months_of_supply", "active_listing_count_yy", "new_listing_count_yy"]},
            "price_stability": {"weight": 0.25, "metrics": ["price_reduced_share", "sale_to_list_ratio", "zhvi_yoy"]},
            "economic_foundation": {"weight": 0.15, "metrics": ["unemployment_rate", "employment_yoy"]}
        }
    }', 'Initial Market Health formula', TRUE, TRUE),

    ('1.0.0', 'homeready', '{
        "components": {
            "affordability": {"weight": 0.30, "metrics": ["zhvi", "zori", "homeowner_income", "renter_income", "affordable_price"]},
            "market_timing": {"weight": 0.25, "metrics": ["pending_ratio", "days_on_market", "price_reduced_share", "pending_listing_count_yy"]},
            "stability": {"weight": 0.20, "metrics": ["zhvi_volatility", "volatility_36m", "inventory", "months_supply", "dom", "price_cuts"]},
            "growth_potential": {"weight": 0.15, "metrics": ["zhvi_5y_cagr", "population_yoy", "median_household_income_yoy"]},
            "livability": {"weight": 0.10, "metrics": ["homeownership_rate", "median_age", "population_growth", "median_income"]}
        }
    }', 'Initial HomeReady formula', TRUE, TRUE),

    ('1.0.0', 'investoredge', '{
        "components": {
            "cash_flow": {"weight": 0.35, "metrics": ["cap_rate", "grm", "rent_yield", "gross_yield", "rent_to_price_ratio"]},
            "rent_demand": {"weight": 0.20, "metrics": ["zori_yoy", "vacancy_rate", "renter_share"]},
            "appreciation": {"weight": 0.20, "metrics": ["zhvi_yoy", "zhvi_3y_cagr"]},
            "entry_point": {"weight": 0.15, "metrics": ["overvalued_pct", "days_on_market", "price_reduced_share"]},
            "risk": {"weight": 0.10, "metrics": ["unemployment_rate", "inventory_volatility", "inventory_surplus_pct", "large_multi_permits_yoy"]}
        }
    }', 'Initial InvestorEdge formula', TRUE, TRUE)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 10. Create function to get active formula version
-- ============================================================================

CREATE OR REPLACE FUNCTION get_active_formula_version(p_score_type VARCHAR)
RETURNS TABLE (
    version VARCHAR,
    formula_config JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT fv.version, fv.formula_config
    FROM propertyiq_formula_versions fv
    WHERE fv.score_type = p_score_type
      AND fv.is_active = TRUE
    ORDER BY fv.created_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- 11. Create function to record confidence history
-- ============================================================================

CREATE OR REPLACE FUNCTION record_confidence_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Only record if confidence level or status changed
    IF OLD IS NULL OR
       OLD.confidence_level != NEW.confidence_level OR
       OLD.status != NEW.status OR
       ABS(OLD.confidence_score - NEW.confidence_score) > 5 THEN

        INSERT INTO propertyiq_confidence_history (
            confidence_id,
            score_type,
            geography_type,
            formula_version,
            confidence_score,
            confidence_level,
            status,
            change_type,
            r_squared,
            sample_count
        ) VALUES (
            NEW.id,
            NEW.score_type,
            NEW.geography_type,
            NEW.formula_version,
            NEW.confidence_score,
            NEW.confidence_level,
            NEW.status,
            'backtest',
            NEW.r_squared,
            NEW.sample_count
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trg_confidence_change ON propertyiq_confidence;
CREATE TRIGGER trg_confidence_change
    AFTER INSERT OR UPDATE ON propertyiq_confidence
    FOR EACH ROW
    EXECUTE FUNCTION record_confidence_change();
