-- Sequential funnel evaluation in SQL, plus repointing the saved funnels.
--
-- funnel-engine.service.ts previously fetched user_events into Node with no bot
-- filter, no ORDER BY and no `.range()`. PostgREST caps such a fetch at 1,000
-- rows, so every saved funnel was evaluated against an arbitrary 1,000 of
-- ~127,000 events and counted crawler visitors as participants. Its query error
-- was also destructured away, so a failure produced an all-zero funnel
-- indistinguishable from an honest one.
--
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
