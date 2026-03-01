-- RPC function: get_top_markets_by_state
-- Returns top-ranked PropertyIQ markets filtered by state via geography_crosswalk.
-- When p_state IS NULL, returns the same unfiltered national ranking.
-- Multi-state metros (e.g. Chicago IL-IN-WI) appear if ANY constituent is in the state.

CREATE OR REPLACE FUNCTION get_top_markets_by_state(
  p_geography  TEXT,
  p_score_type TEXT,
  p_limit      INT     DEFAULT 10,
  p_state      TEXT    DEFAULT NULL,
  p_date       DATE    DEFAULT NULL
)
RETURNS TABLE (
  location_id   TEXT,
  location_name TEXT,
  score         NUMERIC,
  grade         TEXT
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_date DATE;
  v_join_col TEXT;
BEGIN
  -- Resolve target date (latest if not provided)
  IF p_date IS NOT NULL THEN
    v_date := p_date;
  ELSE
    SELECT MAX(ps.score_date) INTO v_date
    FROM propertyiq_scores ps
    WHERE ps.geography = p_geography;
  END IF;

  IF v_date IS NULL THEN
    RETURN;  -- no data
  END IF;

  -- Unfiltered path (no state) - simple direct query, no JOIN overhead
  IF p_state IS NULL THEN
    RETURN QUERY
      SELECT ps.location_id, ps.location_name, ps.score, ps.grade
      FROM propertyiq_scores ps
      WHERE ps.geography   = p_geography
        AND ps.score_type  = p_score_type
        AND ps.score_date  = v_date
      ORDER BY ps.score DESC
      LIMIT p_limit;
    RETURN;
  END IF;

  -- Determine the crosswalk join column based on geography level
  IF p_geography = 'metro' THEN
    v_join_col := 'cbsa_code';
  ELSIF p_geography = 'county' THEN
    v_join_col := 'county_fips';
  ELSIF p_geography = 'zip' THEN
    v_join_col := 'zip_code';
  ELSE
    RETURN;  -- invalid geography
  END IF;

  -- State-filtered path: find location_ids that match the state,
  -- then fetch and rank their scores.
  -- Uses a subquery to first get distinct matching location_ids from
  -- the crosswalk, then joins back to scores for ranking.
  RETURN QUERY EXECUTE format(
    'SELECT ps.location_id, ps.location_name, ps.score, ps.grade
     FROM propertyiq_scores ps
     WHERE ps.geography   = $1
       AND ps.score_type  = $2
       AND ps.score_date  = $3
       AND ps.location_id IN (
         SELECT DISTINCT gx.%I
         FROM geography_crosswalk gx
         WHERE gx.state_abbrev = $4
           AND gx.%I IS NOT NULL
       )
     ORDER BY ps.score DESC
     LIMIT $5',
    v_join_col, v_join_col
  )
  USING p_geography, p_score_type, v_date, UPPER(p_state), p_limit;
END;
$$;
