-- Acquisition: sessions per day PER CHANNEL.
--
-- Replaces an in-Node aggregate over `from('user_sessions').select(...)` with no
-- `.range()`: PostgREST caps that at 1,000 rows silently, so the channel-trend
-- chart was drawn from ~2% of a 30-day window's ~48,000 sessions.
--
-- p_traffic: 'human' | 'bot' | 'unclassified' | 'all' — same predicate as
-- analytics_traffic_sources. `human` is is_bot IS FALSE, NOT "not a bot":
-- is_bot is three-state and NULL means never classified.

create or replace function public.analytics_channel_trend(
  p_start timestamptz,
  p_end timestamptz default null,
  p_traffic text default 'human'
)
returns table (day date, entry_type text, sessions bigint)
language sql
stable
as $$
  select
    (s.started_at at time zone 'UTC')::date,
    coalesce(s.entry_type, 'unknown')::text,
    count(*)::bigint
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
  order by 1, 2;
$$;

grant execute on function public.analytics_channel_trend(timestamptz, timestamptz, text) to service_role;

-- Lockdown. The applied statement granted service_role but never revoked the
-- PUBLIC default, so anon/authenticated could reach it via /rest/v1/rpc.
revoke all on function public.analytics_channel_trend(timestamptz, timestamptz, text) from public, anon, authenticated;
grant execute on function public.analytics_channel_trend(timestamptz, timestamptz, text) to service_role;
