-- Fully-populated page performance, plus per-visitor journeys.
--
-- Top Pages previously returned hardcoded 0 for bounce, time-on-page and
-- conversion, which rendered as a real "0.0%" on every row. Those columns ARE
-- computable by joining each pageview back to its session: entrances are
-- sessions that LANDED on the page, bounce rate is measured over those
-- entrances (the only cohort for which "bounced" means anything), exits come
-- from exit_page, and signups are attributed to sessions that included it.
--
-- The visitor functions are new capability rather than a repair: following one
-- person end to end, across every session they have had. analytics_visitor_
-- timeline unions session boundaries with events so the result reads as a
-- single chronological trail, and because anonymous visitor_ids are stitched to
-- a user_id at signup, a journey spans the pre- and post-signup halves of the
-- same person.

create or replace function public.analytics_page_performance(
  p_start timestamptz, p_end timestamptz default null, p_traffic text default 'human',
  p_tier text default null, p_limit int default 25)
returns table (page_path text, views bigint, visitors bigint, entrances bigint,
  exits bigint, exit_rate numeric, bounce_rate numeric, avg_session_seconds numeric, signups bigint)
language sql stable as $$
  with scoped_sessions as (
    select s.session_id, s.landing_page, s.exit_page, s.is_bounce,
           least(coalesce(s.duration_seconds,0), 1800) as dur
    from public.user_sessions s
    where s.started_at >= p_start and (p_end is null or s.started_at < p_end)
      and (p_tier is null or s.user_tier = p_tier)
      and (p_traffic = 'all'
        or (p_traffic = 'human' and s.is_bot is false)
        or (p_traffic = 'bot' and s.is_bot is true)
        or (p_traffic = 'unclassified' and s.is_bot is null))
  ),
  views as (
    select e.page_path, e.visitor_id, e.session_id
    from public.user_events e
    join scoped_sessions ss on ss.session_id = e.session_id
    where e.event_category = 'pageview' and e.page_path is not null
      and e.created_at >= p_start and (p_end is null or e.created_at < p_end)
  ),
  converted as (
    select distinct session_id from public.user_events
    where event_action = 'signup_complete' and created_at >= p_start
      and (p_end is null or created_at < p_end)
  )
  select v.page_path::text, count(*)::bigint, count(distinct v.visitor_id)::bigint,
    count(distinct ss.session_id) filter (where ss.landing_page = v.page_path)::bigint,
    count(distinct ss.session_id) filter (where ss.exit_page = v.page_path)::bigint,
    round(count(distinct ss.session_id) filter (where ss.exit_page = v.page_path)::numeric
          / nullif(count(distinct ss.session_id), 0), 4),
    round(count(distinct ss.session_id) filter (where ss.landing_page = v.page_path and ss.is_bounce)::numeric
          / nullif(count(distinct ss.session_id) filter (where ss.landing_page = v.page_path), 0), 4),
    round(coalesce(avg(ss.dur), 0)::numeric, 1),
    count(distinct c.session_id)::bigint
  from views v
  join scoped_sessions ss on ss.session_id = v.session_id
  left join converted c on c.session_id = v.session_id
  group by 1 order by 2 desc limit p_limit;
$$;

create or replace function public.analytics_visitor_list(
  p_start timestamptz, p_end timestamptz default null, p_traffic text default 'human',
  p_only_converted boolean default false, p_limit int default 100)
returns table (visitor_id text, user_id uuid, user_tier text, first_seen timestamptz,
  last_seen timestamptz, sessions bigint, pageviews bigint, interactions bigint,
  total_seconds numeric, entry_type text, source text, landing_page text, converted boolean)
language sql stable as $$
  with scoped as (
    select s.* from public.user_sessions s
    where s.started_at >= p_start and (p_end is null or s.started_at < p_end)
      and (p_traffic = 'all'
        or (p_traffic = 'human' and s.is_bot is false)
        or (p_traffic = 'bot' and s.is_bot is true)
        or (p_traffic = 'unclassified' and s.is_bot is null))
  ),
  ev as (
    select e.visitor_id,
      count(*) filter (where e.event_category = 'pageview')::bigint as pv,
      count(*) filter (where e.event_category <> 'pageview')::bigint as ix,
      bool_or(e.event_action = 'signup_complete') as did_convert
    from public.user_events e
    join scoped s2 on s2.session_id = e.session_id
    group by 1
  ),
  agg as (
    select s.visitor_id,
      max(s.user_id::text)::uuid as user_id,
      max(s.user_tier) as user_tier,
      min(s.started_at) as first_seen,
      max(coalesce(s.last_activity_at, s.started_at)) as last_seen,
      count(*)::bigint as sessions,
      sum(least(coalesce(s.duration_seconds,0), 1800))::numeric as total_seconds,
      (array_agg(s.entry_type order by s.started_at))[1] as entry_type,
      (array_agg(coalesce(s.utm_source, s.referrer_domain, 'direct') order by s.started_at))[1] as source,
      (array_agg(s.landing_page order by s.started_at))[1] as landing_page
    from scoped s group by 1
  )
  select agg.visitor_id::text, agg.user_id, agg.user_tier::text, agg.first_seen, agg.last_seen,
    agg.sessions, coalesce(ev.pv, 0), coalesce(ev.ix, 0), agg.total_seconds,
    agg.entry_type::text, agg.source::text, agg.landing_page::text,
    coalesce(ev.did_convert, false)
  from agg left join ev on ev.visitor_id = agg.visitor_id
  where (not p_only_converted or coalesce(ev.did_convert, false))
  order by agg.last_seen desc limit p_limit;
$$;

create or replace function public.analytics_visitor_timeline(
  p_visitor_id text, p_limit int default 500)
returns table (occurred_at timestamptz, session_id text, kind text, event_category text,
  event_action text, page_path text, previous_page_path text, label text, properties jsonb)
language sql stable as $$
  select s.started_at, s.session_id::text, 'session_start'::text,
    null::text, null::text, s.landing_page::text, null::text,
    coalesce(s.entry_type, 'direct')::text,
    jsonb_build_object('referrer_domain', s.referrer_domain, 'device_type', s.device_type,
      'browser', s.browser, 'os', s.os, 'utm_source', s.utm_source,
      'duration_seconds', s.duration_seconds, 'page_count', s.page_count)
  from public.user_sessions s where s.visitor_id = p_visitor_id
  union all
  select e.created_at, e.session_id::text, 'event'::text, e.event_category::text,
    e.event_action::text, e.page_path::text, e.previous_page_path::text,
    e.event_label::text, e.properties
  from public.user_events e where e.visitor_id = p_visitor_id
  order by 1 asc limit p_limit;
$$;

grant execute on function public.analytics_page_performance(timestamptz, timestamptz, text, text, int) to service_role;
grant execute on function public.analytics_visitor_list(timestamptz, timestamptz, text, boolean, int) to service_role;
grant execute on function public.analytics_visitor_timeline(text, int) to service_role;
