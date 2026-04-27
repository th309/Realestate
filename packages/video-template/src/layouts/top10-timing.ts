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
export const BUMPER_FRAMES = 60;
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

const msToFrame = (ms: number): number =>
  AUDIO_OFFSET_FRAMES + Math.round((ms * FPS) / 1000);

export function computeRankingTiming(
  rowCount: number,
  captionWords: ReadonlyArray<CaptionWord> | undefined,
): RankingTiming {
  if (captionWords && captionWords.length > 0) {
    const numberStartsMs = captionWords
      .filter((w) => /^number/i.test(stripPunct(w.word)))
      .map((w) => w.startMs);
    if (numberStartsMs.length >= rowCount) {
      const rowStartFrames = numberStartsMs.slice(0, rowCount).map(msToFrame);
      const lastWordEndMs = captionWords[captionWords.length - 1].endMs;
      const audioEndFrame = msToFrame(lastWordEndMs);
      const hookStartFrame = BUMPER_FRAMES;
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

  const hookStartFrame = BUMPER_FRAMES;
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
