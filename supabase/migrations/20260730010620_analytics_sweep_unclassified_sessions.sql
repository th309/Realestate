-- Resolve sessions that never earned a human verdict.
--
-- Ingestion writes `true` (self-identified crawler) or NULL (unknown) and never
-- `false`; `false` is earned by evidence — a second heartbeat, a deliberate
-- interaction, a second pageview, a login, a signup. A session that produces
-- none of that within its lifetime is not "pending", it is a one-shot hit, and
-- leaving it NULL forever grows the unclassified bucket without informing
-- anyone. This closes them out.
--
-- p_older_than_minutes must comfortably exceed a live session. 30 is well past
-- the 30s heartbeat cadence, so an active reader is never swept mid-visit.
--
-- Deliberately does NOT touch `true` — a UA that self-identifies as a crawler
-- is definitive — and does NOT touch `false`, which is already resolved. Only
-- NULL is in scope, which makes the sweep idempotent: a second run in the same
-- window changes zero rows.

create or replace function public.analytics_sweep_unclassified_sessions(
  p_older_than_minutes int default 30
)
returns table (sessions_swept bigint, events_swept bigint)
language plpgsql
as $$
declare
  v_sessions bigint := 0;
  v_events bigint := 0;
  v_cutoff timestamptz := now() - make_interval(mins => p_older_than_minutes);
begin
  with deliberate as (
    select distinct session_id
    from public.user_events
    where event_action in (
      'region_select','search','map_filter','report_export','screener_market_size',
      'analyzer_grade','mcp_connected','pro_feature_used','signup_start',
      'signup_email_engaged','signup_oauth_click','signup_submit_blocked',
      'signup_submit_error','signup_oauth_blocked','signup_oauth_error',
      'signup_pending_confirmation','signup_otp_attempt','signup_otp_verified',
      'signup_otp_failed','signup_otp_exhausted','signup_otp_resent',
      'signup_otp_resend_failed','signup_complete','pricing_cta_click',
      'pricing_tier_click','cta_click','click','conversion_bar_clicked',
      'conversion_bar_dismissed','score_teaser_click','sticky_bar_dismissed',
      'sticky_bar_email_submitted','tab','quiz_start','installed',
      'install_banner_dismissed')
  ),
  swept as (
    update public.user_sessions s
    set is_bot = case
      when coalesce(s.heartbeat_count,0) > 1
        or coalesce(s.duration_seconds,0) > 5
        or coalesce(s.page_count,1) > 1
        or s.user_id is not null
        or coalesce(s.converted,false)
        or exists (select 1 from deliberate d where d.session_id = s.session_id)
      then false
      else true
    end
    where s.is_bot is null
      and s.started_at < v_cutoff
    returning s.session_id
  )
  select count(*) into v_sessions from swept;

  -- Mirror onto events; they carry a denormalised copy because the event panels
  -- query user_events directly and PostgREST cannot express the join.
  with mirrored as (
    update public.user_events e
    set is_bot = s.is_bot
    from public.user_sessions s
    where s.session_id = e.session_id
      and s.started_at < v_cutoff
      and e.is_bot is distinct from s.is_bot
    returning e.id
  )
  select count(*) into v_events from mirrored;

  sessions_swept := v_sessions;
  events_swept := v_events;
  return next;
end;
$$;

grant execute on function public.analytics_sweep_unclassified_sessions(int) to service_role;

-- Lockdown. The applied statement granted service_role but never revoked the
-- PUBLIC default, so anon/authenticated could reach it via /rest/v1/rpc.
revoke all on function public.analytics_sweep_unclassified_sessions(int) from public, anon, authenticated;
grant execute on function public.analytics_sweep_unclassified_sessions(int) to service_role;
