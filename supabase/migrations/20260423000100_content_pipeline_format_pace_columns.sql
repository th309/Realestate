-- Per-format pacing controls for the content pipeline's script generator
-- and audio synthesis guardrail. Each format picks its own natural words-
-- per-minute target and the buffer the voice-over must leave at the end of
-- the video (for outro / CTA card to land without being run over).
--
-- Reads:
--   - generate-script.handler: uses both to compute word_budget and pass
--     duration_seconds / audio_budget into the Anthropic prompt so Claude
--     writes a script that naturally fits the format.
--   - synthesize-audio.handler: uses audio_buffer_seconds to compute the
--     hard cap enforced post-synthesis.

ALTER TABLE format_templates
  ADD COLUMN natural_wpm SMALLINT NOT NULL DEFAULT 140
    CHECK (natural_wpm BETWEEN 60 AND 250),
  ADD COLUMN audio_buffer_seconds SMALLINT NOT NULL DEFAULT 2
    CHECK (audio_buffer_seconds >= 0);

COMMENT ON COLUMN format_templates.natural_wpm IS
  'Target words-per-minute for natural, unhurried delivery. 140 is broadcast-natural (not rushed); raise for a faster read, lower for a more leisurely one.';
COMMENT ON COLUMN format_templates.audio_buffer_seconds IS
  'Seconds the voice-over must finish before the video ends, leaving room for the outro/CTA card to land. audio_budget = duration_seconds - audio_buffer_seconds.';

-- Tune the long-form deep-dive to a slightly slower pace with a longer
-- outro cushion. Other formats keep the 140/2 defaults.
UPDATE format_templates
SET natural_wpm = 135, audio_buffer_seconds = 4
WHERE format = 'long_form_deep_dive';
