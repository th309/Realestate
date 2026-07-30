-- Server-side analytics aggregates, so KPIs stop being computed from a truncated array.
--
-- THE BUG THIS REPLACES: every aggregate on /admin/analytics was derived in Node
-- from `client.from('user_sessions').select(...)` with no `.range()`. PostgREST
-- caps such a request at 1,000 rows. It does not error and does not warn — it
-- returns a well-formed array, and the JS then computes a perfectly correct
-- average of the wrong population. The dashboard's "1,000 TOTAL SESSIONS" was
-- literally that cap; the same window held ~48,000 sessions, so the page was
-- reporting 2% of the data as if it were all of it. `.limit(5000)` elsewhere is
-- no defence — max-rows caps it just the same.
--
-- Aggregating in SQL removes the failure mode entirely: there is no array to
-- truncate. It also lets the traffic segment be a first-class parameter instead
-- of a hardcoded `is_bot = false`.
--
-- p_traffic: 'human' | 'bot' | 'unclassified' | 'all'
--   human        = is_bot IS FALSE  (classified human, on evidence)
--   unclassified = is_bot IS NULL   (never classified — NOT "probably human")
-- Callers default to 'human'.

-- ── Overview KPI tiles ──────────────────────────────────────────────────────
-- Returns one row. Conversion is counted from `signup_complete` EVENTS, not the
-- `user_sessions.converted` flag: that flag is written forward-only from
-- 2026-07-28 and is true on exactly 1 session in 30 days against 13 real
-- signups, so any rate built on it reads ~0 regardless of reality.

create or replace function public.analytics_overview_kpis(
  p_start timestamptz,
  p_end timestamptz default null,
  p_traffic text default 'human',
  p_tier text default null,
  p_device text default null
)
returns table (
  unique_visitors bigint,
  total_sessions bigint,
  avg_session_duration numeric,
  bounce_rate numeric,
  pages_per_session numeric,
  converted_visitors bigint,
  conversion_rate numeric
)
language sql
stable
as $$
  with scoped as (
    select s.*
    from public.user_sessions s
    where s.started_at >= p_start
      and (p_end is null or s.started_at < p_end)
      and (p_tier is null or s.user_tier = p_tier)
      and (p_device is null or s.device_type = p_device)
      and (
        p_traffic = 'all'
        or (p_traffic = 'human' and s.is_bot is false)
        or (p_traffic = 'bot' and s.is_bot is true)
        or (p_traffic = 'unclassified' and s.is_bot is null)
      )
  ),
  conv as (
    select count(distinct e.visitor_id) as n
    from public.user_events e
    where e.event_action = 'signup_complete'
      and e.created_at >= p_start
      and (p_end is null or e.created_at < p_end)
      and (
        p_traffic = 'all'
        or (p_traffic = 'human' and e.is_bot is false)
        or (p_traffic = 'bot' and e.is_bot is true)
        or (p_traffic = 'unclassified' and e.is_bot is null)
      )
  )
  select
    count(distinct scoped.visitor_id)::bigint,
    count(*)::bigint,
    -- Averaged over EVERY session in the segment, not just those with a
    -- non-zero duration. The old JS filtered to `duration_seconds > 0` before
    -- averaging while counting all rows for `total_sessions`, so the tile and
    -- the count beside it described different populations.
    round(coalesce(avg(coalesce(scoped.duration_seconds, 0)), 0)::numeric, 1),
    round(coalesce(avg(case when scoped.is_bounce then 1.0 else 0.0 end), 0)::numeric, 4),
    round(coalesce(avg(coalesce(scoped.page_count, 0)), 0)::numeric, 2),
    (select n from conv)::bigint,
    case when count(distinct scoped.visitor_id) = 0 then 0
         else round(((select n from conv)::numeric / count(distinct scoped.visitor_id)), 4)
    end
  from scoped;
$$;

-- ── How much traffic each segment holds ─────────────────────────────────────
-- Powers the "N human · N bot · N unclassified" disclosure. Without this the
-- filtering is invisible and a corrected number just looks like a broken one.

