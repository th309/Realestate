-- Content pipeline P2 Task 2.2: enable the 4 P2 formats already seeded (disabled) by P1.
-- Idempotent: UPDATE on rows that are already enabled=true is a no-op.
-- Note: the script_prompt_path files for these formats are created in P2 Task 2.3;
-- runs created before Task 2.3 lands will fail at the scripting stage. In a
-- single-operator admin system this is acceptable; the apply order in
-- scripts/apply-content-pipeline-migrations.js still places this migration
-- ahead of any prompt-related work, so we accept the brief window.

UPDATE format_templates
SET enabled = true
WHERE format IN ('top_10_ranking', 'score_mover', 'head_to_head', 'farm_area_spotlight');
