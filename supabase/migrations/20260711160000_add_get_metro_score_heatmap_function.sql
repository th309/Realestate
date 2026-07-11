-- Packs the full metro PropertyIQ score history into one JSON payload for the
-- Market Momentum Map widget: months index, metro centroids (tiger_cbsa),
-- and a dense score matrix. scores[i] aligns with metros[i] (both ordered by
-- location_id); each row aligns with months (ascending). 0 = no data.
-- Read path: GET /api/scores/heatmap/metro (public, Redis-cached 24h).

CREATE OR REPLACE FUNCTION get_metro_score_heatmap()
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public
AS $$
WITH months AS (
  SELECT score_date, (row_number() OVER (ORDER BY score_date) - 1)::int AS idx
  FROM (SELECT DISTINCT score_date FROM propertyiq_scores
        WHERE geography = 'metro' AND score_type = 'propertyiq') d
),
latest AS (
  SELECT DISTINCT ON (location_id) location_id, location_name, confidence_level
  FROM propertyiq_scores
  WHERE geography = 'metro' AND score_type = 'propertyiq'
  ORDER BY location_id, score_date DESC
),
metro_geo AS MATERIALIZED (
  SELECT l.location_id, l.location_name, l.confidence_level,
         ROUND(ST_Y(ST_PointOnSurface(t.geometry))::numeric, 3) AS lat,
         ROUND(ST_X(ST_PointOnSurface(t.geometry))::numeric, 3) AS lon,
         t.population
  FROM latest l
  JOIN tiger_cbsa t ON t.geoid = l.location_id
),
score_lookup AS (
  SELECT s.location_id, m.idx, ROUND(s.score)::int AS score
  FROM propertyiq_scores s
  JOIN months m ON m.score_date = s.score_date
  WHERE s.geography = 'metro' AND s.score_type = 'propertyiq'
),
packed AS (
  SELECT g.location_id, g.location_name, g.lat, g.lon, g.population, g.confidence_level,
         array_agg(COALESCE(sl.score, 0) ORDER BY m.idx) AS scores
  FROM metro_geo g
  CROSS JOIN months m
  LEFT JOIN score_lookup sl
    ON sl.location_id = g.location_id AND sl.idx = m.idx
  GROUP BY g.location_id, g.location_name, g.lat, g.lon, g.population, g.confidence_level
)
SELECT jsonb_build_object(
  'months', (SELECT jsonb_agg(to_char(score_date, 'YYYY-MM-DD') ORDER BY idx) FROM months),
  'metros', (SELECT jsonb_agg(jsonb_build_object(
      'id', location_id, 'name', location_name, 'lat', lat, 'lon', lon,
      'pop', population, 'conf', confidence_level) ORDER BY location_id) FROM packed),
  'scores', (SELECT jsonb_agg(to_jsonb(scores) ORDER BY location_id) FROM packed)
);
$$;

COMMENT ON FUNCTION get_metro_score_heatmap() IS
  'Full metro PropertyIQ score history packed for the Market Momentum Map widget. scores[i] aligns with metros[i]; each score row aligns with months. 0 = no data.';

GRANT EXECUTE ON FUNCTION get_metro_score_heatmap() TO anon, authenticated, service_role;
