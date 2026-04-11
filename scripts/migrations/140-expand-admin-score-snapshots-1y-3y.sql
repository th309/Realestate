-- ============================================================================
-- Expand admin_score_snapshots with 3Y horizon and top-quintile metrics
-- Migration: 140
--
-- Adds columns so the Score Health dashboard can display both 1Y and 3Y
-- validation metrics, and differentiate overall beat-state rate from the
-- more rigorous top-quintile beat-state rate.
--
-- Overall beat-state:       fraction of ALL scored rows whose return beat
--                           the row's state-average return at that date.
-- Top-quintile beat-state:  same fraction, restricted to the top 20% of
--                           scores across the full historical dataset.
-- ============================================================================

BEGIN;

ALTER TABLE admin_score_snapshots
  ADD COLUMN IF NOT EXISTS hit_rate_3y              REAL,
  ADD COLUMN IF NOT EXISTS correlation_3y           REAL,
  ADD COLUMN IF NOT EXISTS top_quintile_hit_rate_1y REAL,
  ADD COLUMN IF NOT EXISTS top_quintile_hit_rate_3y REAL,
  ADD COLUMN IF NOT EXISTS scores_validated_3y      INTEGER;

COMMENT ON COLUMN admin_score_snapshots.hit_rate_1y
  IS 'Overall beat-state rate at 1Y: fraction of rows where return_1y > state_return_1y at that date';
COMMENT ON COLUMN admin_score_snapshots.hit_rate_3y
  IS 'Overall beat-state rate at 3Y: fraction of rows where return_3y_ann > state_return_3y_ann at that date';
COMMENT ON COLUMN admin_score_snapshots.top_quintile_hit_rate_1y
  IS 'Beat-state rate restricted to the top 20% of scores globally, 1Y horizon';
COMMENT ON COLUMN admin_score_snapshots.top_quintile_hit_rate_3y
  IS 'Beat-state rate restricted to the top 20% of scores globally, 3Y horizon';
COMMENT ON COLUMN admin_score_snapshots.correlation_1y
  IS 'Spearman correlation between score and return_1y';
COMMENT ON COLUMN admin_score_snapshots.correlation_3y
  IS 'Spearman correlation between score and return_3y_ann';
COMMENT ON COLUMN admin_score_snapshots.scores_validated
  IS 'Count of rows with non-null return_1y (validated cohort for 1Y)';
COMMENT ON COLUMN admin_score_snapshots.scores_validated_3y
  IS 'Count of rows with non-null return_3y_ann (validated cohort for 3Y)';

COMMIT;
