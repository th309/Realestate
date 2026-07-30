-- Route every analytics_* traffic filter through public.analytics_in_segment.
--
-- Each function below previously inlined its own copy of:
--     (p_traffic = 'all'
--      or (p_traffic = 'human'        and s.is_bot is false)
--      or (p_traffic = 'bot'          and s.is_bot is true)
--      or (p_traffic = 'unclassified' and s.is_bot is null))
--
-- That predicate cannot see is_internal, so admin/owner browsing counted as
-- customer traffic in every tile claiming to show people. Seventeen copies of a
-- rule is also seventeen places for the next segment to be forgotten -- which is
-- exactly how the 'internal' segment arrived half-wired: the column and the
-- helper existed, and not one query consulted them.
--
-- BEHAVIOUR CHANGE: 'human', 'bot' and 'unclassified' now EXCLUDE internal
-- traffic, so those numbers get smaller. That is the point. 'internal' and
-- 'all' are the only segments that include it.
--
-- analytics_page_performance and analytics_landing_performance join sessions to
-- events. Both sides are now filtered on the same segment; previously the event
-- side (signups / conversions / pageviews) was either unfiltered or gated only
-- by the session join, so an internal signup could still land on a row that
-- claimed to describe customers.
--
-- Grants: CREATE OR REPLACE preserves the ACL, but every analytics_* function
-- is re-locked at the end regardless -- service_role only, never anon or
-- authenticated. The dashboard reads through the backend's service key.

-- ---------------------------------------------------------------------------
-- Session-sourced functions
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.analytics_active_users(
  p_traffic text DEFAULT 'human'::text,
  p_tier text DEFAULT NULL::text
)
RETURNS TABLE(dau bigint, wau bigint, mau bigint, stickiness numeric)
LANGUAGE sql
STABLE
AS $function$
  with scoped as (
    select s.visitor_id, s.started_at from public.user_sessions s
    where s.started_at >= now() - interval '30 days'
      and (p_tier is null or s.user_tier = p_tier)
      and public.analytics_in_segment(s.is_bot, s.is_internal, p_traffic)
  ), counts as (
    select count(distinct visitor_id) filter (where started_at >= now() - interval '1 day') as d,
           count(distinct visitor_id) filter (where started_at >= now() - interval '7 days') as w,
           count(distinct visitor_id) as m
    from scoped
  )
  select d::bigint, w::bigint, m::bigint,
         case when m=0 then 0 else round(d::numeric/m,4) end from counts;
$function$;

CREATE OR REPLACE FUNCTION public.analytics_channel_trend(
  p_start timestamp with time zone,
  p_end timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_traffic text DEFAULT 'human'::text
)
RETURNS TABLE(day date, entry_type text, sessions bigint)
LANGUAGE sql
STABLE
AS $function$
  select
    (s.started_at at time zone 'UTC')::date,
    coalesce(s.entry_type, 'unknown')::text,
    count(*)::bigint
  from public.user_sessions s
  where s.started_at >= p_start
    and (p_end is null or s.started_at < p_end)
    and public.analytics_in_segment(s.is_bot, s.is_internal, p_traffic)
  group by 1, 2
  order by 1, 2;
$function$;

CREATE OR REPLACE FUNCTION public.analytics_daily_visitors(
  p_start timestamp with time zone,
  p_end timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_traffic text DEFAULT 'human'::text,
  p_tier text DEFAULT NULL::text
)
RETURNS TABLE(day date, visitors bigint, sessions bigint, avg_duration numeric, bounce_rate numeric, pages_per_session numeric)
LANGUAGE sql
STABLE
AS $function$
  select (s.started_at at time zone 'UTC')::date, count(distinct s.visitor_id)::bigint, count(*)::bigint,
    round(coalesce(avg(least(coalesce(s.duration_seconds,0), 1800)),0)::numeric,1),
    round(coalesce(avg(case when s.is_bounce then 1.0 else 0.0 end),0)::numeric,4),
    round(coalesce(avg(coalesce(s.page_count,0)),0)::numeric,2)
  from public.user_sessions s
  where s.started_at >= p_start and (p_end is null or s.started_at < p_end)
    and (p_tier is null or s.user_tier = p_tier)
    and public.analytics_in_segment(s.is_bot, s.is_internal, p_traffic)
  group by 1 order by 1;
$function$;

