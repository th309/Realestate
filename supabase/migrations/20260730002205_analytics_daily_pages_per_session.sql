-- Add pages_per_session to the daily rollup so that KPI's sparkline is real.
--
-- Without it the caller had no per-day page_count and would have had to
-- fabricate the series — which is the defect being removed: all six sparklines
-- previously shared one daily-unique-visitor array, so the chart under "Bounce
-- Rate" plotted visitor counts.
--
-- Return type changes, so the function must be dropped first.

drop function if exists public.analytics_daily_visitors(timestamptz, timestamptz, text, text);

create function public.analytics_daily_visitors(
  p_start timestamptz, p_end timestamptz default null, p_traffic text default 'human',
  p_tier text default null)
returns table (day date, visitors bigint, sessions bigint, avg_duration numeric,
  bounce_rate numeric, pages_per_session numeric)
language sql stable as $$
  select (s.started_at at time zone 'UTC')::date, count(distinct s.visitor_id)::bigint, count(*)::bigint,
    round(coalesce(avg(least(coalesce(s.duration_seconds,0), 1800)),0)::numeric,1),
    round(coalesce(avg(case when s.is_bounce then 1.0 else 0.0 end),0)::numeric,4),
    round(coalesce(avg(coalesce(s.page_count,0)),0)::numeric,2)
  from public.user_sessions s
  where s.started_at >= p_start and (p_end is null or s.started_at < p_end)
    and (p_tier is null or s.user_tier = p_tier)
    and (p_traffic = 'all'
      or (p_traffic = 'human' and s.is_bot is false)
      or (p_traffic = 'bot' and s.is_bot is true)
      or (p_traffic = 'unclassified' and s.is_bot is null))
  group by 1 order by 1;
$$;

grant execute on function public.analytics_daily_visitors(timestamptz, timestamptz, text, text) to service_role;
