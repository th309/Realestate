-- Flip bottom_10_ranking enabled flag after smoke test passes.
-- Companion to 20260426000001_content_pipeline_top_bottom_10.sql which seeded
-- the row with enabled=false (safe default until live smoke confirmed the
-- format renders + publishes correctly).

UPDATE format_templates
SET enabled = true
WHERE format = 'bottom_10_ranking';
