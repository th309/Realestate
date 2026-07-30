-- Cap session duration at 30 minutes when AVERAGING.
--
-- Duration is last_activity_at - started_at, advanced by a heartbeat that fires
-- every 30s while the tab is VISIBLE, so a pinned tab records hours. The
-- human-segment mean came out at 2,468s (41 minutes) — describing a handful of
-- long-lived tabs rather than a typical visit. 1800s is the conventional
-- inactivity timeout. The raw column is untouched, so the duration-distribution
-- panel keeps its tail.

create or replace function public.analytics_overview_kpis(
  p_start timestamptz, p_end timestamptz default null, p_traffic text default 'human',
  p_tier text default null, p_device text default null)
returns table (unique_visitors bigint, total_sessions bigint, avg_session_duration numeric,
  bounce_rate numeric, pages_per_session numeric, converted_visitors bigint, conversion_rate numeric)
language sql stable as $$
  with scoped as (
    select s.* from public.user_sessions s
    where s.started_at >= p_start and (p_end is null or s.started_at < p_end)
      and (p_tier is null or s.user_tier = p_tier)
      and (p_device is null or s.device_type = p_device)
      and (p_traffic = 'all'
        or (p_traffic = 'human' and s.is_bot is false)
        or (p_traffic = 'bot' and s.is_bot is true)
        or (p_traffic = 'unclassified' and s.is_bot is null))
  ), conv as (
    select count(distinct e.visitor_id) as n from public.user_events e
    where e.event_action = 'signup_complete' and e.created_at >= p_start
      and (p_end is null or e.created_at < p_end)
      and (p_traffic = 'all'
        or (p_traffic = 'human' and e.is_bot is false)
        or (p_traffic = 'bot' and e.is_bot is true)
        or (p_traffic = 'unclassified' and e.is_bot is null))
  )
  select count(distinct scoped.visitor_id)::bigint, count(*)::bigint,
    round(coalesce(avg(least(coalesce(scoped.duration_seconds,0), 1800)),0)::numeric,1),
    round(coalesce(avg(case when scoped.is_bounce then 1.0 else 0.0 end),0)::numeric,4),
    round(coalesce(avg(coalesce(scoped.page_count,0)),0)::numeric,2),
    (select n from conv)::bigint,
    case when count(distinct scoped.visitor_id)=0 then 0
      else round(((select n from conv)::numeric / count(distinct scoped.visitor_id)),4) end
  from scoped;
$$;

grant execute on function public.analytics_overview_kpis(timestamptz, timestamptz, text, text, text) to service_role;