CREATE OR REPLACE FUNCTION public.analytics_exit_pages(
  p_start timestamp with time zone,
  p_end timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_traffic text DEFAULT 'human'::text,
  p_tier text DEFAULT NULL::text,
  p_device text DEFAULT NULL::text,
  p_limit integer DEFAULT 20
)
RETURNS TABLE(page text, exits bigint)
LANGUAGE sql
STABLE
AS $function$
  select s.exit_page::text, count(*)::bigint
  from public.user_sessions s
  where s.started_at >= p_start
    and (p_end is null or s.started_at < p_end)
    and s.exit_page is not null
    and (p_tier is null or s.user_tier = p_tier)
    and (p_device is null or s.device_type = p_device)
    and public.analytics_in_segment(s.is_bot, s.is_internal, p_traffic)
  group by 1
  order by 2 desc
  limit p_limit;
$function$;

CREATE OR REPLACE FUNCTION public.analytics_journey_landing_pages(
  p_start timestamp with time zone,
  p_end timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_traffic text DEFAULT 'human'::text,
  p_tier text DEFAULT NULL::text,
  p_device text DEFAULT NULL::text,
  p_limit integer DEFAULT 20
)
RETURNS TABLE(page text, sessions bigint, bounce_rate numeric, avg_duration numeric)
LANGUAGE sql
STABLE
AS $function$
  select
    s.landing_page::text,
    count(*)::bigint,
    round(coalesce(avg(case when s.is_bounce then 1.0 else 0.0 end), 0)::numeric, 4),
    round(coalesce(avg(coalesce(s.duration_seconds, 0)), 0)::numeric, 1)
  from public.user_sessions s
  where s.started_at >= p_start
    and (p_end is null or s.started_at < p_end)
    and s.landing_page is not null
    and (p_tier is null or s.user_tier = p_tier)
    and (p_device is null or s.device_type = p_device)
    and public.analytics_in_segment(s.is_bot, s.is_internal, p_traffic)
  group by 1
  order by 2 desc
  limit p_limit;
$function$;

CREATE OR REPLACE FUNCTION public.analytics_session_duration_buckets(
  p_start timestamp with time zone,
  p_end timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_traffic text DEFAULT 'human'::text,
  p_tier text DEFAULT NULL::text,
  p_device text DEFAULT NULL::text
)
RETURNS TABLE(bucket text, bucket_order integer, sessions bigint)
LANGUAGE sql
STABLE
AS $function$
  with defs(bucket, bucket_order, lo, hi) as (
    values
      ('0s',      1, 0,   0),
      ('1-4s',    2, 1,   4),
      ('5s',      3, 5,   5),
      ('6-29s',   4, 6,   29),
      ('30s-2m',  5, 30,  119),
      ('2-5m',    6, 120, 299),
      ('5-10m',   7, 300, 599),
      ('10m+',    8, 600, 2147483647)
  ),
  scoped as (
    select coalesce(s.duration_seconds, 0) as secs
    from public.user_sessions s
    where s.started_at >= p_start
      and (p_end is null or s.started_at < p_end)
      and (p_tier is null or s.user_tier = p_tier)
      and (p_device is null or s.device_type = p_device)
      and public.analytics_in_segment(s.is_bot, s.is_internal, p_traffic)
  )
  select
    d.bucket::text,
    d.bucket_order,
    count(scoped.secs)::bigint
  from defs d
  left join scoped on scoped.secs between d.lo and d.hi
  group by d.bucket, d.bucket_order
  order by d.bucket_order;
$function$;

CREATE OR REPLACE FUNCTION public.analytics_traffic_sources(
  p_start timestamp with time zone,
  p_end timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_traffic text DEFAULT 'human'::text
)
RETURNS TABLE(entry_type text, source text, sessions bigint, visitors bigint)
LANGUAGE sql
STABLE
AS $function$
  select coalesce(s.entry_type,'unknown')::text,
         coalesce(s.utm_source, s.referrer_domain, 'direct')::text,
         count(*)::bigint, count(distinct s.visitor_id)::bigint
  from public.user_sessions s
  where s.started_at >= p_start and (p_end is null or s.started_at < p_end)
    and public.analytics_in_segment(s.is_bot, s.is_internal, p_traffic)
  group by 1,2 order by 3 desc;
$function$;

