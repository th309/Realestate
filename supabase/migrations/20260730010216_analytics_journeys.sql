-- Journeys tab: SQL aggregates, so no panel is computed from a truncated array.
--
-- THE BUG THIS REPLACES: every panel on /admin/analytics → Journeys was
-- aggregated in Node from `client.from('user_events').select(...).limit(5000)`
-- (or `.limit(10000)`). Both numbers are ABOVE PostgREST's max-rows ceiling of
-- 1,000, so neither limit ever applied — the request returned a well-formed
-- 1,000-row array and the JS reduced it perfectly. Against ~112,000 events in a
-- trailing 30-day window, every flow, path and exit count described ~1% of the
-- data while presenting itself as all of it. Raising the limit is not a fix:
-- max-rows wins. Aggregating in SQL removes the array there is to truncate.
--
-- The device filter was broken by the same ceiling, and worse:
-- `resolveDeviceSessionIds` pulled session ids with `.limit(20000)` in order to
-- filter events in memory, so "mobile" actually meant "whichever 1,000 session
-- ids PostgREST returned first". Device is a predicate inside each function now.
--
-- p_traffic: 'human' | 'bot' | 'unclassified' | 'all'
--   Predicate copied verbatim from 20260729211000_analytics_aggregate_functions.
--   `human` is `is_bot IS FALSE`, NOT "not a bot" — `is_bot IS NULL` is its own
--   population (never classified), never folded into humans.
--
-- p_device is applied via EXISTS against user_sessions because user_events has
-- no device_type column; device lives only on the session.

-- ── Navigation flows (the Sankey / flow table) ──────────────────────────────
--
-- SOURCE OF THE from-path, and why it is a coalesce:
-- `user_events.previous_page_path` is the promoted top-level column and is the
-- primary source here. It was promoted on 2026-07-28 and NOT backfilled, so at
-- the time of writing it is non-null on 14 rows in 90 days while the JSONB
-- property it was promoted from carries 1,265. Reading the column alone would
-- render an all-but-empty panel — the same failure mode as the row cap, reached
-- by a different route. The fallback reads the pre-promotion rows and is
-- non-double-counting: current writes populate both, and coalesce takes the
-- column. Drop the fallback once the column owns the full retention window.
--
-- Self-transitions (from = to) are excluded. On a pageview they mean a
-- client-side re-render emitted a duplicate pageview, not a navigation; they are
-- ~11% of pairs, and a node linked to itself is not drawable in a layered
-- Sankey.

create or replace function public.analytics_navigation_flows(
  p_start timestamptz,
  p_end timestamptz default null,
  p_traffic text default 'human',
  p_tier text default null,
  p_device text default null,
  p_limit int default 50
)
returns table (from_path text, to_path text, transitions bigint, visitors bigint)
language sql
stable
as $$
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
      and (
        p_traffic = 'all'
        or (p_traffic = 'human' and e.is_bot is false)
        or (p_traffic = 'bot' and e.is_bot is true)
        or (p_traffic = 'unclassified' and e.is_bot is null)
      )
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
$$;

-- ── Landing pages ───────────────────────────────────────────────────────────

create or replace function public.analytics_journey_landing_pages(
  p_start timestamptz,
  p_end timestamptz default null,
  p_traffic text default 'human',
  p_tier text default null,
  p_device text default null,
  p_limit int default 20
)
returns table (page text, sessions bigint, bounce_rate numeric, avg_duration numeric)
language sql
stable
as $$
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
    and (
      p_traffic = 'all'
      or (p_traffic = 'human' and s.is_bot is false)
      or (p_traffic = 'bot' and s.is_bot is true)
      or (p_traffic = 'unclassified' and s.is_bot is null)
    )
  group by 1
  order by 2 desc
  limit p_limit;
$$;

-- ── Exit pages ──────────────────────────────────────────────────────────────

create or replace function public.analytics_exit_pages(
  p_start timestamptz,
  p_end timestamptz default null,
  p_traffic text default 'human',
  p_tier text default null,
  p_device text default null,
  p_limit int default 20
)
returns table (page text, exits bigint)
language sql
stable
as $$
  select s.exit_page::text, count(*)::bigint
  from public.user_sessions s
  where s.started_at >= p_start
    and (p_end is null or s.started_at < p_end)
    and s.exit_page is not null
    and (p_tier is null or s.user_tier = p_tier)
    and (p_device is null or s.device_type = p_device)
    and (
      p_traffic = 'all'
      or (p_traffic = 'human' and s.is_bot is false)
      or (p_traffic = 'bot' and s.is_bot is true)
      or (p_traffic = 'unclassified' and s.is_bot is null)
    )
  group by 1
  order by 2 desc
  limit p_limit;
$$;

-- ── Session duration distribution ───────────────────────────────────────────
--
-- BUCKET BOUNDARIES ARE CHOSEN AROUND TWO ARTIFACTS OF HOW DURATION IS WRITTEN.
--
-- 1. An early heartbeat fires ONCE at exactly 5 seconds, so ~2,050 of ~48,000
--    trailing-30-day sessions sit on the single value 5 — not "about five
--    seconds", exactly 5. A boundary placed AT 5 (the obvious `<5s` / `5-30s`
--    split) dumps that entire spike onto one neighbouring bar and it reads as a
--    real behavioural cluster: either "nobody stayed" or "2,000 people browsed
--    for up to half a minute". Neither is true. `5s` therefore gets its own
--    bucket, with 1-4s below it and 6-29s above it, so the artifact is visible,
--    labelled, and cannot contaminate a neighbour.
--
-- 2. duration_seconds = 0 on ~45,700 sessions (~94%) — these never heartbeated
--    at all, so their duration is UNMEASURED rather than zero-length. The old
--    5-bucket scheme (`<30s | 30s-2m | 2-5m | 5-10m | 10m+`) folded both
--    artifacts plus real short visits into one bar that was ~97% "we never
--    measured this". 0 gets its own bucket for the same reason 5 does.
--
-- Buckets are emitted from a fixed list with a sort key, so every bucket is
-- present (count 0 when empty) and the caller never has to reconstruct order.

