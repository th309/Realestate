-- Regenerate propertyiq_backtest_outcomes for the new PropertyIQ scores.
--
-- The /scores/accuracy validation charts (get_quintile_performance, scatter,
-- summary) read propertyiq_backtest_outcomes. That table held only the retired
-- v4/legacy score outcomes (homeready/investoredge/markethealth) and had NO
-- rows for the new formula, so the charts were empty/wrong. This rebuilds the
-- propertyiq rows from the live backfilled scores joined to forward returns.
--
-- Conventions (matched to the existing table): score_date = month-start;
-- values in PERCENT, annualized (CAGR for 3y); excess = own - state.
-- Run on the SESSION pooler (port 5432) with `SET statement_timeout=0`.
-- ZIP is ~5M rows; insert per geography. Idempotent: deletes then inserts.

SET statement_timeout = 0;

-- 1) Remove retired legacy score outcomes (single PropertyIQ score now).
DELETE FROM propertyiq_backtest_outcomes
WHERE score_type IN ('homeready', 'investoredge', 'markethealth');

-- 2) Remove any prior propertyiq rows (re-run safety).
DELETE FROM propertyiq_backtest_outcomes WHERE score_type = 'propertyiq';

-- 3) Insert fresh propertyiq outcomes. Repeat per geography (metro/county/zip)
--    to keep each transaction's WAL bounded. Replace :geo with each level.
INSERT INTO propertyiq_backtest_outcomes
  (geography_id, geography_type, score_type, score_date, score_value,
   outcome_1y_value, outcome_3y_value, state_return_1y, state_return_3y_cagr,
   excess_vs_state_1y, excess_vs_state_3y, created_at, updated_at)
SELECT s.location_id, s.geography, 'propertyiq',
       date_trunc('month', s.score_date)::date, s.score,
       o.return_1y * 100, o.return_3y_ann * 100, st.s1 * 100, st.s3 * 100,
       CASE WHEN o.return_1y IS NOT NULL AND st.s1 IS NOT NULL
            THEN (o.return_1y - st.s1) * 100 END,
       CASE WHEN o.return_3y_ann IS NOT NULL AND st.s3 IS NOT NULL
            THEN (o.return_3y_ann - st.s3) * 100 END,
       now(), now()
FROM propertyiq_scores_v2 s
JOIN score_geo_state_map m
  ON m.geography = s.geography AND m.location_id = s.location_id
JOIN zhvi_forward_returns o
  ON o.geography_level = s.geography AND o.location_id = s.location_id
 AND o.period_date = s.score_date
JOIN (
  SELECT location_id, period_date, return_1y AS s1, return_3y_ann AS s3
  FROM zhvi_forward_returns WHERE geography_level = 'state'
) st ON st.location_id = m.state_code AND st.period_date = s.score_date
WHERE s.score_type = 'propertyiq'
  AND s.geography = :'geo'   -- run for 'metro', then 'county', then 'zip'
  AND (o.return_1y IS NOT NULL OR o.return_3y_ann IS NOT NULL);

-- 4) After all three: VACUUM (ANALYZE) propertyiq_backtest_outcomes;
--    and ensure migration 20260613190000 (quintile covering index) is applied.
