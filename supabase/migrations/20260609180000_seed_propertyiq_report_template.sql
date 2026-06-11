-- Migration: seed_propertyiq_report_template
--
-- The frontend sends template_slug='propertyiq' for every single-market report
-- (app/reports/page.tsx: markets.length > 1 ? 'comparison' : 'propertyiq'), but
-- no 'propertyiq' row existed in report_templates — only the legacy 'homeready',
-- 'investoredge', plus 'comparison' and 'custom_research'. ReportsService.generateReport
-- throws "Template not found: propertyiq" -> unhandled Error -> HTTP 500. Single-market
-- report generation has been fully broken since the frontend adopted the single
-- PropertyIQ-score model.
--
-- The V2 generator resolves sections/prompts from CODE, not from this JSONB:
-- report-generation-v2.service.ts getSectionsConfig() maps report_type 'propertyiq'
-- to the same HOMEREADY_V2_SECTIONS set, and the score context is built around
-- propertyiq_score. The template row is consumed only for its id (an FK on reports)
-- and the existence guard. So the row just needs to EXIST with a valid config.
--
-- We clone the proven 'homeready' config (which generates reports successfully today)
-- and override the embedded report_type/user_type for hygiene. PropertyIQ is the only
-- live score; homeready/investoredge are legacy and not offered as separate products.
--
-- Idempotent via NOT EXISTS so re-running is a no-op.

INSERT INTO report_templates (
  slug, name, description, icon, version, tier_required, is_active, is_public, config
)
SELECT
  'propertyiq',
  'PropertyIQ Report',
  'Universal market analysis powered by the PropertyIQ Score: market verdict, score deep-dive, affordability, timing, stability, growth outlook, and personalized next steps.',
  'BarChart3',
  2,
  'free',
  true,
  true,
  jsonb_set(
    jsonb_set(config, '{report_type}', '"propertyiq"'),
    '{user_type}', '"universal"'
  )
FROM report_templates
WHERE slug = 'homeready'
  AND NOT EXISTS (SELECT 1 FROM report_templates WHERE slug = 'propertyiq');
