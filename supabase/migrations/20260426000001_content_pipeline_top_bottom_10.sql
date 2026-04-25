-- Refresh top_10_ranking display copy and insert bottom_10_ranking format
-- Task A2: top_10_ranking display_name update + bottom_10_ranking insertion (disabled initially)

-- Refresh top_10_ranking card copy (the row already exists from P1 seed)
UPDATE format_templates
SET
  display_name = 'Top 10 Markets',
  enabled      = true
WHERE format = 'top_10_ranking';

-- Insert bottom_10_ranking (idempotent)
INSERT INTO format_templates (
  format,
  display_name,
  audience,
  aspect,
  duration_seconds,
  default_approval_mode,
  default_tts_provider,
  default_tts_voice_id,
  script_prompt_path,
  default_platforms,
  enabled
)
VALUES (
  'bottom_10_ranking',
  'Bottom 10 — Markets to Avoid',
  'investor',
  '9x16',
  60,
  'review',
  'edge',
  'edge-andrew',
  'packages/backend/src/content-pipeline/prompts/bottom_10_ranking.md',
  ARRAY['youtube_shorts', 'tiktok', 'instagram_reels', 'facebook_reels'],
  false
)
ON CONFLICT (format) DO UPDATE SET
  display_name       = EXCLUDED.display_name,
  audience           = EXCLUDED.audience,
  aspect             = EXCLUDED.aspect,
  duration_seconds   = EXCLUDED.duration_seconds,
  default_approval_mode = EXCLUDED.default_approval_mode,
  default_tts_provider = EXCLUDED.default_tts_provider,
  default_tts_voice_id = EXCLUDED.default_tts_voice_id,
  script_prompt_path = EXCLUDED.script_prompt_path,
  default_platforms  = EXCLUDED.default_platforms;

GRANT SELECT, INSERT, UPDATE, DELETE ON format_templates TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON format_templates TO authenticated;
