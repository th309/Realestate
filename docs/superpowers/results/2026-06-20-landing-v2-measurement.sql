-- Landing A/B (variant A = control homepage, B = 8-beat narrative rewrite)
-- Per-variant funnel readout against user_events.
--
-- The variant is stamped into the event `properties` JSONB by the client tracker
-- (lib/analytics/tracker.ts setVariant + the piq-variant cookie fallback), so it
-- is read as `properties->>'variant'` — NOT a top-level column.
--
-- Event-name decomposition: the tracker splits 'category.action' into
-- event_category + event_action. The funnel emits:
--   home.view                 -> event_category='home',       event_action='view'    (pageview, via VariantStamp)
--   cta.click                 -> event_category='cta',        event_action='click'   (PrimaryCta, with a `source`)
--   persona.tab               -> event_category='persona',    event_action='tab'     (persona tab switch)
--   conversion.signup_complete-> event_category='conversion', event_action='signup_complete'
--
-- signup_complete is fired CLIENT-SIDE (auth/sign-up/complete-signup.ts and
-- auth/callback/page.tsx), so the tracker's piq-variant cookie fallback stamps
-- the variant onto it even though it fires after the visitor leaves `/`. The
-- 30-day sticky cookie is set on the homepage visit and read at signup, so the
-- per-variant CONVERSION rate below is real end-to-end.
--
-- VERIFY: confirm the live user_events column names (event_category / event_action
-- / properties) match this (they mirror the tracker's AnalyticsEvent payload).

select
  coalesce(properties->>'variant', '(unstamped)')                                       as variant,
  count(*) filter (where event_category = 'home'       and event_action = 'view')        as visitors,
  count(*) filter (where event_category = 'cta'        and event_action = 'click')       as cta_clicks,
  count(*) filter (where event_category = 'persona'    and event_action = 'tab')         as persona_switches,
  count(*) filter (where event_category = 'conversion' and event_action = 'signup_complete') as conversions,
  round(
    100.0 * count(*) filter (where event_category = 'cta' and event_action = 'click')
    / nullif(count(*) filter (where event_category = 'home' and event_action = 'view'), 0),
    2
  )                                                                                       as cta_ctr_pct,
  round(
    100.0 * count(*) filter (where event_category = 'conversion' and event_action = 'signup_complete')
    / nullif(count(*) filter (where event_category = 'home' and event_action = 'view'), 0),
    2
  )                                                                                       as conversion_rate_pct
from user_events
where created_at >= now() - interval '14 days'
  and properties->>'variant' in ('A', 'B')
group by 1
order by 1;

-- Secondary: CTA breakdown by source (hero / after_score / after_proof / after_persona / close):
-- select properties->>'variant' as variant, properties->>'source' as source, count(*)
-- from user_events
-- where event_category = 'cta' and event_action = 'click'
--   and created_at >= now() - interval '14 days'
-- group by 1, 2 order by 1, 3 desc;
