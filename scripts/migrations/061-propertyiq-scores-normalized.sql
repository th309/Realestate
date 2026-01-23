-- Migration 061: Create Normalized PropertyIQ Scores Table
--
-- This migration creates a normalized scores table that matches the
-- SCORING_SYSTEM_SPEC.md structure. Each score type is stored as a separate row.
--
-- The new structure allows:
-- - Simpler queries for individual score types
-- - Better indexing for top markets queries
-- - Easier extension for new score types
-- - Matches the API response format from the spec

-- ============================================================================
-- 1. Create Normalized Scores Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS propertyiq_scores_v2 (
    id BIGSERIAL PRIMARY KEY,

    -- Location identification (matches spec)
    geography VARCHAR(10) NOT NULL,       -- 'metro', 'county', 'zip'
    location_id VARCHAR(20) NOT NULL,     -- cbsa_code, fips, or postal_code
    location_name VARCHAR(255),           -- Human-readable name

    -- Score identification
    score_type VARCHAR(20) NOT NULL,      -- 'homeready', 'investoredge', 'markethealth'

    -- Score values (matches spec response format)
    score DECIMAL(5,1),                   -- 0-100, one decimal
    grade VARCHAR(2),                     -- A+ to F
    confidence DECIMAL(5,1),              -- 0-100
    confidence_level VARCHAR(12),         -- 'HIGH', 'MEDIUM', 'LOW', 'INSUFFICIENT'

    -- Additional data
    median_price DECIMAL(12,2),           -- Median listing price
    return_1y DECIMAL(6,2),               -- 1-year return (filled by validation)
    return_3y_ann DECIMAL(6,2),           -- 3-year annualized return (filled by validation)

    -- Period tracking
    score_date DATE NOT NULL,             -- The period date for this score

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    CONSTRAINT valid_geography CHECK (geography IN ('metro', 'county', 'zip')),
    CONSTRAINT valid_score_type CHECK (score_type IN ('homeready', 'investoredge', 'markethealth')),
    CONSTRAINT valid_score_range CHECK (score IS NULL OR (score >= 0 AND score <= 100)),
    CONSTRAINT valid_confidence_range CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 100)),
    CONSTRAINT valid_confidence_level CHECK (confidence_level IN ('HIGH', 'MEDIUM', 'LOW', 'INSUFFICIENT')),

    -- Unique constraint: one score per location/type/date
    CONSTRAINT unique_normalized_score UNIQUE (geography, location_id, score_type, score_date)
);

-- ============================================================================
-- 2. Create Indexes for Performance
-- ============================================================================

-- Primary lookup: get scores for a location
CREATE INDEX IF NOT EXISTS idx_piq_v2_location
    ON propertyiq_scores_v2(geography, location_id, score_date DESC);

-- Top markets query: get highest scores by type
CREATE INDEX IF NOT EXISTS idx_piq_v2_top_markets
    ON propertyiq_scores_v2(geography, score_type, score_date, score DESC);

-- Search by name
CREATE INDEX IF NOT EXISTS idx_piq_v2_search
    ON propertyiq_scores_v2(location_name text_pattern_ops);

-- Latest scores
CREATE INDEX IF NOT EXISTS idx_piq_v2_latest
    ON propertyiq_scores_v2(score_date DESC);

-- ============================================================================
-- 3. Create View for Spec-Format Response
-- ============================================================================

