-- Migration: Enhance Score Details Table
-- Description: Add raw metrics and data source tracking for inheritance
-- Date: 2026-01-20

-- ============================================================================
-- PART 1: Add raw_metrics column for pre-normalized values
-- ============================================================================

-- Raw metrics stores the actual values before normalization
-- Example: { "cap_rate": 6.5, "grm": 18.2, "gross_yield": 5.5 }
ALTER TABLE propertyiq_score_details ADD COLUMN IF NOT EXISTS raw_metrics JSONB;

-- ============================================================================
-- PART 2: Add data_source column for tracking inheritance
-- ============================================================================

-- Tracks where the data came from: 'direct', 'inherited_county', 'inherited_metro', etc.
ALTER TABLE propertyiq_score_details ADD COLUMN IF NOT EXISTS data_source TEXT;

-- ============================================================================
-- PART 3: Add inherited_from column for specific source tracking
-- ============================================================================

-- When inherited, stores the specific geography_id the data came from
ALTER TABLE propertyiq_score_details ADD COLUMN IF NOT EXISTS inherited_from TEXT;

-- ============================================================================
-- PART 4: Add normalized_metrics column for component-level normalized values
-- ============================================================================

-- Stores normalized (0-100) values for each metric in the component
-- Example: { "cap_rate": 72, "grm": 65, "gross_yield": 68 }
ALTER TABLE propertyiq_score_details ADD COLUMN IF NOT EXISTS normalized_metrics JSONB;

-- ============================================================================
-- PART 5: Add weight column to store the component weight used
-- ============================================================================

ALTER TABLE propertyiq_score_details ADD COLUMN IF NOT EXISTS weight NUMERIC(4,3);

-- ============================================================================
-- PART 6: Add completeness tracking at component level
-- ============================================================================

-- Percentage of metrics available for this component (0-100)
ALTER TABLE propertyiq_score_details ADD COLUMN IF NOT EXISTS completeness NUMERIC(5,2);

-- Number of metrics available vs total metrics for this component
ALTER TABLE propertyiq_score_details ADD COLUMN IF NOT EXISTS metrics_available INTEGER;
ALTER TABLE propertyiq_score_details ADD COLUMN IF NOT EXISTS metrics_total INTEGER;

-- ============================================================================
-- PART 7: Add index for data source queries
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_score_details_data_source
  ON propertyiq_score_details(data_source);

CREATE INDEX IF NOT EXISTS idx_score_details_inherited
  ON propertyiq_score_details(inherited_from) WHERE inherited_from IS NOT NULL;

-- ============================================================================
-- PART 8: Add comments
-- ============================================================================

COMMENT ON COLUMN propertyiq_score_details.raw_metrics IS 'JSONB of pre-normalized metric values used in this component';
COMMENT ON COLUMN propertyiq_score_details.normalized_metrics IS 'JSONB of normalized (0-100) metric values for this component';
COMMENT ON COLUMN propertyiq_score_details.data_source IS 'Source of data: direct, inherited_county, inherited_metro, inherited_state, inherited_national';
COMMENT ON COLUMN propertyiq_score_details.inherited_from IS 'Geography ID from which data was inherited, if applicable';
COMMENT ON COLUMN propertyiq_score_details.weight IS 'Weight applied to this component (e.g., 0.35 for 35%)';
COMMENT ON COLUMN propertyiq_score_details.completeness IS 'Percentage of metrics available for this component (0-100)';
COMMENT ON COLUMN propertyiq_score_details.metrics_available IS 'Count of metrics with data for this component';
COMMENT ON COLUMN propertyiq_score_details.metrics_total IS 'Total metrics expected for this component';
