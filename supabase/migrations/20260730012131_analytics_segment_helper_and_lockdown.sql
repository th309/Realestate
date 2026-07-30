-- One definition of "is this row in the requested segment", plus the EXECUTE
-- lockdown the earlier analytics migrations omitted.
--
-- SECURITY: Postgres grants EXECUTE to PUBLIC on every function at creation,
-- and this database has no ALTER DEFAULT PRIVILEGES revoking it (only tables and
-- sequences get default handling). The analytics aggregates therefore shipped
-- callable by `anon` and `authenticated` through /rest/v1/rpc/<fn> — exposing
-- traffic totals, landing-page performance, conversion rates and per-visitor
-- journeys to unauthenticated callers. The sibling retention and sweep
-- migrations revoked correctly; these did not. Revoked wholesale below rather
-- than per-function, so a future analytics_* function cannot miss it by being
-- added to the wrong file.

create or replace function public.analytics_in_segment(
  p_is_bot boolean,
  p_is_internal boolean,
  p_traffic text
)
returns boolean
language sql
immutable
parallel safe
as $$
  select case p_traffic
    when 'all'          then true
    when 'internal'     then coalesce(p_is_internal, false)
    when 'human'        then p_is_bot is false and not coalesce(p_is_internal, false)
    when 'bot'          then p_is_bot is true  and not coalesce(p_is_internal, false)
    when 'unclassified' then p_is_bot is null  and not coalesce(p_is_internal, false)
    else false
  end;
$$;

-- Return type gains the internal bucket, so it must be dropped first.
drop function if exists public.analytics_traffic_segments(timestamptz, timestamptz);

create function public.analytics_traffic_segments(
  p_start timestamptz, p_end timestamptz default null)
returns table (human bigint, bot bigint, unclassified bigint, internal bigint, total bigint)
language sql stable as $$
  select
    count(*) filter (where is_bot is false and not is_internal)::bigint,
    count(*) filter (where is_bot is true  and not is_internal)::bigint,
    count(*) filter (where is_bot is null  and not is_internal)::bigint,
    count(*) filter (where is_internal)::bigint,
    count(*)::bigint
  from public.user_sessions
  where started_at >= p_start and (p_end is null or started_at < p_end);
$$;

-- Revoke PUBLIC execute on every analytics_* function and re-grant only to the
-- service role the backend authenticates as. Generated rather than listed, so
-- it cannot fall out of sync with the set of functions that actually exist.
do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure::text as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname like 'analytics\_%'
  loop
    execute format('revoke all on function %s from public', fn.sig);
    execute format('revoke all on function %s from anon', fn.sig);
    execute format('revoke all on function %s from authenticated', fn.sig);
    execute format('grant execute on function %s to service_role', fn.sig);
  end loop;
end
$$;
