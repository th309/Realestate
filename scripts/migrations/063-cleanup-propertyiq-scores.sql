-- Migration 063: Cleanup PropertyIQ Scores Schema
--
-- Removes the unnecessary views and legacy table, keeping only propertyiq_scores_v2.
-- The view's INSTEAD OF INSERT trigger doesn't work properly with Supabase REST API,
-- so we write directly to the table.
--
-- Before running: Ensure all code uses propertyiq_scores_v2 directly

-- ============================================================================
-- 1. Drop the trigger and function (no longer needed)
-- ============================================================================

DROP TRIGGER IF EXISTS propertyiq_scores_insert ON propertyiq_scores;
DROP FUNCTION IF EXISTS propertyiq_scores_insert_trigger();

-- ============================================================================
-- 2. Drop the views
-- ============================================================================

DROP VIEW IF EXISTS propertyiq_scores CASCADE;
DROP VIEW IF EXISTS propertyiq_scores_combined CASCADE;

-- ============================================================================
-- 3. Drop the legacy table (old wide-format table)
-- ============================================================================

DROP TABLE IF EXISTS propertyiq_scores_legacy CASCADE;

-- ============================================================================
-- 4. Rename propertyiq_scores_v2 to propertyiq_scores for cleaner naming
-- ============================================================================

ALTER TABLE propertyiq_scores_v2 RENAME TO propertyiq_scores;

-- Rename indexes
ALTER INDEX IF EXISTS idx_piq_v2_location RENAME TO idx_piq_location;
ALTER INDEX IF EXISTS idx_piq_v2_top_markets RENAME TO idx_piq_top_markets;
ALTER INDEX IF EXISTS idx_piq_v2_search RENAME TO idx_piq_search;
ALTER INDEX IF EXISTS idx_piq_v2_latest RENAME TO idx_piq_latest;

-- Rename constraint
ALTER TABLE propertyiq_scores RENAME CONSTRAINT unique_normalized_score TO unique_score;

-- Rename sequence
ALTER SEQUENCE IF EXISTS propertyiq_scores_v2_id_seq RENAME TO propertyiq_scores_id_seq;

-- ============================================================================
-- 5. Update grants for the renamed table
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON propertyiq_scores TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON propertyiq_scores TO authenticated;
GRANT SELECT ON propertyiq_scores TO anon;
GRANT USAGE ON SEQUENCE propertyiq_scores_id_seq TO service_role;
GRANT USAGE ON SEQUENCE propertyiq_scores_id_seq TO authenticated;

-- ============================================================================
-- 6. Update comment
-- ============================================================================

COMMENT ON TABLE propertyiq_scores IS
    'PropertyIQ scores table. Each row contains one score type (homeready, investoredge, markethealth) for one location at one date.';

-- ============================================================================
-- Verification
-- ============================================================================

DO $$
DECLARE
    row_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO row_count FROM propertyiq_scores;
    RAISE NOTICE 'Migration 063 complete. propertyiq_scores has % rows.', row_count;
END $$;
