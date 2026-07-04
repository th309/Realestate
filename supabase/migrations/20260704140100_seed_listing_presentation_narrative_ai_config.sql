-- Seed an ai_model_config row for the `listing_presentation_narrative` purpose (tour "aha" AI verdict).
--
-- Previously this purpose had NO ai_model_config row, so AiConfigResolver logged
-- "[listing_presentation_narrative] DB config not usable — falling back to env defaults" and used the
-- env-default deepseek-v4-pro. On large metros that model took ~39.8s, racing the service's narrative
-- timeout and getting discarded → the tour showed "Strategic synthesis … is temporarily unavailable".
-- Routing this purpose to the faster deepseek-v4-flash (like report_narrative_comparison) keeps it well
-- under the timeout. Paired with a code change raising AI_TIMEOUT_MS 40s -> 52s.
-- Beta-test finding F7 (P2), 2026-07-04.
-- Idempotent: only inserts when the purpose row is absent.

INSERT INTO ai_model_config (id, purpose, label, provider, model, is_active, temperature, notes, created_at, updated_at)
SELECT gen_random_uuid(), 'listing_presentation_narrative',
  'Listing Presentation Narrative (tour aha)', 'deepseek', 'deepseek-v4-flash',
  true, 0.7,
  'Tour listing-presentation AI verdict/strategy. Routed to flash for faster generation so it completes under the narrative timeout (F7 fix; previously fell back to env-default deepseek-v4-pro and raced the 40s timeout).',
  now(), now()
WHERE NOT EXISTS (SELECT 1 FROM ai_model_config WHERE purpose = 'listing_presentation_narrative');