create or replace function public.analytics_session_duration_buckets(
  p_start timestamptz,
  p_end timestamptz default null,
  p_traffic text default 'human',
  p_tier text default null,
  p_device text default null
)
returns table (bucket text, bucket_order int, sessions bigint)
language sql
stable
as $$
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
      and (
        p_traffic = 'all'
        or (p_traffic = 'human' and s.is_bot is false)
        or (p_traffic = 'bot' and s.is_bot is true)
        or (p_traffic = 'unclassified' and s.is_bot is null)
      )
  )
  select
    d.bucket::text,
    d.bucket_order,
    count(scoped.secs)::bigint
  from defs d
  left join scoped on scoped.secs between d.lo and d.hi
  group by d.bucket, d.bucket_order
  order by d.bucket_order;
$$;

-- ── Common paths (first three pageviews of a session) ───────────────────────
--
-- Preserves the previous semantics — the first 3 pageviews in created_at order,
-- shorter when the session had fewer — but over every session in the window
-- rather than over whichever 1,000 events came back.

create or replace function public.analytics_common_paths(
  p_start timestamptz,
  p_end timestamptz default null,
  p_traffic text default 'human',
  p_tier text default null,
  p_device text default null,
  p_limit int default 20
)
returns table (path text[], sessions bigint)
language sql
stable
as $$
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
      and (
        p_traffic = 'all'
        or (p_traffic = 'human' and e.is_bot is false)
        or (p_traffic = 'bot' and e.is_bot is true)
        or (p_traffic = 'unclassified' and e.is_bot is null)
      )
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
$$;

-- ── Outbound destinations ───────────────────────────────────────────────────
--
-- Click-time data only. A browser gives the departing page no access to where a
-- navigation lands, so exits by typed URL, bookmark or tab close are
-- unobservable and simply absent — not zero.

create or replace function public.analytics_outbound_destinations(
  p_start timestamptz,
  p_end timestamptz default null,
  p_traffic text default 'human',
  p_tier text default null,
  p_device text default null,
  p_limit int default 25
)
returns table (
  domain text, clicks bigint, sessions bigint, top_url text, from_page text
)
language sql
stable
as $$
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
      and (
        p_traffic = 'all'
        or (p_traffic = 'human' and e.is_bot is false)
        or (p_traffic = 'bot' and e.is_bot is true)
        or (p_traffic = 'unclassified' and e.is_bot is null)
      )
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
$$;

-- Backend calls these with the service role.
grant execute on function public.analytics_navigation_flows(timestamptz, timestamptz, text, text, text, int) to service_role;
grant execute on function public.analytics_journey_landing_pages(timestamptz, timestamptz, text, text, text, int) to service_role;
grant execute on function public.analytics_exit_pages(timestamptz, timestamptz, text, text, text, int) to service_role;
grant execute on function public.analytics_session_duration_buckets(timestamptz, timestamptz, text, text, text) to service_role;
grant execute on function public.analytics_common_paths(timestamptz, timestamptz, text, text, text, int) to service_role;
grant execute on function public.analytics_outbound_destinations(timestamptz, timestamptz, text, text, text, int) to service_role;

-- Lockdown. The applied statement granted service_role but never revoked the
-- PUBLIC default, so anon/authenticated could reach these via /rest/v1/rpc.
revoke all on function public.analytics_navigation_flows(timestamptz, timestamptz, text, text, text, int) from public, anon, authenticated;
grant execute on function public.analytics_navigation_flows(timestamptz, timestamptz, text, text, text, int) to service_role;
revoke all on function public.analytics_journey_landing_pages(timestamptz, timestamptz, text, text, text, int) from public, anon, authenticated;
grant execute on function public.analytics_journey_landing_pages(timestamptz, timestamptz, text, text, text, int) to service_role;
revoke all on function public.analytics_exit_pages(timestamptz, timestamptz, text, text, text, int) from public, anon, authenticated;
grant execute on function public.analytics_exit_pages(timestamptz, timestamptz, text, text, text, int) to service_role;
revoke all on function public.analytics_session_duration_buckets(timestamptz, timestamptz, text, text, text) from public, anon, authenticated;
grant execute on function public.analytics_session_duration_buckets(timestamptz, timestamptz, text, text, text) to service_role;
revoke all on function public.analytics_common_paths(timestamptz, timestamptz, text, text, text, int) from public, anon, authenticated;
grant execute on function public.analytics_common_paths(timestamptz, timestamptz, text, text, text, int) to service_role;
revoke all on function public.analytics_outbound_destinations(timestamptz, timestamptz, text, text, text, int) from public, anon, authenticated;
grant execute on function public.analytics_outbound_destinations(timestamptz, timestamptz, text, text, text, int) to service_role;
