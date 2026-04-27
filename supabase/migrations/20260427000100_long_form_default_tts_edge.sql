-- Long-form uses the same TTS stack as other formats (Azure -> Edge -> OpenAI)
-- unless the product later adds an explicit ElevenLabs opt-in. Default was
-- elevenlabs in the P1 seed; we standardize on edge + edge-andrew.

UPDATE format_templates
SET
  default_tts_provider = 'edge',
  default_tts_voice_id = 'edge-andrew'
WHERE format = 'long_form_deep_dive';

-- Queued or future runs that copied the old default
UPDATE content_runs
SET
  tts_provider = 'edge',
  tts_voice_id = 'edge-andrew'
WHERE format = 'long_form_deep_dive'
  AND tts_provider = 'elevenlabs';
