-- Paywall effectiveness, identifying each gate from where the data actually is.
--
-- The panel grouped on `event_label`, which is NULL on every single one of these
-- events, so every row collapsed into one bucket called "unknown". The gate
-- identity was there the whole time, in `properties`:
--
--   properties->>'feature'   'score_breakdown'          the gated capability
--   properties->>'geoLevel'  'county' | 'zip'           the gated granularity
--   properties->>'trigger'   'market_limit_warning'     what raised the prompt
--   properties->>'source'    'paywall'|'modal'|'pricing_page'  where a CTA click came from
--   page_path                '/screener', '/map', …     where it happened
--
-- Resolved in that order: the most specific description of what was withheld
-- wins, falling back to the page. Nothing is labelled "unknown" unless every one
-- of those is absent.
--
-- /dev-paywalls is EXCLUDED. It is a developer harness page and accounts for the
-- large majority of recorded paywall events (14 per variant, versus 1-2 for real
-- gates on /screener and /map). Leaving it in makes a test fixture look like the
-- site's dominant conversion surface.
--
-- CTR is gate views to pricing CTA clicks that name the paywall as their source
-- (`properties->>'source' in ('paywall','modal')`) — a click from /pricing
-- itself is not attributable to a gate and would inflate every rate.
--
-- `conversions` is NOT returned. No event links an upgrade back to the gate that
-- prompted it, and there is no billed upgrade in the data to link. The previous
-- column was initialised to 0 and never incremented, so it rendered "this gate
-- converted nobody" on every row forever, which is a claim rather than a gap.

create or replace function public.analytics_paywall_effectiveness(
  p_start timestamptz,
  p_end timestamptz default null,
  p_traffic text default 'human',
  p_include_dev boolean default false
)
returns table (
  gate text,
  surface text,
  views bigint,
  viewers bigint,
  cta_clicks bigint,
  ctr numeric
)
language sql
stable
as $$
  with scoped as (
    select e.*
    from public.user_events e
    where e.created_at >= p_start
      and (p_end is null or e.created_at < p_end)
      and public.analytics_in_segment(e.is_bot, e.is_internal, p_traffic)
      and (p_include_dev or coalesce(e.page_path, '') <> '/dev-paywalls')
  ),
  gates as (
    select
      coalesce(
        s.properties->>'feature',
        s.properties->>'trigger',
        case when s.properties->>'geoLevel' is not null
             then s.properties->>'geoLevel' || ' granularity' end,
        nullif(s.page_path, ''),
        'unattributed'
      ) as gate,
      coalesce(nullif(s.page_path, ''), 'unknown page') as surface,
      s.visitor_id,
      s.session_id
    from scoped s
    where (s.event_category = 'paywall' and s.event_action = 'view')
       or s.event_action in ('upgrade_prompt_shown', 'market_limit_hit')
  ),
  -- A CTA click is attributed to whatever gate the same session saw. Session
  -- rather than visitor: attributing a click to a gate seen days earlier would
  -- credit the wrong surface.
  clicks as (
    select s.session_id
    from scoped s
    where s.event_action = 'pricing_cta_click'
      and coalesce(s.properties->>'source', '') in ('paywall', 'modal')
  )
  select
    g.gate::text,
    g.surface::text,
    count(*)::bigint,
    count(distinct g.visitor_id)::bigint,
    count(distinct c.session_id)::bigint,
    round(count(distinct c.session_id)::numeric / nullif(count(*), 0), 4)
  from gates g
  left join clicks c on c.session_id = g.session_id
  group by 1, 2
  order by 3 desc;
$$;

revoke all on function public.analytics_paywall_effectiveness(timestamptz, timestamptz, text, boolean) from public, anon, authenticated;
grant execute on function public.analytics_paywall_effectiveness(timestamptz, timestamptz, text, boolean) to service_role;
