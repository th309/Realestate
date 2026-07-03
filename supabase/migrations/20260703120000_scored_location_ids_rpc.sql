-- Fast single-query fetch of all scored location_ids for a (geography, score_type,
-- score_date). Replaces the SEO slug-rebuild's N+1 pagination in
-- getScoredLocationIds (29 OFFSET pages per date, ×6 concurrent dates), which
-- under post-scoring DB load exceeded the statement timeout and 500'd — cascading
-- to fail the whole post-import refresh.
--
-- Returns a single text[] row (not a row set), so PostgREST's 1000-row read cap
-- doesn't apply; ~30k zip ids come back in one ~90ms call (idx_piq_v2_top_markets
-- covers the WHERE; DISTINCT is a hash-aggregate). STABLE + PARALLEL SAFE.
CREATE OR REPLACE FUNCTION public.get_scored_location_ids(
  p_geography text,
  p_score_type text,
  p_score_date date
) RETURNS text[]
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
  SELECT array_agg(location_id)
  FROM (
    SELECT DISTINCT location_id
    FROM public.propertyiq_scores_v2
    WHERE geography = p_geography
      AND score_type = p_score_type
      AND score_date = p_score_date
  ) s;
$$;

GRANT EXECUTE ON FUNCTION public.get_scored_location_ids(text, text, date)
  TO anon, authenticated, service_role;
