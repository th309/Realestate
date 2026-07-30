-- Revisions to the analytics aggregates, plus sequential funnel evaluation.
--
-- 1. Session duration is capped at 1800s for AVERAGING. Duration is
--    last_activity_at - started_at, advanced by a heartbeat that fires every
--    30s while the tab is visible, so a pinned tab records hours. The
--    human-segment mean came out at 2,468s (41 minutes), describing a handful
--    of long-lived tabs rather than a typical visit. The raw column is
--    untouched so the distribution panel keeps its tail.
--
-- 2. analytics_daily_visitors gains pages_per_session, so that KPI's sparkline
--    can plot its own metric. Without it the caller had no per-day page_count
--    and would have had to fabricate the series — the exact defect being
--    removed (all six sparklines previously shared one visitor-count array).
--
-- 3. analytics_sequential_funnel replaces in-Node funnel evaluation.
--    funnel-engine.service.ts fetched user_events with no bot filter, no
--    ORDER BY and no `.range()`, so every saved funnel was evaluated against an
--    arbitrary 1,000 of ~127,000 events and counted crawler visitors as
--    participants; its error was destructured away, so a failure produced an
--    all-zero funnel indistinguishable from an honest one.

create or replace function public.analytics_overview_kpis(
  p_start timestamptz, p_end timestamptz default null, p_traffic text default 'human',
  p_tier text default null, p_device text default null)
returns table (unique_visitors bigint, total_sessions bigint, avg_session_duration numeric,
  bounce_rate numeric, pages_per_session numeric, converted_visitors bigint, conversion_rate numeric)
language sql stable as $$
  with scoped as (
    select s.* from public.user_sessions s
    where s.started_at >= p_start and (p_end is null or s.started_at < p_end)
      and (p_tier is null or s.user_tier = p_tier)
      and (p_device is null or s.device_type = p_device)
      and (p_traffic = 'all'
        or (p_traffic = 'human' and s.is_bot is false)
        or (p_traffic = 'bot' and s.is_bot is true)
        or (p_traffic = 'unclassified' and s.is_bot is null))
  ), conv as (
    select count(distinct e.visitor_id) as n from public.user_events e
    where e.event_action = 'signup_complete' and e.created_at >= p_start
      and (p_end is null or e.created_at < p_end)
      and (p_traffic = 'all'
        or (p_traffic = 'human' and e.is_bot is false)
        or (p_traffic = 'bot' and e.is_bot is true)
        or (p_traffic = 'unclassified' and e.is_bot is null))
  )
  select count(distinct scoped.visitor_id)::bigint, count(*)::bigint,
    round(coalesce(avg(least(coalesce(scoped.duration_seconds,0), 1800)),0)::numeric,1),
    round(coalesce(avg(case when scoped.is_bounce then 1.0 else 0.0 end),0)::numeric,4),
    round(coalesce(avg(coalesce(scoped.page_count,0)),0)::numeric,2),
    (select n from conv)::bigint,
    case when count(distinct scoped.visitor_id)=0 then 0
      else round(((select n from conv)::numeric / count(distinct scoped.visitor_id)),4) end
  from scoped;
$$;

drop function if exists public.analytics_daily_visitors(timestamptz, timestamptz, text, text);

create function public.analytics_daily_visitors(
  p_start timestamptz, p_end timestamptz default null, p_traffic text default 'human',
  p_tier text default null)
returns table (day date, visitors bigint, sessions bigint, avg_duration numeric,
  bounce_rate numeric, pages_per_session numeric)
language sql stable as $$
  select (s.started_at at time zone 'UTC')::date, count(distinct s.visitor_id)::bigint, count(*)::bigint,
    round(coalesce(avg(least(coalesce(s.duration_seconds,0), 1800)),0)::numeric,1),
    round(coalesce(avg(case when s.is_bounce then 1.0 else 0.0 end),0)::numeric,4),
    round(coalesce(avg(coalesce(s.page_count,0)),0)::numeric,2)
  from public.user_sessions s
  where s.started_at >= p_start and (p_end is null or s.started_at < p_end)
    and (p_tier is null or s.user_tier = p_tier)
    and (p_traffic = 'all'
      or (p_traffic = 'human' and s.is_bot is false)
      or (p_traffic = 'bot' and s.is_bot is true)
      or (p_traffic = 'unclassified' and s.is_bot is null))
  group by 1 order by 1;
$$;

-- p_steps: array of steps; each step an array of "category.action" matchers
-- ORed together. Steps intersect sequentially — stage N counts only visitors
-- who also reached every prior stage.
create or replace function public.analytics_sequential_funnel(
  p_start timestamptz,
  p_steps jsonb,
  p_traffic text default 'human'
)
returns table (step_index int, visitors bigint)
language plpgsql
stable
as $$
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
        and (p_traffic = 'all'
          or (p_traffic = 'human' and e.is_bot is false)
          or (p_traffic = 'bot' and e.is_bot is true)
          or (p_traffic = 'unclassified' and e.is_bot is null));
    else
      select array_agg(distinct e.visitor_id) into cur_visitors
      from public.user_events e
      where e.created_at >= p_start
        and (e.event_category || '.' || e.event_action) = any(matchers)
        and e.visitor_id = any(prev_visitors)
        and (p_traffic = 'all'
          or (p_traffic = 'human' and e.is_bot is false)
          or (p_traffic = 'bot' and e.is_bot is true)
          or (p_traffic = 'unclassified' and e.is_bot is null));
    end if;

    prev_visitors := coalesce(cur_visitors, array[]::text[]);
    step_index := i;
    visitors := coalesce(array_length(prev_visitors, 1), 0)::bigint;
    return next;
  end loop;
end;
$$;

grant execute on function public.analytics_overview_kpis(timestamptz, timestamptz, text, text, text) to service_role;
grant execute on function public.analytics_daily_visitors(timestamptz, timestamptz, text, text) to service_role;
grant execute on function public.analytics_sequential_funnel(timestamptz, jsonb, text) to service_role;

-- Repoint saved funnels at events that are actually emitted. persona_selected,
-- spotlight_step_completed, trial.converted, trial_start and upgrade_complete
-- have never fired, so steps referencing them read 0 forever and zeroed every
-- later stage through the sequential intersection.
update public.funnel_definitions
set steps = '[
  {"label":"Landed on site","event_category":"pageview","event_action":"view"},
  {"label":"Clicked a CTA","any_of":[
    {"event_category":"seo","event_action":"conversion_bar_clicked"},
    {"event_category":"hero","event_action":"cta_click"},
    {"event_category":"cta","event_action":"click"},
    {"event_category":"home","event_action":"score_teaser_click"}]},
  {"label":"Opened signup","event_category":"conversion","event_action":"signup_start"},
  {"label":"Engaged a signup path","any_of":[
    {"event_category":"conversion","event_action":"signup_email_engaged"},
    {"event_category":"conversion","event_action":"signup_oauth_click"}]},
  {"label":"Account created","event_category":"conversion","event_action":"signup_complete"},
  {"label":"Used a Pro feature","event_category":"trial","event_action":"pro_feature_used"}
]'::jsonb
where name = 'Activation Funnel';

update public.funnel_definitions
set steps = '[
  {"label":"Opened signup","event_category":"conversion","event_action":"signup_start"},
  {"label":"Code sent","event_category":"conversion","event_action":"signup_pending_confirmation"},
  {"label":"Code verified","event_category":"conversion","event_action":"signup_otp_verified"},
  {"label":"Account created","event_category":"conversion","event_action":"signup_complete"}
]'::jsonb
where name = 'Conversion Funnel';
