-- Classify historical traffic on evidence, replacing the forward-only default.
--
-- THE RULE (v4). A session is human if ANY of these hold:
--   heartbeat_count > 1      survived past the single early ping
--   duration_seconds > 5     ditto, measured from last_activity_at
--   page_count > 1           navigated
--   user_id is not null      authenticated
--   converted                completed a signup
--   emitted a deliberate-interaction event (allow-list below)
--
-- Three earlier rules were wrong, each caught by measurement:
--   v1 counted `feature_events_count > 0` — but 582 known-bot sessions emit
--      feature.score_view and 550 emit seo.conversion_bar_shown, both of which
--      auto-fire on render, so any crawler hitting /markets/* laundered itself
--      into "human".
--   v2 counted any non-pageview event — re-admitted 32,305 crawler sessions.
--   v3 counted duration_seconds > 0 — the duration histogram spikes to 2,019
--      sessions at EXACTLY 5 seconds (EARLY_HEARTBEAT_MS firing once before the
--      client vanishes) against neighbours of 30-107. Crawlers block on
--      network-idle, which takes longer than 5s, so they trip the early ping
--      too. v3 would have called ~2,019 crawlers human — 70% of its own cohort.
--
-- The load-bearing distinction is auto-fired telemetry vs. deliberate
-- interaction, so the allow-list below is explicit rather than a name pattern:
-- it was derived by reading the complete inventory of 41 (category, action)
-- pairs present in user_events and judging each one. `max_scroll_depth` is NOT
-- used — it is 0 on every row in the table (never written).
--
-- THE DEPLOY BOUNDARY matters as much as the rule. Before the 5s early
-- heartbeat existed, session duration came only from the 30s cadence, so a real
-- visitor who read a page and left inside 30 seconds recorded 0 duration and 1
-- pageview — byte-for-byte identical to a one-shot crawler. Absence of evidence
-- is therefore only meaningful AFTER the ping shipped. Pre-deploy no-evidence
-- rows become NULL (honestly unknown), not true.
--
-- Expected outcome over the trailing 30 days: ~772 human, ~773 bot, ~46,698
-- unclassified, against 48,243 total.

-- ── Revertibility ───────────────────────────────────────────────────────────
-- Restoring is a single join-update from these tables. Kept rather than dropped
-- so the reclassification can be undone without a database restore.

create table if not exists public.user_sessions_isbot_backup_20260729 as
  select session_id, is_bot from public.user_sessions;

create table if not exists public.user_events_isbot_backup_20260729 as
  select id, is_bot from public.user_events;

-- Internal restore artifacts, not application data. Reachable only by the
-- service role: they live in `public` so PostgREST would otherwise expose them,
-- and RLS-with-no-policies makes that fail closed for anon/authenticated.
alter table public.user_sessions_isbot_backup_20260729 enable row level security;
alter table public.user_events_isbot_backup_20260729   enable row level security;

revoke all on public.user_sessions_isbot_backup_20260729 from anon, authenticated;
revoke all on public.user_events_isbot_backup_20260729   from anon, authenticated;

grant all on public.user_sessions_isbot_backup_20260729 to service_role;
grant all on public.user_events_isbot_backup_20260729   to service_role;

-- ── Sessions ────────────────────────────────────────────────────────────────

with deliberate as (
  -- Events a crawler does not produce. Auto-fired telemetry is excluded on
  -- purpose: pageview.view, seo.conversion_bar_shown, feature.score_view,
  -- frustration.error_shown, home.view, home.sticky_bar_shown, ab_test.assigned,
  -- paywall.view, pwa.*_shown, conversion.pricing_page_view,
  -- conversion.upgrade_prompt_shown, conversion.market_limit_hit, trial.expired
  -- and feature.report_view all fire without a human doing anything.
  select distinct session_id
  from public.user_events
  where event_action in (
    -- product interaction
    'region_select', 'search', 'map_filter', 'report_export',
    'screener_market_size', 'analyzer_grade', 'mcp_connected', 'pro_feature_used',
    -- signup funnel (deliberate steps only)
    'signup_start', 'signup_email_engaged', 'signup_oauth_click',
    'signup_submit_blocked', 'signup_submit_error', 'signup_oauth_blocked',
    'signup_oauth_error', 'signup_pending_confirmation', 'signup_otp_attempt',
    'signup_otp_verified', 'signup_otp_failed', 'signup_otp_exhausted',
    'signup_otp_resent', 'signup_otp_resend_failed', 'signup_complete',
    -- pricing + CTAs
    'pricing_cta_click', 'pricing_tier_click', 'cta_click', 'click',
    'conversion_bar_clicked', 'conversion_bar_dismissed', 'score_teaser_click',
    'sticky_bar_dismissed', 'sticky_bar_email_submitted',
    -- onboarding + app install
    'tab', 'quiz_start', 'installed', 'install_banner_dismissed'
  )
),
verdict as (
  select
    s.session_id,
    case
      -- Already classified from a self-identifying User-Agent. A crawler does
      -- not become human later, so this is never revisited.
      when s.is_bot is true then true
      when (
        coalesce(s.heartbeat_count, 0) > 1
        or coalesce(s.duration_seconds, 0) > 5
        or coalesce(s.page_count, 1) > 1
        or s.user_id is not null
        or coalesce(s.converted, false)
        or d.session_id is not null
      ) then false
      -- No evidence, and the early heartbeat was live: absence is now a signal.
      when s.started_at >= timestamptz '2026-07-28 21:59:18+00' then true
      -- No evidence, but the instrument that would have produced it did not
      -- exist yet. Unknowable, and it stays unknown.
      else null
    end as new_is_bot
  from public.user_sessions s
  left join deliberate d on d.session_id = s.session_id
)
update public.user_sessions s
set is_bot = v.new_is_bot
from verdict v
where v.session_id = s.session_id
  and s.is_bot is distinct from v.new_is_bot;

-- ── Events inherit their session's verdict ──────────────────────────────────
-- Events carry no duration or heartbeat of their own, so the session is the
-- only sound source. Denormalised rather than joined because PostgREST cannot
-- express the join and the event panels query this table directly.

update public.user_events e
set is_bot = s.is_bot
from public.user_sessions s
where s.session_id = e.session_id
  and e.is_bot is distinct from s.is_bot;

-- Events whose session row no longer exists (or never did) cannot be judged.
update public.user_events e
set is_bot = null
where e.is_bot is not null
  and not exists (
    select 1 from public.user_sessions s where s.session_id = e.session_id
  );