-- ---------------------------------------------------------------------------
-- Event-sourced functions
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.analytics_event_visitor_counts(
  p_start timestamp with time zone,
  p_actions text[],
  p_end timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_traffic text DEFAULT 'human'::text,
  p_tier text DEFAULT NULL::text
)
RETURNS TABLE(event_action text, visitors bigint, events bigint)
LANGUAGE sql
STABLE
AS $function$
  select e.event_action::text, count(distinct e.visitor_id)::bigint, count(*)::bigint
  from public.user_events e
  where e.created_at >= p_start and (p_end is null or e.created_at < p_end)
    and e.event_action = any(p_actions)
    and (p_tier is null or e.user_tier = p_tier)
    and public.analytics_in_segment(e.is_bot, e.is_internal, p_traffic)
  group by 1;
$function$;

CREATE OR REPLACE FUNCTION public.analytics_top_pages(
  p_start timestamp with time zone,
  p_end timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_traffic text DEFAULT 'human'::text,
  p_tier text DEFAULT NULL::text,
  p_limit integer DEFAULT 20
)
RETURNS TABLE(page_path text, views bigint, visitors bigint)
LANGUAGE sql
STABLE
AS $function$
  select e.page_path::text, count(*)::bigint, count(distinct e.visitor_id)::bigint
  from public.user_events e
  where e.event_category = 'pageview' and e.page_path is not null
    and e.created_at >= p_start and (p_end is null or e.created_at < p_end)
    and (p_tier is null or e.user_tier = p_tier)
    and public.analytics_in_segment(e.is_bot, e.is_internal, p_traffic)
  group by 1 order by 2 desc limit p_limit;
$function$;

CREATE OR REPLACE FUNCTION public.analytics_common_paths(
  p_start timestamp with time zone,
  p_end timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_traffic text DEFAULT 'human'::text,
  p_tier text DEFAULT NULL::text,
  p_device text DEFAULT NULL::text,
  p_limit integer DEFAULT 20
)
RETURNS TABLE(path text[], sessions bigint)
LANGUAGE sql
STABLE
AS $function$
  with ordered as (
    select
      e.session_id,
      e.page_path::text as page_path,
      row_number() over (
        partition by e.session_id order by e.created_at, e.id
      ) as step
    from public.user_events e
    where e.event_category = 'pageview'
      and e.page_path is not null
      and e.created_at >= p_start
      and (p_end is null or e.created_at < p_end)
      and (p_tier is null or e.user_tier = p_tier)
      and public.analytics_in_segment(e.is_bot, e.is_internal, p_traffic)
      and (
        p_device is null
        or exists (
          select 1 from public.user_sessions s
          where s.session_id = e.session_id and s.device_type = p_device
        )
      )
  ),
  prefixes as (
    select session_id, array_agg(page_path order by step) as path
    from ordered
    where step <= 3
    group by session_id
  )
  select path, count(*)::bigint
  from prefixes
  group by 1
  order by 2 desc
  limit p_limit;
$function$;

CREATE OR REPLACE FUNCTION public.analytics_navigation_flows(
  p_start timestamp with time zone,
  p_end timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_traffic text DEFAULT 'human'::text,
  p_tier text DEFAULT NULL::text,
  p_device text DEFAULT NULL::text,
  p_limit integer DEFAULT 50
)
RETURNS TABLE(from_path text, to_path text, transitions bigint, visitors bigint)
LANGUAGE sql
STABLE
AS $function$
  with pairs as (
    select
      coalesce(
        e.previous_page_path,
        nullif(e.properties->>'previous_page_path', '')
      )::text as from_path,
      e.page_path::text as to_path,
      e.visitor_id
    from public.user_events e
    where e.event_category = 'pageview'
      and e.page_path is not null
      and e.created_at >= p_start
      and (p_end is null or e.created_at < p_end)
      and (p_tier is null or e.user_tier = p_tier)
      and public.analytics_in_segment(e.is_bot, e.is_internal, p_traffic)
      and (
        p_device is null
        or exists (
          select 1 from public.user_sessions s
          where s.session_id = e.session_id and s.device_type = p_device
        )
      )
  )
  select from_path, to_path, count(*)::bigint, count(distinct visitor_id)::bigint
  from pairs
  where from_path is not null
    and from_path <> to_path
  group by 1, 2
  order by 3 desc
  limit p_limit;
$function$;

