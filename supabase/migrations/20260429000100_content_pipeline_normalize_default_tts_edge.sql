-- Normalize TTS defaults to edge + edge-andrew (Azure → Edge → OpenAI driver chain).
-- Supplements 20260427000100_* (long_form row only); catches any template or run still
-- on elevenlabs after older seeds / environments that skipped prior migrations.

-- Wizard / template defaults
UPDATE format_templates
SET
  default_tts_provider = 'edge',
  default_tts_voice_id = COALESCE(default_tts_voice_id, 'edge-andrew')
WHERE default_tts_provider = 'elevenlabs';

UPDATE format_templates
SET default_tts_voice_id = 'edge-andrew'
WHERE default_tts_voice_id IS NULL
  AND default_tts_provider = 'edge';

-- Runs still storing legacy provider (any format)
UPDATE content_runs
SET
  tts_provider = 'edge',
  tts_voice_id = COALESCE(tts_voice_id, 'edge-andrew')
WHERE tts_provider = 'elevenlabs';
