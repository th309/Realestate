-- Migration 114: Update confidence_level constraint to use letter grades (A/B/C/F)
--
-- The scoring engine uses letter grades (A, B, C, F) for confidence levels,
-- matching the CLAUDE.md spec. The original migration (061) used
-- 'HIGH', 'MEDIUM', 'LOW', 'INSUFFICIENT' which doesn't match.
--
-- This migration:
-- 1. Converts existing data from old values to new letter grades
-- 2. Drops and recreates the check constraint with new values

-- ============================================================================
-- 1. Convert existing data
-- ============================================================================

UPDATE propertyiq_scores_v2
SET confidence_level = CASE confidence_level
    WHEN 'HIGH' THEN 'A'
    WHEN 'MEDIUM' THEN 'B'
    WHEN 'LOW' THEN 'C'
    WHEN 'INSUFFICIENT' THEN 'F'
    ELSE confidence_level  -- already A/B/C/F
END
WHERE confidence_level IN ('HIGH', 'MEDIUM', 'LOW', 'INSUFFICIENT');

-- ============================================================================
-- 2. Drop old constraint and create new one
-- ============================================================================

ALTER TABLE propertyiq_scores_v2
    DROP CONSTRAINT IF EXISTS valid_confidence_level;

ALTER TABLE propertyiq_scores_v2
    ADD CONSTRAINT valid_confidence_level
    CHECK (confidence_level IN ('A', 'B', 'C', 'F'));