create or replace function public.analytics_traffic_segments(
  p_start timestamptz,
  p_end timestamptz default null
)
returns table (human bigint, bot bigint, unclassified bigint, total bigint)
language sql
stable
as $$
  select
    count(*) filter (where is_bot is false)::bigint,
    count(*) filter (where is_bot is true)::bigint,
    count(*) filter (where is_bot is null)::bigint,
    count(*)::bigint
  from public.user_sessions
  where started_at >= p_start
    and (p_end is null or started_at < p_end);
$$;

-- ── Daily unique visitors + sessions (DAU chart, real sparklines) ───────────

create or replace function public.analytics_daily_visitors(
  p_start timestamptz,
  p_end timestamptz default null,
  p_traffic text default 'human',
  p_tier text default null
)
returns table (day date, visitors bigint, sessions bigint, avg_duration numeric, bounce_rate numeric)
language sql
stable
as $$
  select
    (s.started_at at time zone 'UTC')::date as day,
    count(distinct s.visitor_id)::bigint,
    count(*)::bigint,
    round(coalesce(avg(coalesce(s.duration_seconds, 0)), 0)::numeric, 1),
    round(coalesce(avg(case when s.is_bounce then 1.0 else 0.0 end), 0)::numeric, 4)
  from public.user_sessions s
  where s.started_at >= p_start
    and (p_end is null or s.started_at < p_end)
    and (p_tier is null or s.user_tier = p_tier)
    and (
      p_traffic = 'all'
      or (p_traffic = 'human' and s.is_bot is false)
      or (p_traffic = 'bot' and s.is_bot is true)
      or (p_traffic = 'unclassified' and s.is_bot is null)
    )
  group by 1
  order by 1;
$$;

-- ── Funnel stage counts by event action ─────────────────────────────────────
-- Takes the actions as an array so stage definitions live in application code
-- and cannot drift from a hardcoded SQL list. Returns distinct visitors per
-- action; the caller sequences them.

create or replace function public.analytics_event_visitor_counts(
  p_start timestamptz,
  p_actions text[],
  p_end timestamptz default null,
  p_traffic text default 'human',
  p_tier text default null
)
returns table (event_action text, visitors bigint, events bigint)
language sql
stable
as $$
  select
    e.event_action::text,
    count(distinct e.visitor_id)::bigint,
    count(*)::bigint
  from public.user_events e
  where e.created_at >= p_start
    and (p_end is null or e.created_at < p_end)
    and e.event_action = any(p_actions)
    and (p_tier is null or e.user_tier = p_tier)
    and (
      p_traffic = 'all'
      or (p_traffic = 'human' and e.is_bot is false)
      or (p_traffic = 'bot' and e.is_bot is true)
      or (p_traffic = 'unclassified' and e.is_bot is null)
    )
  group by 1;
$$;

-- ── Top pages ───────────────────────────────────────────────────────────────

create or replace function public.analytics_top_pages(
  p_start timestamptz,
  p_end timestamptz default null,
  p_traffic text default 'human',
  p_tier text default null,
  p_limit int default 20
)
returns table (page_path text, views bigint, visitors bigint)
language sql
stable
as $$
  select e.page_path::text, count(*)::bigint, count(distinct e.visitor_id)::bigint
  from public.user_events e
  where e.event_category = 'pageview'
    and e.page_path is not null
    and e.created_at >= p_start
    and (p_end is null or e.created_at < p_end)
    and (p_tier is null or e.user_tier = p_tier)
    and (
      p_traffic = 'all'
      or (p_traffic = 'human' and e.is_bot is false)
      or (p_traffic = 'bot' and e.is_bot is true)
      or (p_traffic = 'unclassified' and e.is_bot is null)
    )
  group by 1
  order by 2 desc
  limit p_limit;
$$;

-- ── Acquisition: traffic sources ────────────────────────────────────────────

create or replace function public.analytics_traffic_sources(
  p_start timestamptz,
  p_end timestamptz default null,
  p_traffic text default 'human'
)
returns table (entry_type text, source text, sessions bigint, visitors bigint)
language sql
stable
as $$
  select
    coalesce(s.entry_type, 'unknown')::text,
    coalesce(s.utm_source, s.referrer_domain, 'direct')::text,
    count(*)::bigint,
    count(distinct s.visitor_id)::bigint
  from public.user_sessions s
  where s.started_at >= p_start
    and (p_end is null or s.started_at < p_end)
    and (
      p_traffic = 'all'
      or (p_traffic = 'human' and s.is_bot is false)
      or (p_traffic = 'bot' and s.is_bot is true)
      or (p_traffic = 'unclassified' and s.is_bot is null)
    )
  group by 1, 2
  order by 3 desc;
