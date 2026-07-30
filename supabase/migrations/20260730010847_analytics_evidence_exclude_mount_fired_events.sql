-- Drop `signup_start` and `quiz_start` from the human-evidence allow-list.
--
-- Both fire from mount effects, not from anything the visitor does:
--   signup_start  — app/(app)/auth/sign-up/page.tsx, a useEffect(..., []) that
--                   records the form being SHOWN, before any input.
--   quiz_start    — app/(app)/onboarding/hooks/useQuiz.ts, likewise on mount.
--
-- So any JS-executing client that merely loaded /auth/sign-up or the onboarding
-- page satisfied the rule on its very first batch and was promoted to human —
-- precisely the contamination this classification exists to prevent. 70 sessions
-- had been promoted on that basis alone and are corrected below.
--
-- The deliberate counterpart of signup_start is signup_email_engaged (first
-- touch of a credential field), which is already on the list.

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
  -- Absence of evidence only means something AFTER the 5s early heartbeat
  -- shipped. Before it, a real visitor leaving inside the 30s cadence recorded
  -- zero duration and one pageview — identical to a crawler. Pre-deploy rows
  -- therefore stay NULL forever rather than being guessed at.
  v_early_heartbeat_live constant timestamptz := timestamptz '2026-07-28 21:59:18+00';
begin
  with deliberate as (
    select distinct session_id
    from public.user_events
    where event_action in (
      'region_select','search','map_filter','report_export','screener_market_size',
      'analyzer_grade','mcp_connected','pro_feature_used',
      'signup_email_engaged','signup_oauth_click','signup_submit_blocked',
      'signup_submit_error','signup_oauth_blocked','signup_oauth_error',
      'signup_pending_confirmation','signup_otp_attempt','signup_otp_verified',
      'signup_otp_failed','signup_otp_exhausted','signup_otp_resent',
      'signup_otp_resend_failed','signup_complete','pricing_cta_click',
      'pricing_tier_click','cta_click','click','conversion_bar_clicked',
      'conversion_bar_dismissed','score_teaser_click','sticky_bar_dismissed',
      'sticky_bar_email_submitted','tab','installed','install_banner_dismissed')
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
      -- Never resolve a pre-instrumentation session; it is unknowable.
      and s.started_at >= v_early_heartbeat_live
    returning s.session_id
  )
  select count(*) into v_sessions from swept;

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
