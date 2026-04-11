-- ============================================================================
-- compute_propertyiq_score_health()
-- Migration: 141
--
-- Aggregates the full propertyiq_scores_v2 × zhvi_forward_returns dataset
-- into a single health-snapshot record for the admin dashboard's
-- Score Health card and the nightly snapshot cron.
--
-- Design notes:
--   - Forward returns come from zhvi_forward_returns via JOIN on
--     (geography_level, location_id, period_date), NOT from
--     propertyiq_scores_v2.return_1y/return_3y_ann columns. Those columns
--     would require a 2.4M-row UPDATE backfill; the JOIN approach is
--     ~equivalent in cost on a one-shot daily aggregate and avoids
--     duplicating the data.
--   - A row "hits" if its forward return exceeds its state's forward return
--     at the same score_date. State benchmark comes from
--     zhvi_forward_returns WHERE geography_level='state'. State mapping
--     comes from score_geo_state_map.
--   - Top-quintile = rows whose score >= the 80th percentile of all scored
--     rows GLOBALLY (across all dates and geographies). This is the
--     simplest definition; per-year or per-state quintile cutoffs are
--     possible alternatives but not used here.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION compute_propertyiq_score_health()
RETURNS TABLE(
  hit_rate_1y              REAL,
  hit_rate_3y              REAL,
  top_quintile_hit_rate_1y REAL,
  top_quintile_hit_rate_3y REAL,
  correlation_1y           REAL,
  correlation_3y           REAL,
  scores_validated         INTEGER,
  scores_validated_3y      INTEGER,
  scores_pending           INTEGER
)
LANGUAGE sql
STABLE
AS $$
  WITH enriched AS (
    SELECT
      s.score,
      own.return_1y     AS own_return_1y,
      own.return_3y_ann AS own_return_3y_ann,
      st.return_1y      AS state_return_1y,
      st.return_3y_ann  AS state_return_3y_ann
    FROM propertyiq_scores_v2 s
    LEFT JOIN zhvi_forward_returns own
      ON own.geography_level = s.geography
     AND own.location_id     = s.location_id
     AND own.period_date     = s.score_date
    LEFT JOIN score_geo_state_map m
      ON m.geography = s.geography
     AND m.location_id = s.location_id
    LEFT JOIN zhvi_forward_returns st
      ON st.geography_level = 'state'
     AND st.location_id     = m.state_code
     AND st.period_date     = s.score_date
    WHERE s.score_type = 'propertyiq'
  ),
  quintile AS (
    SELECT percentile_cont(0.8) WITHIN GROUP (ORDER BY score) AS q80
    FROM enriched
    WHERE own_return_1y IS NOT NULL
  )
  SELECT
    (COUNT(*) FILTER (
       WHERE e.own_return_1y IS NOT NULL
         AND e.state_return_1y IS NOT NULL
         AND e.own_return_1y > e.state_return_1y
     ))::real
    / NULLIF(COUNT(*) FILTER (
       WHERE e.own_return_1y IS NOT NULL
         AND e.state_return_1y IS NOT NULL
     ), 0)::real                                        AS hit_rate_1y,

    (COUNT(*) FILTER (
       WHERE e.own_return_3y_ann IS NOT NULL
         AND e.state_return_3y_ann IS NOT NULL
         AND e.own_return_3y_ann > e.state_return_3y_ann
     ))::real
    / NULLIF(COUNT(*) FILTER (
       WHERE e.own_return_3y_ann IS NOT NULL
         AND e.state_return_3y_ann IS NOT NULL
     ), 0)::real                                        AS hit_rate_3y,

    (COUNT(*) FILTER (
       WHERE e.score >= q.q80
         AND e.own_return_1y IS NOT NULL
         AND e.state_return_1y IS NOT NULL
         AND e.own_return_1y > e.state_return_1y
     ))::real
    / NULLIF(COUNT(*) FILTER (
       WHERE e.score >= q.q80
         AND e.own_return_1y IS NOT NULL
         AND e.state_return_1y IS NOT NULL
     ), 0)::real                                        AS top_quintile_hit_rate_1y,

    (COUNT(*) FILTER (
       WHERE e.score >= q.q80
         AND e.own_return_3y_ann IS NOT NULL
         AND e.state_return_3y_ann IS NOT NULL
         AND e.own_return_3y_ann > e.state_return_3y_ann
     ))::real
    / NULLIF(COUNT(*) FILTER (
       WHERE e.score >= q.q80
         AND e.own_return_3y_ann IS NOT NULL
         AND e.state_return_3y_ann IS NOT NULL
     ), 0)::real                                        AS top_quintile_hit_rate_3y,

    corr(e.score::double precision, e.own_return_1y::double precision)::real     AS correlation_1y,
    corr(e.score::double precision, e.own_return_3y_ann::double precision)::real AS correlation_3y,

    COUNT(*) FILTER (WHERE e.own_return_1y IS NOT NULL)::integer     AS scores_validated,
    COUNT(*) FILTER (WHERE e.own_return_3y_ann IS NOT NULL)::integer AS scores_validated_3y,
    COUNT(*) FILTER (WHERE e.own_return_1y IS NULL)::integer         AS scores_pending
  FROM enriched e
  CROSS JOIN quintile q;
$$;

GRANT EXECUTE ON FUNCTION compute_propertyiq_score_health() TO service_role;
GRANT EXECUTE ON FUNCTION compute_propertyiq_score_health() TO authenticated;

COMMIT;