$$;

-- ── Acquisition: landing page performance ───────────────────────────────────
-- `signups` counts signup_complete EVENTS attributed to the landing session,
-- not `user_sessions.converted` (forward-only, true on 1 row in 30 days).

create or replace function public.analytics_landing_performance(
  p_start timestamptz,
  p_end timestamptz default null,
  p_traffic text default 'human',
  p_limit int default 50
)
returns table (
  page text, sessions bigint, bounce_rate numeric, avg_time numeric, signups bigint, conversion_rate numeric
)
language sql
stable
as $$
  with scoped as (
    select s.session_id, s.landing_page, s.is_bounce, s.duration_seconds
    from public.user_sessions s
    where s.started_at >= p_start
      and (p_end is null or s.started_at < p_end)
      and s.landing_page is not null
      and (
        p_traffic = 'all'
        or (p_traffic = 'human' and s.is_bot is false)
        or (p_traffic = 'bot' and s.is_bot is true)
        or (p_traffic = 'unclassified' and s.is_bot is null)
      )
  ),
  signups as (
    select distinct session_id
    from public.user_events
    where event_action = 'signup_complete'
      and created_at >= p_start
      and (p_end is null or created_at < p_end)
  )
  select
    scoped.landing_page::text,
    count(*)::bigint,
    round(coalesce(avg(case when scoped.is_bounce then 1.0 else 0.0 end), 0)::numeric, 4),
    round(coalesce(avg(coalesce(scoped.duration_seconds, 0)), 0)::numeric, 1),
    count(*) filter (where g.session_id is not null)::bigint,
    round(
      count(*) filter (where g.session_id is not null)::numeric / nullif(count(*), 0), 4
    )
  from scoped
  left join signups g on g.session_id = scoped.session_id
  group by 1
  order by 2 desc
  limit p_limit;
$$;

-- ── Retention: DAU / WAU / MAU ──────────────────────────────────────────────
-- Keyed on visitor_id, so it is only meaningful once bots are excluded — a
-- crawler population has ~1.00 sessions per visitor and never returns.

create or replace function public.analytics_active_users(
  p_traffic text default 'human',
  p_tier text default null
)
returns table (dau bigint, wau bigint, mau bigint, stickiness numeric)
language sql
stable
as $$
  with scoped as (
    select s.visitor_id, s.started_at
    from public.user_sessions s
    where s.started_at >= now() - interval '30 days'
      and (p_tier is null or s.user_tier = p_tier)
      and (
        p_traffic = 'all'
        or (p_traffic = 'human' and s.is_bot is false)
        or (p_traffic = 'bot' and s.is_bot is true)
        or (p_traffic = 'unclassified' and s.is_bot is null)
      )
  ),
  counts as (
    select
      count(distinct visitor_id) filter (where started_at >= now() - interval '1 day') as d,
      count(distinct visitor_id) filter (where started_at >= now() - interval '7 days') as w,
      count(distinct visitor_id) as m
    from scoped
  )
  select d::bigint, w::bigint, m::bigint,
         case when m = 0 then 0 else round(d::numeric / m, 4) end
  from counts;
$$;

-- Backend calls these with the service role.
grant execute on function public.analytics_overview_kpis(timestamptz, timestamptz, text, text, text) to service_role;
grant execute on function public.analytics_traffic_segments(timestamptz, timestamptz) to service_role;
grant execute on function public.analytics_daily_visitors(timestamptz, timestamptz, text, text) to service_role;
grant execute on function public.analytics_event_visitor_counts(timestamptz, text[], timestamptz, text, text) to service_role;
grant execute on function public.analytics_top_pages(timestamptz, timestamptz, text, text, int) to service_role;
grant execute on function public.analytics_traffic_sources(timestamptz, timestamptz, text) to service_role;
grant execute on function public.analytics_landing_performance(timestamptz, timestamptz, text, int) to service_role;
grant execute on function public.analytics_active_users(text, text) to service_role;