CREATE OR REPLACE FUNCTION public.analytics_outbound_destinations(
  p_start timestamp with time zone,
  p_end timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_traffic text DEFAULT 'human'::text,
  p_tier text DEFAULT NULL::text,
  p_device text DEFAULT NULL::text,
  p_limit integer DEFAULT 25
)
RETURNS TABLE(domain text, clicks bigint, sessions bigint, top_url text, from_page text)
LANGUAGE sql
STABLE
AS $function$
  with scoped as (
    select
      nullif(e.properties->>'destination_domain', '')::text as domain,
      nullif(e.properties->>'destination_url', '')::text as destination_url,
      coalesce(nullif(e.properties->>'from_page', ''), e.page_path)::text as from_page,
      e.session_id
    from public.user_events e
    where e.event_category = 'outbound'
      and e.created_at >= p_start
      and (p_end is null or e.created_at < p_end)
      and (p_tier is null or e.user_tier = p_tier)
      and public.analytics_in_segment(e.is_bot, e.is_internal, p_traffic)
      and (
        p_device is null
        or exists (
          select 1 from public.user_sessions s
          where s.session_id = e.session_id and s.device_type = p_device
        )
      )
  )
  select
    domain,
    count(*)::bigint,
    count(distinct session_id)::bigint,
    -- mode() = the most-clicked value, matching the previous topKey() helper.
    coalesce(mode() within group (order by destination_url), '')::text,
    coalesce(mode() within group (order by from_page), '')::text
  from scoped
  where domain is not null
  group by 1
  order by 2 desc
  limit p_limit;
$function$;

CREATE OR REPLACE FUNCTION public.analytics_sequential_funnel(
  p_start timestamp with time zone,
  p_steps jsonb,
  p_traffic text DEFAULT 'human'::text
)
RETURNS TABLE(step_index integer, visitors bigint)
LANGUAGE plpgsql
STABLE
AS $function$
declare
  i int;
  n int := jsonb_array_length(p_steps);
  matchers text[];
  prev_visitors text[];
  cur_visitors text[];
begin
  for i in 0 .. n - 1 loop
    select array_agg(x) into matchers
    from jsonb_array_elements_text(p_steps -> i) as t(x);

    if i = 0 then
      select array_agg(distinct e.visitor_id) into cur_visitors
      from public.user_events e
      where e.created_at >= p_start
        and (e.event_category || '.' || e.event_action) = any(matchers)
        and e.visitor_id is not null
        and public.analytics_in_segment(e.is_bot, e.is_internal, p_traffic);
    else
      select array_agg(distinct e.visitor_id) into cur_visitors
      from public.user_events e
      where e.created_at >= p_start
        and (e.event_category || '.' || e.event_action) = any(matchers)
        and e.visitor_id = any(prev_visitors)
        and public.analytics_in_segment(e.is_bot, e.is_internal, p_traffic);
    end if;

    prev_visitors := coalesce(cur_visitors, array[]::text[]);

    step_index := i;
    visitors := coalesce(array_length(prev_visitors, 1), 0)::bigint;
    return next;
  end loop;
end;
$function$;

-- ---------------------------------------------------------------------------
-- Functions that join sessions to events -- BOTH sides filtered
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.analytics_overview_kpis(
  p_start timestamp with time zone,
  p_end timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_traffic text DEFAULT 'human'::text,
  p_tier text DEFAULT NULL::text,
  p_device text DEFAULT NULL::text
)
RETURNS TABLE(unique_visitors bigint, total_sessions bigint, avg_session_duration numeric, bounce_rate numeric, pages_per_session numeric, converted_visitors bigint, conversion_rate numeric)
LANGUAGE sql
STABLE
AS $function$
  with scoped as (
    select s.* from public.user_sessions s
    where s.started_at >= p_start and (p_end is null or s.started_at < p_end)
      and (p_tier is null or s.user_tier = p_tier)
      and (p_device is null or s.device_type = p_device)
      and public.analytics_in_segment(s.is_bot, s.is_internal, p_traffic)
  ), conv as (
    -- Counted independently of `scoped` (a signup can be attributed to a
    -- visitor whose session fell outside the tier/device filter), so this side
    -- needs its own segment predicate rather than inheriting one via a join.
    select count(distinct e.visitor_id) as n from public.user_events e
    where e.event_action = 'signup_complete' and e.created_at >= p_start
      and (p_end is null or e.created_at < p_end)
      and public.analytics_in_segment(e.is_bot, e.is_internal, p_traffic)
  )
  select count(distinct scoped.visitor_id)::bigint, count(*)::bigint,
    round(coalesce(avg(least(coalesce(scoped.duration_seconds,0), 1800)),0)::numeric,1),
    round(coalesce(avg(case when scoped.is_bounce then 1.0 else 0.0 end),0)::numeric,4),
    round(coalesce(avg(coalesce(scoped.page_count,0)),0)::numeric,2),
    (select n from conv)::bigint,
    case when count(distinct scoped.visitor_id)=0 then 0
      else round(((select n from conv)::numeric / count(distinct scoped.visitor_id)),4) end
  from scoped;
