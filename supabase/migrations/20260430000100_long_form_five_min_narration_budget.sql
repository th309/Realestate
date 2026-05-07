-- Long-form deep-dive: 5-minute video (300s) with 4s end buffer for outro/brand.
-- Narration budget = 300 - 4 = 296 seconds (4:56). Matches synthesize-audio and
-- generate-script handlers (duration_seconds - audio_buffer_seconds).

UPDATE format_templates
SET duration_seconds = 300
WHERE format = 'long_form_deep_dive';

COMMENT ON COLUMN format_templates.duration_seconds IS
  'Total rendered video length in seconds. For long_form_deep_dive, 300 (5:00) with audio_buffer_seconds=4 yields 296s max voice-over.';
