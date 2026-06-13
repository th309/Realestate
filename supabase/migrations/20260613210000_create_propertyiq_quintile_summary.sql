-- Pre-aggregated quintile summary for the /scores/accuracy quintile chart.
--
-- get_quintile_performance() does NTILE(5) OVER (ORDER BY score_value) over
-- every row for one (score_type, geography_type) and averages the outcome
-- columns. At ZIP scale (~5M PropertyIQ rows) that live aggregation runs ~10s
-- per request even with the covering index, so the chart stalls on load.
--
-- The quintile breakdown only changes when propertyiq_backtest_outcomes is
-- regenerated, so we materialize it into a tiny table (~5 rows per
-- score_type x geography_type) that the page reads in a single PK lookup.
--
-- The /scores/accuracy page is 3-year-only, so we store horizon = '3y'. The
-- quintile membership and every averaged column use the SAME logic as
-- get_quintile_performance(..., '3y'): NTILE(5) ORDER BY score_value over the
-- rows where excess_vs_state_3y IS NOT NULL, then ROUND to the same precision.
-- The only difference is PARTITION BY (score_type, geography_type) so one pass
-- populates all geography levels at once.

-- 1) The summary table.
CREATE TABLE IF NOT EXISTS propertyiq_quintile_summary (
  score_type                text        NOT NULL,
  geography_type            text        NOT NULL,
  horizon                   text        NOT NULL DEFAULT '3y',
  quintile                  int         NOT NULL,
  label                     text        NOT NULL,
  score_min                 numeric,
  score_max                 numeric,
  avg_score                 numeric,
  sample_count              bigint,
  avg_return_1y             numeric,
  avg_return_3y             numeric,
  avg_excess_vs_state_1y    numeric,
  avg_excess_vs_state_3y    numeric,
  avg_excess_vs_national_1y numeric,
  avg_excess_vs_national_3y numeric,
  updated_at                timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (score_type, geography_type, horizon, quintile)
);

COMMENT ON TABLE propertyiq_quintile_summary IS
  'Materialized 3-year quintile breakdown for /scores/accuracy. Rebuilt by refresh_propertyiq_quintile_summary() after each propertyiq_backtest_outcomes regeneration. Mirrors get_quintile_performance(..., ''3y'').';

-- 2) Refresh function: rebuild the 3y rows for every score_type x geography_type.
--    SECURITY DEFINER so it can be invoked by the service role and run the
--    heavy NTILE under the owner's privileges. Idempotent: deletes then inserts.
CREATE OR REPLACE FUNCTION refresh_propertyiq_quintile_summary()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  DELETE FROM propertyiq_quintile_summary WHERE horizon = '3y';

  INSERT INTO propertyiq_quintile_summary (
    score_type, geography_type, horizon, quintile, label,
    score_min, score_max, avg_score, sample_count,
    avg_return_1y, avg_return_3y,
    avg_excess_vs_state_1y, avg_excess_vs_state_3y,
    avg_excess_vs_national_1y, avg_excess_vs_national_3y, updated_at
  )
  WITH ranked AS (
    SELECT
      bo.score_type,
      bo.geography_type,
      bo.score_value,
      bo.outcome_1y_value,
      bo.outcome_3y_value,
      bo.excess_vs_state_1y,
      bo.excess_vs_state_3y,
      bo.excess_vs_national_1y,
      bo.excess_vs_national_3y,
      NTILE(5) OVER (
        PARTITION BY bo.score_type, bo.geography_type
        ORDER BY bo.score_value
      ) AS q
    FROM propertyiq_backtest_outcomes bo
    WHERE bo.score_value IS NOT NULL
      AND bo.excess_vs_state_3y IS NOT NULL
  )
  SELECT
    r.score_type,
    r.geography_type,
    '3y' AS horizon,
    r.q AS quintile,
    CASE r.q
      WHEN 1 THEN 'Bottom 20%'
      WHEN 2 THEN 'Lower 20%'
      WHEN 3 THEN 'Middle 20%'
      WHEN 4 THEN 'Upper 20%'
      WHEN 5 THEN 'Top 20%'
    END AS label,
    ROUND(MIN(r.score_value)::numeric, 1)            AS score_min,
    ROUND(MAX(r.score_value)::numeric, 1)            AS score_max,
    ROUND(AVG(r.score_value)::numeric, 1)            AS avg_score,
    COUNT(*)::bigint                                 AS sample_count,
    ROUND(AVG(r.outcome_1y_value)::numeric, 4)       AS avg_return_1y,
    ROUND(AVG(r.outcome_3y_value)::numeric, 4)       AS avg_return_3y,
    ROUND(AVG(r.excess_vs_state_1y)::numeric, 4)     AS avg_excess_vs_state_1y,
    ROUND(AVG(r.excess_vs_state_3y)::numeric, 4)     AS avg_excess_vs_state_3y,
    ROUND(AVG(r.excess_vs_national_1y)::numeric, 4)  AS avg_excess_vs_national_1y,
    ROUND(AVG(r.excess_vs_national_3y)::numeric, 4)  AS avg_excess_vs_national_3y,
    now()
  FROM ranked r
  GROUP BY r.score_type, r.geography_type, r.q;
END;
$function$;

-- 3) Permissions. The backend reads via the service role; the page is public.
GRANT ALL    ON propertyiq_quintile_summary TO service_role;
GRANT SELECT ON propertyiq_quintile_summary TO authenticated;
GRANT SELECT ON propertyiq_quintile_summary TO anon;
GRANT EXECUTE ON FUNCTION refresh_propertyiq_quintile_summary() TO service_role;

-- 4) Initial populate is run separately on the SESSION pooler (port 5432) with
--    SET statement_timeout = 0, because the ZIP NTILE scan exceeds the
--    transaction pooler's 30s cap:
--        SELECT refresh_propertyiq_quintile_summary();
--    Re-run that after every propertyiq_backtest_outcomes regeneration.