$function$;

CREATE OR REPLACE FUNCTION public.analytics_landing_performance(
  p_start timestamp with time zone,
  p_end timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_traffic text DEFAULT 'human'::text,
  p_limit integer DEFAULT 50
)
RETURNS TABLE(page text, sessions bigint, bounce_rate numeric, avg_time numeric, signups bigint, conversion_rate numeric)
LANGUAGE sql
STABLE
AS $function$
  with scoped as (
    select s.session_id, s.landing_page, s.is_bounce, s.duration_seconds
    from public.user_sessions s
    where s.started_at >= p_start and (p_end is null or s.started_at < p_end)
      and s.landing_page is not null
      and public.analytics_in_segment(s.is_bot, s.is_internal, p_traffic)
  ), signups as (
    -- Segment-filtered on the event side too. Without this the signup column
    -- was drawn from a different population than the sessions column beside
    -- it, so an internal signup inflated the conversion rate of a row that
    -- claimed to describe customers.
    select distinct e.session_id from public.user_events e
    where e.event_action = 'signup_complete' and e.created_at >= p_start
      and (p_end is null or e.created_at < p_end)
      and public.analytics_in_segment(e.is_bot, e.is_internal, p_traffic)
  )
  select scoped.landing_page::text, count(*)::bigint,
    round(coalesce(avg(case when scoped.is_bounce then 1.0 else 0.0 end),0)::numeric,4),
    round(coalesce(avg(coalesce(scoped.duration_seconds,0)),0)::numeric,1),
    count(*) filter (where g.session_id is not null)::bigint,
    round(count(*) filter (where g.session_id is not null)::numeric / nullif(count(*),0),4)
  from scoped left join signups g on g.session_id = scoped.session_id
  group by 1 order by 2 desc limit p_limit;
$function$;

CREATE OR REPLACE FUNCTION public.analytics_page_performance(
  p_start timestamp with time zone,
  p_end timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_traffic text DEFAULT 'human'::text,
  p_tier text DEFAULT NULL::text,
  p_limit integer DEFAULT 25
)
RETURNS TABLE(page_path text, views bigint, visitors bigint, entrances bigint, exits bigint, exit_rate numeric, bounce_rate numeric, avg_session_seconds numeric, signups bigint)
LANGUAGE sql
STABLE
AS $function$
  with scoped_sessions as (
    select s.session_id, s.landing_page, s.exit_page, s.is_bounce,
           least(coalesce(s.duration_seconds,0), 1800) as dur
    from public.user_sessions s
    where s.started_at >= p_start and (p_end is null or s.started_at < p_end)
      and (p_tier is null or s.user_tier = p_tier)
      and public.analytics_in_segment(s.is_bot, s.is_internal, p_traffic)
  ),
  views as (
    -- Filtered on BOTH sides: the join to scoped_sessions and the event's own
    -- flags. The join alone left a pageview counted whenever its denormalised
    -- copy of the verdict disagreed with its session's.
    select e.page_path, e.visitor_id, e.session_id
    from public.user_events e
    join scoped_sessions ss on ss.session_id = e.session_id
    where e.event_category = 'pageview' and e.page_path is not null
      and e.created_at >= p_start and (p_end is null or e.created_at < p_end)
      and public.analytics_in_segment(e.is_bot, e.is_internal, p_traffic)
  ),
  converted as (
    select distinct e.session_id from public.user_events e
    where e.event_action = 'signup_complete' and e.created_at >= p_start
      and (p_end is null or e.created_at < p_end)
      and public.analytics_in_segment(e.is_bot, e.is_internal, p_traffic)
  )
  select
    v.page_path::text,
    count(*)::bigint,
    count(distinct v.visitor_id)::bigint,
    count(distinct ss.session_id) filter (where ss.landing_page = v.page_path)::bigint,
    count(distinct ss.session_id) filter (where ss.exit_page = v.page_path)::bigint,
    round(count(distinct ss.session_id) filter (where ss.exit_page = v.page_path)::numeric
          / nullif(count(distinct ss.session_id), 0), 4),
    -- Bounce is only defined for sessions that ENTERED on this page.
    round(
      count(distinct ss.session_id) filter (where ss.landing_page = v.page_path and ss.is_bounce)::numeric
      / nullif(count(distinct ss.session_id) filter (where ss.landing_page = v.page_path), 0), 4),
    round(coalesce(avg(ss.dur), 0)::numeric, 1),
    count(distinct c.session_id)::bigint
  from views v
  join scoped_sessions ss on ss.session_id = v.session_id
  left join converted c on c.session_id = v.session_id
  group by 1
  order by 2 desc
  limit p_limit;
