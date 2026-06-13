-- The /scores/accuracy quintile chart calls get_quintile_performance(), which
-- does NTILE(5) OVER (ORDER BY score_value) over all rows for one
-- (score_type, geography_type) and averages the outcome/excess columns. At ZIP
-- scale (~5M PropertyIQ rows) the single-column indexes can't pre-sort that, so
-- the RPC seq-scanned + sorted + heap-fetched and exceeded the statement
-- timeout. The page is now 3-year-only, so a partial covering index on the
-- 3y-observable rows turns the query into an index-only scan (no sort, no heap).
--
-- Dropped redundant single-column indexes (subsumed by the composite leading
-- columns) to keep the table's index footprint flat.

DROP INDEX IF EXISTS idx_backtest_outcomes_score_type;
DROP INDEX IF EXISTS idx_backtest_outcomes_geo_type;
DROP INDEX IF EXISTS idx_backtest_outcomes_score_value;

CREATE INDEX IF NOT EXISTS idx_backtest_outcomes_quintile3y
  ON propertyiq_backtest_outcomes (score_type, geography_type, score_value)
  INCLUDE (
    outcome_1y_value, outcome_3y_value,
    excess_vs_state_1y, excess_vs_state_3y,
    excess_vs_national_1y, excess_vs_national_3y
  )
  WHERE excess_vs_state_3y IS NOT NULL;
