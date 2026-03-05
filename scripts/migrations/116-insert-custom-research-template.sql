-- ============================================================================
-- MIGRATION 116: INSERT CUSTOM RESEARCH REPORT TEMPLATE
-- ============================================================================
-- Adds the 'custom_research' template to report_templates for the
-- AI-powered Custom Research Brief feature (Claude tool-use + DeepSeek narrative).
-- ============================================================================

INSERT INTO report_templates (slug, name, description, tier_required, is_active, config)
VALUES (
  'custom_research',
  'Custom Research Brief',
  'AI-powered deep dive on any real estate question',
  'pro',
  true,
  '{"sections": ["executive_summary", "data_analysis", "recent_developments", "outlook", "sources"]}'
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  tier_required = EXCLUDED.tier_required,
  is_active = EXCLUDED.is_active,
  config = EXCLUDED.config,
  updated_at = NOW();