$function$;

CREATE OR REPLACE FUNCTION public.analytics_visitor_list(
  p_start timestamp with time zone,
  p_end timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_traffic text DEFAULT 'human'::text,
  p_only_converted boolean DEFAULT false,
  p_limit integer DEFAULT 100
)
RETURNS TABLE(visitor_id text, user_id uuid, user_tier text, first_seen timestamp with time zone, last_seen timestamp with time zone, sessions bigint, pageviews bigint, interactions bigint, total_seconds numeric, entry_type text, source text, landing_page text, converted boolean)
LANGUAGE sql
STABLE
AS $function$
  with scoped as (
    select s.* from public.user_sessions s
    where s.started_at >= p_start and (p_end is null or s.started_at < p_end)
      and public.analytics_in_segment(s.is_bot, s.is_internal, p_traffic)
  ),
  ev as (
    -- Deliberately segment-gated by the inner join to `scoped` rather than by a
    -- second predicate on the event. This column counts a visitor's activity
    -- within the sessions already selected; re-filtering the events would drop
    -- activity from a session that IS in the segment, understating the row.
    select e.visitor_id,
      count(*) filter (where e.event_category = 'pageview')::bigint as pv,
      count(*) filter (where e.event_category <> 'pageview')::bigint as ix,
      bool_or(e.event_action = 'signup_complete') as did_convert
    from public.user_events e
    join scoped s2 on s2.session_id = e.session_id
    group by 1
  ),
  agg as (
    select
      s.visitor_id,
      max(s.user_id::text)::uuid as user_id,
      max(s.user_tier) as user_tier,
      min(s.started_at) as first_seen,
      max(coalesce(s.last_activity_at, s.started_at)) as last_seen,
      count(*)::bigint as sessions,
      sum(least(coalesce(s.duration_seconds,0), 1800))::numeric as total_seconds,
      (array_agg(s.entry_type order by s.started_at))[1] as entry_type,
      (array_agg(coalesce(s.utm_source, s.referrer_domain, 'direct') order by s.started_at))[1] as source,
      (array_agg(s.landing_page order by s.started_at))[1] as landing_page
    from scoped s
    group by 1
  )
  select
    agg.visitor_id::text, agg.user_id, agg.user_tier::text,
    agg.first_seen, agg.last_seen, agg.sessions,
    coalesce(ev.pv, 0), coalesce(ev.ix, 0), agg.total_seconds,
    agg.entry_type::text, agg.source::text, agg.landing_page::text,
    coalesce(ev.did_convert, false)
  from agg
  left join ev on ev.visitor_id = agg.visitor_id
  where (not p_only_converted or coalesce(ev.did_convert, false))
  order by agg.last_seen desc
  limit p_limit;
$function$;

-- ---------------------------------------------------------------------------
-- Re-lock every analytics_* function: service_role only.
--
-- Postgres grants EXECUTE to PUBLIC on a newly created function, and these are
-- read paths over raw visitor behaviour. Applied by loop rather than by 17
-- hand-written pairs so a function added later without its own GRANT block is
-- still caught the next time this runs.
-- ---------------------------------------------------------------------------

do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname like 'analytics\_%'
  loop
    execute format(
      'revoke all on function %s from public, anon, authenticated', fn.signature
    );
    execute format(
      'grant execute on function %s to service_role', fn.signature
    );
  end loop;
end
$$;
