-- Stable RPC that returns distinct score_dates for a geography/score_type,
-- newest-first, capped at p_limit.
--
-- WHY a DB-side function (not a client-side dedupe): propertyiq_scores has
-- ~29,000 rows per period at ZIP level, so a client-side `.limit(5000)` slice
-- over an ordered-by-date result never leaves the most-recent month → only
-- 1 distinct period is returned instead of the requested 6.
--
-- WHY a recursive CTE (loose index scan) and NOT plain `SELECT DISTINCT`:
-- a straight DISTINCT still has to scan every row for the recent dates to
-- dedupe them (idx_piq_v2_top_markets is (geography, score_type, score_date,
-- score) — ~29k index entries per date). That read ~143k rows and took
-- ~6.5s for ZIP, which exceeds the backend role's statement timeout → 500.
-- The recursive CTE walks one index seek per distinct date (~p_limit seeks
-- total, ~5ms for ZIP). Queries propertyiq_scores_v2 directly so the seeks
-- hit the index.
create or replace function get_recent_score_periods(
  p_geography  text,
  p_score_type text,
  p_limit      int
)
returns setof date
language sql
stable
as $$
  with recursive d as (
    -- anchor: the single most-recent score_date
    select (
      select v.score_date
      from propertyiq_scores_v2 v
      where v.geography = p_geography
        and v.score_type = p_score_type
      order by v.score_date desc
      limit 1
    ) as score_date
    union all
    -- step: the next-lower distinct score_date (one index seek)
    select (
      select v.score_date
      from propertyiq_scores_v2 v
      where v.geography = p_geography
        and v.score_type = p_score_type
        and v.score_date < d.score_date
      order by v.score_date desc
      limit 1
    )
    from d
    where d.score_date is not null
  )
  select score_date
  from d
  where score_date is not null
  limit p_limit;
$$;

grant execute on function get_recent_score_periods(text, text, int)
  to anon, authenticated, service_role;
