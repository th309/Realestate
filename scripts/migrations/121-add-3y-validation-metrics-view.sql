-- Migration 121: Add 3-Year Validation Support
--
-- The performance tracking table already has 3Y columns (actual_return_3y_ann,
-- beat_market_3y, validated_3y_at) from migration 060. This migration adds:
--
-- 1. Index for efficiently finding predictions pending 3Y validation
-- 2. Updated metrics view that includes both 1Y and 3Y performance
-- 3. Updated alert function that checks 3Y metrics too

-- ============================================================================
-- 1. Index for pending 3Y validations
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_perf_pending_3y
    ON score_performance_tracking(prediction_date)
    WHERE validated_3y_at IS NULL AND validated_1y_at IS NOT NULL;

-- ============================================================================
-- 2. Replace performance metrics view with 1Y + 3Y columns
-- ============================================================================
CREATE OR REPLACE VIEW score_performance_metrics AS
WITH validated_1y AS (
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
),
validated_3y AS (
    SELECT
        geography,
        score_type,
        predicted_quintile,
        COUNT(*) as n,
        AVG(actual_return_3y_ann) as avg_return_3y_ann,
        SUM(CASE WHEN beat_market_3y THEN 1 ELSE 0 END)::FLOAT / NULLIF(COUNT(*), 0) * 100 as beat_rate_3y
    FROM score_performance_tracking
    WHERE validated_3y_at IS NOT NULL
    GROUP BY geography, score_type, predicted_quintile
)
SELECT
    COALESCE(a.geography, b.geography) as geography,
    COALESCE(a.score_type, b.score_type) as score_type,

    -- 1Y metrics (top quintile)
    MAX(CASE WHEN a.predicted_quintile = 5 THEN a.avg_return END) as top_quintile_return,
    MAX(CASE WHEN a.predicted_quintile = 5 THEN a.beat_rate END) as top_quintile_beat_rate,
    -- 1Y metrics (bottom quintile)
    MAX(CASE WHEN a.predicted_quintile = 1 THEN a.avg_return END) as bottom_quintile_return,
    MAX(CASE WHEN a.predicted_quintile = 1 THEN a.beat_rate END) as bottom_quintile_beat_rate,
    -- 1Y spread
    MAX(CASE WHEN a.predicted_quintile = 5 THEN a.avg_return END) -
    MAX(CASE WHEN a.predicted_quintile = 1 THEN a.avg_return END) as spread,
    COALESCE(SUM(a.n), 0) as total_predictions,

    -- 3Y metrics (top quintile) — the primary validation horizon
    MAX(CASE WHEN b.predicted_quintile = 5 THEN b.avg_return_3y_ann END) as top_quintile_return_3y,
    MAX(CASE WHEN b.predicted_quintile = 5 THEN b.beat_rate_3y END) as top_quintile_beat_rate_3y,
    -- 3Y metrics (bottom quintile)
    MAX(CASE WHEN b.predicted_quintile = 1 THEN b.avg_return_3y_ann END) as bottom_quintile_return_3y,
    MAX(CASE WHEN b.predicted_quintile = 1 THEN b.beat_rate_3y END) as bottom_quintile_beat_rate_3y,
    -- 3Y spread (annualized)
    MAX(CASE WHEN b.predicted_quintile = 5 THEN b.avg_return_3y_ann END) -
    MAX(CASE WHEN b.predicted_quintile = 1 THEN b.avg_return_3y_ann END) as spread_3y,
    COALESCE(SUM(b.n), 0) as total_predictions_3y

FROM validated_1y a
FULL OUTER JOIN validated_3y b
    ON a.geography = b.geography
    AND a.score_type = b.score_type
    AND a.predicted_quintile = b.predicted_quintile
GROUP BY COALESCE(a.geography, b.geography), COALESCE(a.score_type, b.score_type);

-- ============================================================================
-- 3. Updated alert function — checks both 1Y and 3Y metrics
-- ============================================================================
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

    -- 1Y: top quintile beat rate (target: >70%)
    SELECT
        m.geography::VARCHAR,
        m.score_type::VARCHAR,
        'top_quintile_beat_rate_1y'::VARCHAR as metric,
        m.top_quintile_beat_rate as current_value,
        70.0 as threshold,
        CASE
            WHEN m.top_quintile_beat_rate >= 70 THEN 'OK'
            WHEN m.top_quintile_beat_rate >= 55 THEN 'WARNING'
            ELSE 'CRITICAL'
        END as status
    FROM score_performance_metrics m
    WHERE m.top_quintile_beat_rate IS NOT NULL
      AND m.top_quintile_beat_rate < 70

    UNION ALL

    -- 1Y: spread (target: >3%)
    SELECT
        m.geography::VARCHAR,
        m.score_type::VARCHAR,
        'spread_1y'::VARCHAR,
        m.spread,
        3.0,
        CASE
            WHEN m.spread >= 3 THEN 'OK'
            WHEN m.spread >= 1.5 THEN 'WARNING'
            ELSE 'CRITICAL'
        END
    FROM score_performance_metrics m
    WHERE m.spread IS NOT NULL
      AND m.spread < 3

    UNION ALL

    -- 3Y: top quintile beat rate (target: >65% — primary horizon)
    SELECT
        m.geography::VARCHAR,
        m.score_type::VARCHAR,
        'top_quintile_beat_rate_3y'::VARCHAR,
        m.top_quintile_beat_rate_3y,
        65.0,
        CASE
            WHEN m.top_quintile_beat_rate_3y >= 65 THEN 'OK'
            WHEN m.top_quintile_beat_rate_3y >= 50 THEN 'WARNING'
            ELSE 'CRITICAL'
        END
    FROM score_performance_metrics m
    WHERE m.top_quintile_beat_rate_3y IS NOT NULL
      AND m.top_quintile_beat_rate_3y < 65

    UNION ALL

    -- 3Y: spread (target: >2pp annualized — primary horizon)
    SELECT
        m.geography::VARCHAR,
        m.score_type::VARCHAR,
        'spread_3y'::VARCHAR,
        m.spread_3y,
        2.0,
        CASE
            WHEN m.spread_3y >= 2 THEN 'OK'
            WHEN m.spread_3y >= 1 THEN 'WARNING'
            ELSE 'CRITICAL'
        END
    FROM score_performance_metrics m
    WHERE m.spread_3y IS NOT NULL
      AND m.spread_3y < 2;
END;
$$ LANGUAGE plpgsql;
