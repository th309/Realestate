-- Server-side retention aggregates, so the Retention tab stops being computed
-- from a truncated array.
--
-- THE BUG THIS REPLACES: every panel on /admin/analytics?tab=retention was
-- derived in Node from `client.from('user_sessions').select(...)` with no
-- `.range()`. PostgREST caps such a request at 1,000 rows. It does not error and
-- does not warn — it returns a well-formed array, and the JS then computes a
-- perfectly correct answer about the wrong population. `detectChurnSignals` was
-- worse than capped: it carried no date predicate at all, so it scanned the
-- whole table and the 1,000 rows it happened to receive were an arbitrary slice
-- of all history.
--
-- Aggregating in SQL removes the failure mode instead of raising the ceiling:
-- there is no array left to truncate.
--
-- ON THE TRAFFIC SEGMENT — these two functions deliberately take no `p_traffic`.
-- Both are scoped to `user_id is not null`, and a crawler never signs in, so
-- there is nothing bot-shaped left to exclude. Applying the segment here would
-- be actively wrong: `is_bot` is NULL on rows written before classification
-- existed, and NULL is its own bucket rather than "probably human" (see
-- traffic-segment.ts), so `p_traffic = 'human'` would silently discard most of
-- the signed-in history. DAU/WAU/MAU is the opposite case — it keys on
-- visitor_id, which is meaningless without bot exclusion, and it already has
-- `p_traffic` via analytics_active_users.

-- ── Cohort retention matrix ─────────────────────────────────────────────────
-- Returns ONE jsonb document rather than a row set, on purpose: PostgREST's
-- 1,000-row cap applies to table-returning RPCs exactly as it does to a table
-- read, and this result is O(cohort_weeks x tiers) — `days` arrives unbounded
-- from the query string, so a multi-year window across several tiers can cross
-- 1,000 rows. A single row cannot be truncated. Shape:
--   [{ tier, cohort_week, cohort_size, weekly_active: [n, n, ...] }]
--
-- `weekly_active[i]` = distinct users from that cohort with a session in
-- [cohort_week + 7i, cohort_week + 7(i+1)) UTC. The caller turns counts into
-- percentages; SQL does not decide presentation.
--
-- p_by_tier splits each cohort by the tier(s) the user was seen on. A user with
-- sessions at two tiers appears under both — matching the previous behaviour,
-- and correct for a curve that asks "how do pro users retain", not "which single
-- bucket does this person belong to".

create or replace function public.analytics_cohort_retention(
  p_start timestamptz,
  p_tier text default null,
  p_weeks int default 12,
  p_by_tier boolean default false
)
returns jsonb
language sql
stable
as $$
  with sess as (
    -- Bots have no user_id, so this predicate is the bot filter.
    select s.user_id, s.user_tier, s.started_at
    from public.user_sessions s
    where s.user_id is not null
      and s.started_at >= p_start
  ),
  tiers as (
    -- A user's tier(s), read off their sessions. `user_tier` is NULL on most
    -- rows; the previous JS dropped falsy tiers from the curve list, so NULL
    -- stays excluded rather than becoming an "unknown" cohort.
    select distinct s.user_id, s.user_tier::text as tier
    from sess s
    where s.user_tier is not null
      and (p_tier is null or s.user_tier = p_tier)
  ),
  cohort_members as (
    select distinct
      vi.user_id,
      date_trunc('week', vi.signup_cohort::timestamp)::date as cohort_week,
      case when p_by_tier then t.tier else '__all__' end as tier
    from public.visitor_identities vi
    left join tiers t on t.user_id = vi.user_id
    where vi.signup_cohort >= (p_start at time zone 'UTC')::date
      -- Unfiltered, every identity is a cohort member whether or not it has
      -- sessions (that is what makes week-0 retention 100% and week-1 a real
      -- fraction). With a tier asked for, membership requires a session at it.
      and (t.tier is not null or (not p_by_tier and p_tier is null))
  ),
  weeks as (
    select generate_series(0, greatest(coalesce(p_weeks, 12), 1) - 1) as week_index
  ),
  grid as (
    select
      c.tier,
      c.cohort_week,
      w.week_index,
      count(distinct s.user_id) as active_users
    from cohort_members c
    cross join weeks w
    left join sess s
      on s.user_id = c.user_id
     and s.started_at >= ((c.cohort_week + (w.week_index * 7))::timestamp at time zone 'UTC')
     and s.started_at <  ((c.cohort_week + ((w.week_index + 1) * 7))::timestamp at time zone 'UTC')
    group by 1, 2, 3
  ),
  sizes as (
    select tier, cohort_week, count(*)::bigint as cohort_size
    from cohort_members
    group by 1, 2
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'tier', r.tier,
        'cohort_week', r.cohort_week,
        'cohort_size', r.cohort_size,
        'weekly_active', r.weekly_active
      )
      order by r.tier, r.cohort_week
    ),
    '[]'::jsonb
  )
  from (
    select
      g.tier,
      g.cohort_week,
      z.cohort_size,
      jsonb_agg(g.active_users order by g.week_index) as weekly_active
    from grid g
    join sizes z on z.tier = g.tier and z.cohort_week = g.cohort_week
    group by g.tier, g.cohort_week, z.cohort_size
  ) r;
