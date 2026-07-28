/**
 * Timing math for segmented narration. Kept in its own module so both the
 * synthesis path (which builds the plan) and the captions path (which replays
 * it against a shadow synthesis) can use it without importing each other.
 */
import { WordTiming } from '../../drivers/tts-driver.interface';
import { NarrationSegment } from './narration-segmenter';

/**
 * Where each segment starts inside the assembled narration, and the segment
 * list it was built from. Word timings captured per segment are only usable
 * against the final audio after being shifted by these offsets.
 */
export interface NarrationSegmentPlan {
  segments: NarrationSegment[];
  offsetsMs: number[];
}

/**
 * Start offset of every segment in the concatenated output: the sum of the
 * preceding segments' audio plus the silence inserted between them. The gap
 * after the final segment is never rendered, so it is ignored.
 */
export function cumulativeSegmentOffsetsMs(
  durationsMs: number[],
  gapsMs: number[],
): number[] {
  const offsets: number[] = [];
  let elapsed = 0;
  for (let i = 0; i < durationsMs.length; i++) {
    offsets.push(elapsed);
    elapsed += durationsMs[i];
    if (i < durationsMs.length - 1) elapsed += gapsMs[i] ?? 0;
  }
  return offsets;
}

export function offsetTimings(
  timings: WordTiming[],
  offsetMs: number,
): WordTiming[] {
  return timings.map((timing) => ({
    word: timing.word,
    startMs: timing.startMs + offsetMs,
    endMs: timing.endMs + offsetMs,
  }));
}
