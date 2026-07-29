/**
 * Spoken-duration estimate for a video script, so the operator can see an
 * overflow while typing instead of discovering it after a render.
 *
 * WHY THIS EXISTS
 * The pipeline has no word-count check. `wordBudget` in generate-script.handler
 * is prompt guidance the LLM is asked to respect and nothing verifies. The only
 * hard constraint is measured after synthesis, in enforce-audio-budget.ts:
 *
 *     if (audioDurationMs <= audioBudgetMs) return false;   // else repair, then fail
 *
 * where `audioBudgetMs = (duration_seconds - audio_buffer_seconds) * 1000` and
 * `audioDurationMs` is the probed length of the joined MP3. Exceeding it burns
 * SCRIPT_REPAIR_MAX_REPAIRS LLM repairs and then fails the run outright.
 *
 * WHY WORD COUNT ALONE UNDER-REPORTS
 * The narration is synthesized per segment and re-joined with inserted silence
 * (500ms between paragraphs, 350ms between sentences, 200ms between clauses of
 * a long sentence). That silence is part of the probed MP3, so it counts fully
 * against the budget. A script can sit under its word budget and still overflow
 * on punctuation alone: fifteen short sentences carry ~5.25s of pure pause.
 *
 * WHERE SEGMENTS COME FROM (not wired up yet — see F1a in tasks/todo.md)
 * The authoritative segmenter is `segmentNarration()` in
 * packages/backend/src/content-pipeline/orchestrator/job-handlers/narration-segmenter.ts.
 * It is backend-only today, and its consumer is the audio-synthesis step
 * (synthesize-narration-segmented.ts), NOT the Remotion renderer — synthesis is
 * what inserts the silence that the duration probe then measures.
 *
 * The plan is to relocate that pure function to a subpath of
 * @propertyiq/video-template (alongside ./formats, which the frontend already
 * imports as pure data) so both sides run one implementation and the meter's
 * pause total cannot drift from the pipeline's. A backend endpoint returning
 * segments was rejected: the meter recomputes on every keystroke, so it has to
 * run locally.
 *
 * Until that move lands, nothing in the frontend can produce a real
 * NarrationSegment[]. This module deliberately takes segments as a parameter
 * rather than computing them, so it is correct and testable either way, and the
 * relocation changes only its caller.
 */

import { toSpokenText } from "@propertyiq/video-template/narration";

/** Mirrors NarrationSegment from the shared segmenter. */
export interface NarrationSegmentLike {
  text: string;
  /** Silence inserted after this segment, in milliseconds. */
  breakAfterMs: number;
}

export interface ScriptBudget {
  /** Hard cap: duration_seconds - audio_buffer_seconds, from format_templates. */
  capSeconds: number;
  /** speechSeconds + pauseSeconds. */
  estimatedSeconds: number;
  /** Time spent actually speaking. */
  speechSeconds: number;
  /** Time spent in inserted silence. Deterministic — not an estimate. */
  pauseSeconds: number;
  /** How far past the cap, or 0 when it fits. */
  overBySeconds: number;
  segmentCount: number;
}

/**
 * Split on whitespace. Deliberately naive and shared with the estimator so the
 * count shown to the operator is the count the estimate was built from.
 */
export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

/**
 * Spoken-word cost of a single whitespace token.
 *
 * The blind spot this exists for: a plain word count treats "34.2%" and
 * "$1,240" as one word each, but they are spoken as "thirty four point two
 * percent" and "one thousand two hundred forty dollars" — five and six words of
 * airtime. PropertyIQ scripts are unusually dense with exactly these tokens, so
 * a naive count under-reports worst on the scripts most likely to overflow.
 *
 * The approximation is one spoken word per digit, plus one for each symbol that
 * becomes its own word. It is close across the range that matters:
 *
 *   "34.2%"  -> 3 digits + point + percent    = 5   (actual 5)
 *   "$1,240" -> 4 digits + dollars            = 5   (actual 6)
 *   "2026"   -> 4 digits                      = 4   (actual 3-4)
 *   "$499K"  -> 3 digits + dollars + thousand = 5   (actual 6)
 *
 * It leans slightly optimistic on currency. That is deliberate: the meter
 * reports its own margin rather than hiding padding in here, so the number
 * stays explainable when it disagrees with a real render.
 */
function spokenWordCost(token: string): number {
  // Hyphens and slashes join words that are spoken separately: "3-bed" is two
  // words, "2-bath" two, "buy/hold" two. Split and cost each side.
  if (/[-/]/.test(token) && token.length > 1) {
    const parts = token.split(/[-/]+/).filter(Boolean);
    if (parts.length > 1) {
      return parts.reduce((sum, p) => sum + spokenWordCost(p), 0);
    }
  }

  const digits = (token.match(/\d/g) ?? []).length;
  if (digits === 0) return 1;

  let cost = digits;
  if (token.includes(".")) cost += 1; // "point"
  if (/[$£€]/.test(token)) cost += 1; // "dollars"
  if (token.includes("%")) cost += 1; // "percent"
  if (/\d\s*[KMB]/.test(token)) cost += 1; // "thousand" / "million"
  if (token.includes(":")) cost += 1; // "one to four"
  return Math.max(1, cost);
}

/**
 * Estimate how many seconds it takes to SPEAK these segments, excluding the
 * inserted pauses (which `sumPauseSeconds` accounts for exactly).
 *
 * `naturalWpm` is taken at face value as the format's nominal pace rather than
 * being shaded up or down; the correction that actually matters is per-token
 * (see spokenWordCost), not a blanket multiplier. To retune, change
 * `spokenWordCost` — it is the single lever, and it is unit-testable.
 *
 * @param segments Output of segmentNarration() — already split, already merged.
 * @param naturalWpm format_templates.natural_wpm for this format (default 140).
 */
export function estimateSpeechSeconds(
  segments: NarrationSegmentLike[],
  naturalWpm: number,
): number {
  if (naturalWpm <= 0) {
    throw new Error(`naturalWpm must be positive, received ${naturalWpm}`);
  }
  const spokenWords = segments.reduce((total, segment) => {
    // Cost what the TTS driver will actually read, not what is stored:
    // `{{SHORT_LINK}}` is one token but four spoken words, and it ends nearly
    // every script's call to action.
    const tokens = toSpokenText(segment.text)
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    return total + tokens.reduce((sum, t) => sum + spokenWordCost(t), 0);
  }, 0);
  return (spokenWords / naturalWpm) * 60;
}

/** Deterministic — inserted silence is known exactly, not estimated. */
export function sumPauseSeconds(segments: NarrationSegmentLike[]): number {
  return segments.reduce((total, s) => total + s.breakAfterMs, 0) / 1000;
}

/**
 * Assemble the full budget for the meter. `capSeconds` must be derived the same
 * way the backend does it, or the meter and the pipeline will disagree:
 *
 *     capSeconds = format.duration_seconds - format.audio_buffer_seconds
 */
export function computeScriptBudget(
  segments: NarrationSegmentLike[],
  naturalWpm: number,
  capSeconds: number,
): ScriptBudget {
  const speechSeconds = estimateSpeechSeconds(segments, naturalWpm);
  const pauseSeconds = sumPauseSeconds(segments);
  const estimatedSeconds = speechSeconds + pauseSeconds;
  return {
    capSeconds,
    estimatedSeconds,
    speechSeconds,
    pauseSeconds,
    overBySeconds: Math.max(0, estimatedSeconds - capSeconds),
    segmentCount: segments.length,
  };
}
