-- Which tiers actually appear in a window.
--
-- The daily rollup enumerated tiers from a hardcoded list
-- ['all','anonymous','free','pro','enterprise']. `user_tier` is client-supplied
-- free text with no enum validation at ingestion (event-ingestion.service.ts
-- writes `e.user_tier || 'anonymous'`), and 'admin' is a real tier elsewhere in
-- the codebase — so any tier outside the list was silently missing from the
-- per-tier breakdown while the 'all' row still counted it. The totals and the
-- parts disagreed, quietly.
--
-- Bounded by construction: a day has a handful of distinct tier strings, so this
-- is not the unbounded row fetch the rollup rewrite removed.

create or replace function public.analytics_active_tiers(
  p_start timestamptz,
  p_end timestamptz default null,
  p_traffic text default 'human'
)
returns table (user_tier text)
language sql
stable
as $$
  select distinct coalesce(s.user_tier, 'anonymous')::text
  from public.user_sessions s
  where s.started_at >= p_start
    and (p_end is null or s.started_at < p_end)
    and public.analytics_in_segment(s.is_bot, s.is_internal, p_traffic)
  order by 1;
$$;

revoke all on function public.analytics_active_tiers(timestamptz, timestamptz, text) from public, anon, authenticated;
grant execute on function public.analytics_active_tiers(timestamptz, timestamptz, text) to service_role;
