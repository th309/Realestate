-- P3: enable long-form + broker formats; seed broker/long-form lead magnets and bindings.
-- ElevenLabs is optional; defaults remain edge per 20260427000100_long_form_default_tts_edge.sql.

INSERT INTO lead_magnet_definitions (
  kind, display_name, description, audience, template_path, data_method,
  email_template_key, landing_page_path, enabled
)
VALUES
  (
    'brokerage_coverage_report',
    'Brokerage Coverage Report',
    'Executive summary of brokerage listing concentration for the selected market.',
    'broker',
    'packages/backend/src/content-pipeline/lead-magnets/templates/brokerage_coverage.html.ejs',
    'getMarketSnapshot',
    'lead-magnet-delivery',
    '/brokerage-coverage',
    true
  ),
  (
    'agent_recruitment_kit',
    'Agent Recruitment Kit',
    'Market snapshot and recruiting angles derived from PropertyIQ data.',
    'broker',
    'packages/backend/src/content-pipeline/lead-magnets/templates/agent_recruitment_kit.html.ejs',
    'getMarketSnapshot',
    'lead-magnet-delivery',
    '/agent-recruitment-kit',
    true
  ),
  (
    'long_form_companion',
    'Long-Form Companion',
    'Written companion summary for long-form deep dive viewers.',
    'mixed',
    'packages/backend/src/content-pipeline/lead-magnets/templates/long_form_companion.html.ejs',
    'getMarketSnapshot',
    'lead-magnet-delivery',
    '/market-narrative',
    true
  )
ON CONFLICT (kind) DO NOTHING;

INSERT INTO format_magnet_bindings (format, magnet_kind, cta_text, weight, enabled)
VALUES
  ('brokerage_market_share', 'brokerage_coverage_report',
   'Get the full Brokerage Coverage Report at ', 1.0, true),
  ('recruitment_angle', 'agent_recruitment_kit',
   'Download the Agent Recruitment Kit at ', 1.0, true),
  ('long_form_deep_dive', 'long_form_companion',
   'Get the written companion at ', 1.0, true)
ON CONFLICT (format, magnet_kind) DO NOTHING;

UPDATE format_templates
SET enabled = true,
    default_tts_provider = 'edge',
    default_tts_voice_id = COALESCE(default_tts_voice_id, 'edge-andrew')
WHERE format IN ('long_form_deep_dive', 'brokerage_market_share', 'recruitment_angle');
