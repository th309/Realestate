-- Content pipeline: seed P1 lead magnet (Market Snapshot PDF) and grade_reveal binding
-- Part of P1 foundation per docs/content-pipeline/implementation-plan.md Task 1.7

INSERT INTO lead_magnet_definitions (kind, display_name, description, audience, template_path, data_method, email_template_key, landing_page_path, enabled)
VALUES (
  'market_snapshot_pdf',
  'Market Snapshot Report',
  'One-page PDF with PropertyIQ Score, home value trend, and key market metrics.',
  'mixed',
  'packages/backend/src/content-pipeline/lead-magnets/templates/market_snapshot.html.ejs',
  'getMarketSnapshot',
  'lead-magnet-delivery',
  '/grade-reveal-signup',
  true
)
ON CONFLICT (kind) DO NOTHING;

INSERT INTO format_magnet_bindings (format, magnet_kind, cta_text, weight, enabled)
VALUES (
  'grade_reveal',
  'market_snapshot_pdf',
  'Get your free Market Snapshot for any metro at ',
  1.0,
  true
)
ON CONFLICT (format, magnet_kind) DO NOTHING;
