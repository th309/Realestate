-- Landing A/B (variant A = control homepage, B = 8-beat narrative rewrite)
-- Per-variant funnel readout against user_events.
--
-- The variant is stamped into the event `properties` JSONB by the client tracker
-- (lib/analytics/tracker.ts setVariant + the piq-variant cookie fallback), so it
-- is read as `properties->>'variant'` — NOT a top-level column.
--
-- Event-name decomposition: the tracker splits 'category.action' into
-- event_category + event_action (event_name = the action). The landing emits:
--   home.view     -> event_category='home',    event_action='view'   (pageview, via VariantStamp)
--   cta.click     -> event_category='cta',     event_action='click'  (PrimaryCta, with a `source`)
--   persona.tab   -> event_category='persona', event_action='tab'    (persona tab switch)
--
-- VERIFY BEFORE RELYING ON THIS: confirm the live user_events column names
-- (event_category / event_action / properties) and the real signup-completion
-- event. signup is tracked SERVER-SIDE and does NOT yet carry `variant`
-- (follow-up: propagate the piq-variant cookie to the backend signup tracking),
-- so the conversions column below is a placeholder until that lands.

select
  coalesce(properties->>'variant', '(unstamped)')                                  as variant,
  count(*) filter (where event_category = 'home'    and event_action = 'view')      as visitors,
  count(*) filter (where event_category = 'cta'     and event_action = 'click')     as cta_clicks,
  count(*) filter (where event_category = 'persona' and event_action = 'tab')       as persona_switches,
  round(
    100.0 * count(*) filter (where event_category = 'cta' and event_action = 'click')
    / nullif(count(*) filter (where event_category = 'home' and event_action = 'view'), 0),
    2
  )                                                                                  as cta_ctr_pct
from user_events
where created_at >= now() - interval '14 days'
  and properties->>'variant' in ('A', 'B')
group by 1
order by 1;

-- Secondary CTA breakdown by source (hero / after_score / after_proof / after_persona / close):
-- select properties->>'variant' as variant, properties->>'source' as source, count(*)
-- from user_events
-- where event_category = 'cta' and event_action = 'click'
--   and created_at >= now() - interval '14 days'
-- group by 1, 2 order by 1, 3 desc;