$$;

-- ── Churn risk: signed-in users who have gone quiet ─────────────────────────
-- p_start is REQUIRED and is the fix for a bug the row cap was hiding: the old
-- query had no date predicate, so "churn risk" included accounts that stopped
-- appearing years ago. Someone last seen in 2024 is not a signal, they are
-- history. The caller looks back at least a quarter so that a short dashboard
-- window still spans the inactivity threshold.
--
-- `session_count` and `last_seen` are computed over the window, not all time —
-- the number beside the user is "sessions in the period you are looking at",
-- which is the only reading consistent with the date bound.

create or replace function public.analytics_churn_risk_users(
  p_start timestamptz,
  p_inactive_days int default 14,
  p_min_sessions int default 3,
  p_tier text default null,
  p_limit int default 100
)
returns table (
  user_id uuid,
  last_seen timestamptz,
  session_count bigint,
  tier text
)
language sql
stable
as $$
  with scoped as (
    select s.user_id, s.user_tier, s.last_activity_at
    from public.user_sessions s
    where s.user_id is not null
      and s.started_at >= p_start
  ),
  per_user as (
    select
      scoped.user_id,
      max(scoped.last_activity_at) as last_seen,
      count(*)::bigint as session_count,
      -- The tier they were last seen on. The old JS took whichever row happened
      -- to arrive first, which is not defined at all.
      (array_agg(scoped.user_tier order by scoped.last_activity_at desc))[1]::text as tier
    from scoped
    group by scoped.user_id
  )
  select
    per_user.user_id,
    per_user.last_seen,
    per_user.session_count,
    per_user.tier
  from per_user
  where per_user.last_seen < now() - make_interval(days => greatest(coalesce(p_inactive_days, 14), 1))
    and per_user.session_count >= coalesce(p_min_sessions, 3)
    and (p_tier is null or per_user.tier = p_tier)
  -- Most recently gone quiet first: those are the ones still worth a mail.
  order by per_user.last_seen desc
  limit greatest(coalesce(p_limit, 100), 1);
$$;

-- Only the backend calls these. EXECUTE defaults to PUBLIC, and
-- `authenticated_select_user_sessions` grants every logged-in user SELECT over
-- all of user_sessions with `using (true)` — so without this revoke, any signed-
-- in account could call analytics_churn_risk_users and enumerate other users'
-- ids and last-seen times.
revoke execute on function public.analytics_cohort_retention(timestamptz, text, int, boolean) from public;
revoke execute on function public.analytics_churn_risk_users(timestamptz, int, int, text, int) from public;

grant execute on function public.analytics_cohort_retention(timestamptz, text, int, boolean) to service_role;
grant execute on function public.analytics_churn_risk_users(timestamptz, int, int, text, int) to service_role;

-- Lockdown. The applied statement revoked EXECUTE from PUBLIC only; anon and
-- authenticated are named explicitly here so a direct grant to either cannot
-- survive this migration.
revoke all on function public.analytics_cohort_retention(timestamptz, text, int, boolean) from public, anon, authenticated;
grant execute on function public.analytics_cohort_retention(timestamptz, text, int, boolean) to service_role;
revoke all on function public.analytics_churn_risk_users(timestamptz, int, int, text, int) from public, anon, authenticated;
grant execute on function public.analytics_churn_risk_users(timestamptz, int, int, text, int) to service_role;
