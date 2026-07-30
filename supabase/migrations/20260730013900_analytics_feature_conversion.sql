-- "Of the visitors who used this feature, how many signed up?"
--
-- Replaces a panel that compared share-of-converters against
-- share-of-non-converters and produced a signed "signal strength" nobody could
-- read — and which returned [] on every load anyway, because it selected a
-- column that does not exist.
--
-- This framing is directly actionable: analyzer_grade users convert at ~22%
-- against a ~1% site baseline, which is an argument for putting the analyzer in
-- front of more people. The old framing could not say that.
--
-- SAMPLE SIZE IS RETURNED, NOT HIDDEN. The strongest-looking rate in live data
-- comes from a single visitor (screener_market_size, 1 user, 1 signup, 100%).
-- Ranking on rate alone puts that at the top and it means nothing. The caller
-- gets `users` and `converted` so it can order by evidence and mark thin rows
-- rather than the SQL silently applying a cutoff.
--
-- Attribution is per VISITOR over the window, not per session: the feature use
-- and the signup are frequently in different sessions, and requiring them in
-- one would undercount every returning visitor.

create or replace function public.analytics_feature_conversion(
  p_start timestamptz,
  p_end timestamptz default null,
  p_traffic text default 'human',
  p_min_users int default 1
)
returns table (
  feature text,
  users bigint,
  converted bigint,
  conversion_rate numeric,
  baseline_rate numeric,
  lift numeric
)
language sql
stable
as $$
  with scoped_visitors as (
    select distinct s.visitor_id
    from public.user_sessions s
    where s.started_at >= p_start
      and (p_end is null or s.started_at < p_end)
      and public.analytics_in_segment(s.is_bot, s.is_internal, p_traffic)
      and s.visitor_id is not null
  ),
  converters as (
    select distinct e.visitor_id
    from public.user_events e
    join scoped_visitors v on v.visitor_id = e.visitor_id
    where e.event_action = 'signup_complete'
      and e.created_at >= p_start
      and (p_end is null or e.created_at < p_end)
  ),
  baseline as (
    select
      (select count(*) from converters)::numeric
        / nullif((select count(*) from scoped_visitors), 0) as rate
  ),
  -- Deliberate interactions only. Auto-fired telemetry (score_view fires on
  -- every /markets/* render) would otherwise dominate the list while measuring
  -- nothing the visitor chose to do. score_view is kept because a human
  -- reaching a market page IS the top of this funnel, but it is what the
  -- baseline is made of, so its rate should track the baseline closely.
  feature_use as (
    select e.event_action, e.visitor_id
    from public.user_events e
    join scoped_visitors v on v.visitor_id = e.visitor_id
    where e.created_at >= p_start
      and (p_end is null or e.created_at < p_end)
      and e.event_action in (
        'region_select','search','map_filter','analyzer_grade',
        'screener_market_size','report_view','report_export','mcp_connected',
        'score_view','pro_feature_used')
  )
  select
    f.event_action::text,
    count(distinct f.visitor_id)::bigint,
    count(distinct f.visitor_id) filter (where c.visitor_id is not null)::bigint,
    round(count(distinct f.visitor_id) filter (where c.visitor_id is not null)::numeric
          / nullif(count(distinct f.visitor_id), 0), 4),
    round((select rate from baseline), 4),
    -- Multiple of baseline. NULL when there is no baseline to compare against,
    -- rather than a fabricated 0 or an infinity.
    case
      when (select rate from baseline) is null or (select rate from baseline) = 0 then null
      else round(
        (count(distinct f.visitor_id) filter (where c.visitor_id is not null)::numeric
         / nullif(count(distinct f.visitor_id), 0))
        / (select rate from baseline), 2)
    end
  from feature_use f
  left join converters c on c.visitor_id = f.visitor_id
  group by 1
  having count(distinct f.visitor_id) >= greatest(coalesce(p_min_users, 1), 1)
  order by 2 desc;
$$;

revoke all on function public.analytics_feature_conversion(timestamptz, timestamptz, text, int) from public, anon, authenticated;
grant execute on function public.analytics_feature_conversion(timestamptz, timestamptz, text, int) to service_role;
