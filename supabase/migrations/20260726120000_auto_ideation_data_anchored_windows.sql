-- ============================================================================
-- Auto-ideation triggers: anchor windows on the DATA's latest score period,
-- not the calendar.
-- ============================================================================
-- BUG: all three RPCs anchored their "current" CTE on
--   score_date >= CURRENT_DATE - INTERVAL '7 days'
-- but PropertyIQ scores are MONTHLY. The latest metro/county/zip score_date is
-- 2026-06-30 (26+ days stale), so the 7-day window held ZERO rows — every rule
-- evaluated to zero matches, no runs enqueued, and the UI claimed success with
-- nothing there.
--
-- FIX: anchor on max(score_date) in the DATA. "current" = the latest score
-- period; baseline / "then" / "prev" = the appropriate earlier period relative
-- to the latest, not a calendar band. Signatures are UNCHANGED (the service
-- calls these by name/args). Read propertyiq_scores_v2 directly (canonical,
-- indexed on (geography, location_id, score_date DESC) and (score_date DESC));
-- the propertyiq_scores view is unindexed for the geography-less threshold scan
-- and timed out.
-- ============================================================================

-- RPC: score movement over a lookback window
CREATE OR REPLACE FUNCTION auto_ideation_score_movement(
  p_geography TEXT,
  p_lookback TIMESTAMPTZ,
  p_min_delta NUMERIC,
  p_direction TEXT
)
RETURNS TABLE(
  geo_id TEXT,
  canonical_name TEXT,
  current_score NUMERIC,
  previous_score NUMERIC,
  delta NUMERIC
)
LANGUAGE sql STABLE AS $$
  WITH latest AS (
    SELECT max(s.score_date) AS d
    FROM propertyiq_scores_v2 s
    WHERE s.geography = p_geography AND s.score_type = 'propertyiq'
  ),
  recent AS (
    SELECT DISTINCT ON (s.location_id)
      s.location_id, s.location_name, s.score, s.score_date
    FROM propertyiq_scores_v2 s, latest
    WHERE s.geography = p_geography AND s.score_type = 'propertyiq'
      AND s.score_date >= latest.d - INTERVAL '3 days'   -- current period (tolerate churn)
    ORDER BY s.location_id, s.score_date DESC
  ),
  baseline AS (
    SELECT DISTINCT ON (s.location_id) s.location_id, s.score
    FROM propertyiq_scores_v2 s, latest
    WHERE s.geography = p_geography AND s.score_type = 'propertyiq'
      -- lookback reinterpreted as a DURATION back from the latest data period.
      -- The caller passes p_lookback = now() - lookback_days, so
      -- (CURRENT_DATE - p_lookback::date) recovers lookback_days.
      AND s.score_date <= latest.d - (CURRENT_DATE - p_lookback::date)
    ORDER BY s.location_id, s.score_date DESC
  )
  SELECT
    r.location_id::text AS geo_id,
    r.location_name::text AS canonical_name,
    r.score AS current_score,
    b.score AS previous_score,
    (r.score - b.score) AS delta
  FROM recent r
  JOIN baseline b USING (location_id)
  WHERE
    (p_direction = 'up' AND (r.score - b.score) >= p_min_delta)
    OR (p_direction = 'down' AND (b.score - r.score) >= p_min_delta)
    OR (p_direction = 'both' AND abs(r.score - b.score) >= p_min_delta);
$$;

-- RPC: rank change (within top N) — current snapshot vs the latest snapshot
-- at least ~30 days earlier in the data.
CREATE OR REPLACE FUNCTION auto_ideation_rank_change(
  p_geography TEXT,
  p_top_n INTEGER,
  p_min_delta INTEGER,
  p_direction TEXT
)
RETURNS TABLE(
  geo_id TEXT,
  canonical_name TEXT,
  current_rank INTEGER,
  previous_rank INTEGER,
  rank_delta INTEGER
)
LANGUAGE sql STABLE AS $$
  WITH latest AS (
    SELECT max(score_date) AS d FROM propertyiq_scores_v2
    WHERE geography = p_geography AND score_type = 'propertyiq'
  ),
  then_date AS (
    SELECT max(score_date) AS d FROM propertyiq_scores_v2, latest
    WHERE geography = p_geography AND score_type = 'propertyiq'
      AND score_date <= latest.d - INTERVAL '30 days'
  ),
  ranked_now AS (
    SELECT location_id, location_name, RANK() OVER (ORDER BY score DESC) AS rank
    FROM propertyiq_scores_v2, latest
    WHERE geography = p_geography AND score_type = 'propertyiq'
      AND score_date = latest.d
  ),
  ranked_then AS (
    SELECT location_id, RANK() OVER (ORDER BY score DESC) AS rank
    FROM propertyiq_scores_v2, then_date
    WHERE geography = p_geography AND score_type = 'propertyiq'
      AND score_date = then_date.d
  )
  SELECT
    n.location_id::text AS geo_id,
    n.location_name::text AS canonical_name,
    n.rank::int AS current_rank,
    t.rank::int AS previous_rank,
    (t.rank - n.rank)::int AS rank_delta
  FROM ranked_now n
  JOIN ranked_then t USING (location_id)
  WHERE n.rank <= p_top_n
    AND (
      (p_direction = 'up' AND (t.rank - n.rank) >= p_min_delta)
      OR (p_direction = 'down' AND (n.rank - t.rank) >= p_min_delta)
      OR (p_direction = 'both' AND abs(t.rank - n.rank) >= p_min_delta)
    );
$$;

-- RPC: threshold cross — each location's latest score period vs its prior one.
-- No geography param (scans all levels), so anchor on the two most recent global
-- score periods via scalar subqueries (index-usable; the CTE cross-join was not).
CREATE OR REPLACE FUNCTION auto_ideation_threshold_cross(
  p_metric TEXT,
  p_threshold NUMERIC,
  p_direction TEXT
)
RETURNS TABLE(
  geo_id TEXT,
  canonical_name TEXT,
  current_value NUMERIC,
  previous_value NUMERIC
)
LANGUAGE plpgsql STABLE AS $$
BEGIN
  IF p_metric <> 'propertyiq_score' THEN
    RAISE EXCEPTION 'unsupported metric: %', p_metric;
  END IF;
  RETURN QUERY
    WITH curr AS (
      SELECT DISTINCT ON (location_id)
        location_id, location_name, score::numeric AS value
      FROM propertyiq_scores_v2
      WHERE score_type = 'propertyiq'
        AND score_date = (
          SELECT max(score_date) FROM propertyiq_scores_v2 WHERE score_type = 'propertyiq'
        )
      ORDER BY location_id, score_date DESC
    ),
    prev AS (
      SELECT DISTINCT ON (location_id)
        location_id, score::numeric AS value
      FROM propertyiq_scores_v2
      WHERE score_type = 'propertyiq'
        AND score_date = (
          SELECT max(score_date) FROM propertyiq_scores_v2
          WHERE score_type = 'propertyiq'
            AND score_date < (
              SELECT max(score_date) FROM propertyiq_scores_v2 WHERE score_type = 'propertyiq'
            )
        )
      ORDER BY location_id, score_date DESC
    )
    SELECT
      c.location_id::text AS geo_id,
      c.location_name::text AS canonical_name,
      c.value AS current_value,
      p.value AS previous_value
    FROM curr c
    JOIN prev p USING (location_id)
    WHERE (p_direction = 'up' AND c.value >= p_threshold AND p.value < p_threshold)
       OR (p_direction = 'down' AND c.value <= p_threshold AND p.value > p_threshold);
END $$;