CREATE OR REPLACE VIEW propertyiq_scores_combined AS
SELECT
    geography,
    location_id,
    location_name,
    score_date,
    MAX(median_price) as median_price,

    -- HomeReady scores
    MAX(CASE WHEN score_type = 'homeready' THEN score END) as homeready_score,
    MAX(CASE WHEN score_type = 'homeready' THEN grade END) as homeready_grade,
    MAX(CASE WHEN score_type = 'homeready' THEN confidence END) as homeready_confidence,
    MAX(CASE WHEN score_type = 'homeready' THEN confidence_level END) as homeready_confidence_level,

    -- InvestorEdge scores
    MAX(CASE WHEN score_type = 'investoredge' THEN score END) as investoredge_score,
    MAX(CASE WHEN score_type = 'investoredge' THEN grade END) as investoredge_grade,
    MAX(CASE WHEN score_type = 'investoredge' THEN confidence END) as investoredge_confidence,
    MAX(CASE WHEN score_type = 'investoredge' THEN confidence_level END) as investoredge_confidence_level,

    -- MarketHealth scores
    MAX(CASE WHEN score_type = 'markethealth' THEN score END) as markethealth_score,
    MAX(CASE WHEN score_type = 'markethealth' THEN grade END) as markethealth_grade,
    MAX(CASE WHEN score_type = 'markethealth' THEN confidence END) as markethealth_confidence,
    MAX(CASE WHEN score_type = 'markethealth' THEN confidence_level END) as markethealth_confidence_level,

    -- Returns
    MAX(return_1y) as return_1y,
    MAX(return_3y_ann) as return_3y_ann

FROM propertyiq_scores_v2
GROUP BY geography, location_id, location_name, score_date;

-- ============================================================================
-- 4. Create Alias View for Backward Compatibility
-- ============================================================================
-- This allows the new code to use 'propertyiq_scores' without breaking old code

-- First, rename old table if it exists
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'propertyiq_scores') THEN
        ALTER TABLE propertyiq_scores RENAME TO propertyiq_scores_legacy;
    END IF;
END $$;

-- Create view with same name pointing to new table
CREATE OR REPLACE VIEW propertyiq_scores AS
SELECT * FROM propertyiq_scores_v2;

-- Make the view insertable
CREATE OR REPLACE FUNCTION propertyiq_scores_insert_trigger()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO propertyiq_scores_v2 (
        geography, location_id, location_name, score_type,
        score, grade, confidence, confidence_level,
        median_price, return_1y, return_3y_ann, score_date, created_at
    ) VALUES (
        NEW.geography, NEW.location_id, NEW.location_name, NEW.score_type,
        NEW.score, NEW.grade, NEW.confidence, NEW.confidence_level,
        NEW.median_price, NEW.return_1y, NEW.return_3y_ann, NEW.score_date, COALESCE(NEW.created_at, NOW())
    )
    ON CONFLICT (geography, location_id, score_type, score_date)
    DO UPDATE SET
        location_name = EXCLUDED.location_name,
        score = EXCLUDED.score,
        grade = EXCLUDED.grade,
        confidence = EXCLUDED.confidence,
        confidence_level = EXCLUDED.confidence_level,
        median_price = EXCLUDED.median_price,
        return_1y = EXCLUDED.return_1y,
        return_3y_ann = EXCLUDED.return_3y_ann,
        created_at = EXCLUDED.created_at;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS propertyiq_scores_insert ON propertyiq_scores;
CREATE TRIGGER propertyiq_scores_insert
    INSTEAD OF INSERT ON propertyiq_scores
    FOR EACH ROW EXECUTE FUNCTION propertyiq_scores_insert_trigger();

-- ============================================================================
-- 5. Grant Permissions
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON propertyiq_scores_v2 TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON propertyiq_scores_v2 TO authenticated;
GRANT SELECT ON propertyiq_scores_v2 TO anon;
GRANT SELECT ON propertyiq_scores TO service_role;
GRANT SELECT ON propertyiq_scores TO authenticated;
GRANT SELECT ON propertyiq_scores TO anon;
GRANT SELECT ON propertyiq_scores_combined TO service_role;
GRANT SELECT ON propertyiq_scores_combined TO authenticated;
GRANT SELECT ON propertyiq_scores_combined TO anon;
GRANT USAGE ON SEQUENCE propertyiq_scores_v2_id_seq TO service_role;
GRANT USAGE ON SEQUENCE propertyiq_scores_v2_id_seq TO authenticated;

-- ============================================================================
-- 6. Comments
-- ============================================================================

COMMENT ON TABLE propertyiq_scores_v2 IS
    'Normalized PropertyIQ scores table. Each row contains one score type for one location at one date.';

COMMENT ON VIEW propertyiq_scores IS
    'Alias view pointing to propertyiq_scores_v2 for API compatibility.';

COMMENT ON VIEW propertyiq_scores_combined IS
    'Pivot view showing all three scores for each location in a single row.';
