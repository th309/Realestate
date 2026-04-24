-- Content pipeline P2 Task 2.1: seed 4 P2 lead magnets + their format bindings.
-- Idempotent via ON CONFLICT (kind) and ON CONFLICT (format, magnet_kind).

INSERT INTO lead_magnet_definitions (kind, display_name, description, audience, template_path, data_method, email_template_key, landing_page_path, enabled)
VALUES
  ('top_50_cashflow_report', 'Top 50 Cashflow Markets Report', '5-page PDF ranking the top 50 cashflow markets in your state.', 'investor',
   'packages/backend/src/content-pipeline/lead-magnets/templates/top_50_cashflow.html.ejs', 'getTopCashflowMarkets',
   'lead-magnet-delivery', '/top-cashflow-report', true),
  ('movers_report', 'Movers and Shakers Monthly Report', '3-page PDF of markets that moved 5+ PIQ points in the last month.', 'investor',
   'packages/backend/src/content-pipeline/lead-magnets/templates/movers_report.html.ejs', 'getTrendingMarkets',
   'lead-magnet-delivery', '/movers-report', true),
  ('market_comparison', '5-Market Deep Comparison', '4-page side-by-side PDF for 5 comparable markets.', 'investor',
   'packages/backend/src/content-pipeline/lead-magnets/templates/market_comparison.html.ejs', 'compareMarketsForContent',
   'lead-magnet-delivery', '/market-comparison', true),
  ('farm_area_audit', 'Farm Area Audit', '6-page PDF with top 20 farm areas in the metro: demographics, turnover, absentee rates.', 'agent',
   'packages/backend/src/content-pipeline/lead-magnets/templates/farm_area_audit.html.ejs', 'getFarmAreaAnalysis',
   'lead-magnet-delivery', '/farm-area-audit', true)
ON CONFLICT (kind) DO NOTHING;

INSERT INTO format_magnet_bindings (format, magnet_kind, cta_text, weight, enabled)
VALUES
  ('top_10_ranking', 'top_50_cashflow_report', 'Get the full Top 50 Cashflow Report at ', 1.0, true),
  ('score_mover', 'movers_report', 'Get the full Movers and Shakers Report at ', 1.0, true),
  ('head_to_head', 'market_comparison', 'Compare 5 markets side-by-side at ', 1.0, true),
  ('farm_area_spotlight', 'farm_area_audit', 'Get your free Farm Area Audit at ', 1.0, true)
ON CONFLICT (format, magnet_kind) DO NOTHING;
