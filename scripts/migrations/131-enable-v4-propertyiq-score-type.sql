-- Migration 131: Enable v4 PropertyIQ score type in propertyiq_scores_v2
--
-- The original migration 061 constrained score_type to only v3 types:
--   ('homeready', 'investoredge', 'markethealth')
--
-- The v4 demand-signal scoring engine writes score_type = 'propertyiq'.
-- This migration:
--   1. Updates the CHECK constraint to include 'propertyiq'
--   2. Adds z_scores JSONB column for storing input metric values
--   3. Updates the view trigger to pass z_scores through

-- ============================================================================
-- 1. Update score_type CHECK constraint
-- ============================================================================

ALTER TABLE propertyiq_scores_v2
    DROP CONSTRAINT IF EXISTS valid_score_type;

ALTER TABLE propertyiq_scores_v2
    ADD CONSTRAINT valid_score_type
    CHECK (score_type IN ('homeready', 'investoredge', 'markethealth', 'propertyiq'));

-- ============================================================================
-- 2. Add z_scores column (stores input metrics as JSON for debugging/audit)
-- ============================================================================

ALTER TABLE propertyiq_scores_v2
    ADD COLUMN IF NOT EXISTS z_scores JSONB;

COMMENT ON COLUMN propertyiq_scores_v2.z_scores IS
    'JSON blob of input metric values used to compute the score (for audit/debugging)';

-- ============================================================================
-- 3. Update the view trigger to pass z_scores through
-- ============================================================================

CREATE OR REPLACE FUNCTION propertyiq_scores_insert_trigger()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO propertyiq_scores_v2 (
        geography, location_id, location_name, score_type,
        score, grade, confidence, confidence_level,
        median_price, return_1y, return_3y_ann, score_date, created_at,
        z_scores
    ) VALUES (
        NEW.geography, NEW.location_id, NEW.location_name, NEW.score_type,
        NEW.score, NEW.grade, NEW.confidence, NEW.confidence_level,
        NEW.median_price, NEW.return_1y, NEW.return_3y_ann, NEW.score_date,
        COALESCE(NEW.created_at, NOW()),
        NEW.z_scores
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
        created_at = EXCLUDED.created_at,
        z_scores = EXCLUDED.z_scores;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger (function replacement is automatic, but be explicit)
DROP TRIGGER IF EXISTS propertyiq_scores_insert ON propertyiq_scores;
CREATE TRIGGER propertyiq_scores_insert
    INSTEAD OF INSERT ON propertyiq_scores
    FOR EACH ROW EXECUTE FUNCTION propertyiq_scores_insert_trigger();

-- ============================================================================
-- 4. Verify
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE 'Migration 131: v4 propertyiq score_type enabled, z_scores column added';
END $$;
