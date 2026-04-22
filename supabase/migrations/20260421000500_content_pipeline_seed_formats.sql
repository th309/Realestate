-- Content pipeline: seed 8 format_templates, only grade_reveal enabled in P1
-- Part of P1 foundation per docs/content-pipeline/implementation-plan.md Task 1.7

INSERT INTO format_templates (format, display_name, audience, aspect, duration_seconds, default_approval_mode, default_tts_provider, default_tts_voice_id, script_prompt_path, default_platforms, enabled)
VALUES
  ('grade_reveal', 'Grade Reveal', 'mixed', '9x16', 30, 'review', 'edge', 'edge-andrew',
   'packages/backend/src/content-pipeline/prompts/grade_reveal.md',
   ARRAY['youtube_shorts'], true),
  ('top_10_ranking', 'Top 10 Ranking', 'investor', '9x16', 60, 'review', 'edge', 'edge-andrew',
   'packages/backend/src/content-pipeline/prompts/top_10_ranking.md',
   ARRAY['youtube_shorts','tiktok','instagram_reels','facebook_reels'], false),
  ('score_mover', 'Score Mover', 'investor', '9x16', 30, 'review', 'edge', 'edge-andrew',
   'packages/backend/src/content-pipeline/prompts/score_mover.md',
   ARRAY['youtube_shorts','tiktok','instagram_reels','facebook_reels'], false),
  ('head_to_head', 'Head-to-Head', 'investor', '9x16', 60, 'review', 'edge', 'edge-andrew',
   'packages/backend/src/content-pipeline/prompts/head_to_head.md',
   ARRAY['youtube_shorts','tiktok','instagram_reels','facebook_reels'], false),
  ('long_form_deep_dive', 'Long-Form Deep Dive', 'mixed', '16x9', 600, 'review', 'elevenlabs', NULL,
   'packages/backend/src/content-pipeline/prompts/long_form_deep_dive.md',
   ARRAY['youtube_long'], false),
  ('farm_area_spotlight', 'Farm Area Spotlight', 'agent', '9x16', 60, 'review', 'edge', 'edge-andrew',
   'packages/backend/src/content-pipeline/prompts/farm_area_spotlight.md',
   ARRAY['youtube_shorts','tiktok','instagram_reels','facebook_reels','linkedin'], false),
  ('brokerage_market_share', 'Brokerage Market Share', 'broker', '9x16', 75, 'review', 'edge', 'edge-andrew',
   'packages/backend/src/content-pipeline/prompts/brokerage_market_share.md',
   ARRAY['linkedin','youtube_shorts'], false),
  ('recruitment_angle', 'Recruitment Angle', 'broker', '9x16', 90, 'review', 'edge', 'edge-andrew',
   'packages/backend/src/content-pipeline/prompts/recruitment_angle.md',
   ARRAY['linkedin'], false)
ON CONFLICT (format) DO NOTHING;
