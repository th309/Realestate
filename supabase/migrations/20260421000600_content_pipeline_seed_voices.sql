-- Content pipeline: seed default TTS voice (Edge TTS Andrew Multilingual)
-- Part of P1 foundation per docs/content-pipeline/implementation-plan.md Task 1.7

INSERT INTO tts_voices (id, provider, provider_voice_id, display_name, audience_tag, cost_per_1k_chars, enabled)
VALUES ('edge-andrew', 'edge', 'en-US-AndrewMultilingualNeural', 'Andrew (PropertyIQ default)', 'both', 0, true)
ON CONFLICT (id) DO NOTHING;
