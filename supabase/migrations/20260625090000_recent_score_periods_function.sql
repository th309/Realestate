-- Stable RPC that returns distinct score_dates for a geography/score_type,
-- newest-first, capped at p_limit.
--
-- Using a DB-side DISTINCT + ORDER + LIMIT is necessary because propertyiq_scores
-- has ~29 000 rows per period at ZIP level; a client-side .limit(5000) slice
-- over an ordered-by-date result never leaves the most-recent month, so only
-- 1 distinct period is returned instead of the requested 6.
create or replace function get_recent_score_periods(
  p_geography  text,
  p_score_type text,
  p_limit      int
)
returns setof date
language sql
stable
as $$
  select distinct score_date
  from propertyiq_scores
  where geography  = p_geography
    and score_type = p_score_type
  order by score_date desc
  limit p_limit;
$$;

grant execute on function get_recent_score_periods(text, text, int)
  to anon, authenticated, service_role;
