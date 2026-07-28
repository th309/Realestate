/**
 * Caption-aligned timing math for the Top 10 ranking layout.
 *
 * Maps native or transcribed word timings into per-row reveal frames so the
 * hero stage transitions in lockstep with the narrator saying "Number N.".
 * Falls back to even spacing when no caption data is available.
 *
 * Pure functions — no React, no Remotion imports — trivially unit-testable.
 */

export const FPS = 30;
/**
 * Re-exported from constants so the bumper length has exactly ONE
 * definition. Every beat table's "reclaim the bumper's frames" math depends
 * on this matching BrandBumper's real sting length; two copies could drift
 * and silently desync ranking timing from every other format.
 */
export { BUMPER_FRAMES } from "../constants";

/**
 * Rows a ranking composition actually renders. The layout slices to this,
 * so timing and SFX must reason about the same number or the composition's
 * duration stops matching what plays.
 */
export const MAX_RANKING_ROWS = 10;
/**
 * Frames between frame 0 and the first narrated word. Equals the bumper
 * length on bumper'd formats and 0 on vertical short-form (which opens
 * straight on the hook). Row reveals are keyed off narration, so this MUST
 * track the actual narration start or every "Number N" row fires late.
 */
export const AUDIO_OFFSET_FRAMES = 60;
export const BRAND_OUTRO_FRAMES = 90;

const FALLBACK_HOOK_FRAMES = 45;
const FALLBACK_ROW_FRAMES = 105;
const FALLBACK_OUTRO_FRAMES = 60;

export interface RankingTiming {
  hookStartFrame: number;
  hookDurationFrames: number;
  rowStartFrames: number[];
  outroStartFrame: number;
  outroDurationFrames: number;
  /** Frame at which audio ends (and BrandOutroCard takes over). */
  totalFrames: number;
}

export interface CaptionWord {
  word: string;
  startMs: number;
  endMs: number;
}

export function computeRankingTiming(
  rowCount: number,
  captionWords: ReadonlyArray<CaptionWord> | undefined,
  // Required, deliberately: this value must agree across the layout, the
  // composition's calculateMetadata, and the SFX cues. A default let two of
  // those three silently disagree, which would truncate the composition
  // short of its own outro. Making it required turns that into a compile
  // error instead of a rendering bug nobody sees until playback.
  openWithBumper: boolean,
): RankingTiming {
  // Narration (and therefore every row reveal) starts after the sting only
  // when there IS a sting; otherwise at frame 0.
  const audioOffsetFrames = openWithBumper ? AUDIO_OFFSET_FRAMES : 0;
  const msToFrame = (ms: number): number =>
    audioOffsetFrames + Math.round((ms * FPS) / 1000);

  if (captionWords && captionWords.length > 0) {
    const numberStartsMs = captionWords
      .filter((w) => /^number/i.test(stripPunct(w.word)))
      .map((w) => w.startMs);
    if (numberStartsMs.length >= rowCount) {
      const rowStartFrames = numberStartsMs.slice(0, rowCount).map(msToFrame);
      const lastWordEndMs = captionWords[captionWords.length - 1].endMs;
      const audioEndFrame = msToFrame(lastWordEndMs);
      const hookStartFrame = audioOffsetFrames;
      const hookDurationFrames = Math.max(
        1,
        rowStartFrames[0] - hookStartFrame,
      );
      const lastRowGap =
        numberStartsMs[rowCount - 1] -
        numberStartsMs[Math.max(0, rowCount - 2)];
      const outroStartCandidateMs =
        numberStartsMs[rowCount - 1] + Math.max(1500, lastRowGap);
      const outroStartCandidate = msToFrame(outroStartCandidateMs);
      const safeOutroStart = Math.min(outroStartCandidate, audioEndFrame - FPS);
      const outroDurationFrames = Math.max(1, audioEndFrame - safeOutroStart);
      return {
        hookStartFrame,
        hookDurationFrames,
        rowStartFrames,
        outroStartFrame: safeOutroStart,
        outroDurationFrames,
        totalFrames: audioEndFrame,
      };
    }
  }

  const hookStartFrame = audioOffsetFrames;
  const hookDurationFrames = FALLBACK_HOOK_FRAMES;
  const firstRowStart = hookStartFrame + hookDurationFrames;
  const rowStartFrames = Array.from(
    { length: rowCount },
    (_, i) => firstRowStart + i * FALLBACK_ROW_FRAMES,
  );
  const outroStartFrame = firstRowStart + rowCount * FALLBACK_ROW_FRAMES;
  const outroDurationFrames = FALLBACK_OUTRO_FRAMES;
  const totalFrames = outroStartFrame + outroDurationFrames;
  return {
    hookStartFrame,
    hookDurationFrames,
    rowStartFrames,
    outroStartFrame,
    outroDurationFrames,
    totalFrames,
  };
}

export function shortenLabel(label: string): string {
  return label
    .replace(/PropertyIQ Score/i, "PIQ")
    .replace(/Median Days on Market/i, "DOM")
    .replace(/% Sold Above List/i, "ABV LIST")
    .toUpperCase();
}

export function formatAsOf(iso: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(iso);
  if (!m) return iso.toUpperCase();
  const months = [
    "JAN",
    "FEB",
    "MAR",
    "APR",
    "MAY",
    "JUN",
    "JUL",
    "AUG",
    "SEP",
    "OCT",
    "NOV",
    "DEC",
  ];
  const monthIdx = parseInt(m[2], 10) - 1;
  if (monthIdx < 0 || monthIdx > 11) return iso.toUpperCase();
  return `${months[monthIdx]} ${m[1]}`;
}

function stripPunct(word: string): string {
  return word.replace(/[^a-z]/gi, "");
}
