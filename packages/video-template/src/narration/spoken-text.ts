/**
 * Turning stored script text into the text that actually gets spoken.
 *
 * Scripts are stored with `{{SHORT_LINK}}` as a literal template token — the
 * review UI shows the template, and the brand-voice linter judges the template
 * form. Only the audio-bound text gets a concrete phrase, and it is deliberately
 * NOT the compact "propertyiq.app": that spelling makes Edge TTS slur the mark
 * and TLD into one syllable, so the voice path uses a spelled-out form.
 *
 * Shared because two places must agree on it. The synthesis step substitutes it
 * before generating audio whose probed duration is enforced against the format
 * budget; the admin script editor's duration meter has to cost the same words,
 * or it silently under-reports by three words on every script that ends with a
 * call to action — which is essentially all of them.
 */

/** What `{{SHORT_LINK}}` becomes in the voice-over. Four spoken words. */
export const SPOKEN_SHORT_LINK = "Property IQ dot app";

/** What `{{SHORT_LINK}}` becomes in captions and platform post copy. */
export const WRITTEN_SHORT_LINK = "propertyiq.app";

const SHORT_LINK_PATTERN = /\{\{SHORT_LINK\}\}/g;

/**
 * Stored script text -> the text a TTS driver will read aloud.
 *
 * Use this anywhere the QUESTION is "how long will this take to say". For
 * display or written post copy use {@link toWrittenText} instead.
 */
export function toSpokenText(storedText: string): string {
  return storedText.replace(SHORT_LINK_PATTERN, SPOKEN_SHORT_LINK);
}

/** Stored script text -> the form shown to readers and posted to platforms. */
export function toWrittenText(storedText: string): string {
  return storedText.replace(SHORT_LINK_PATTERN, WRITTEN_SHORT_LINK);
}
