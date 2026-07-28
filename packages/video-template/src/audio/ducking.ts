/**
 * Sidechain-style music ducking driven by the narration's word timings.
 *
 * The TTS pipeline delivers per-word timestamps (`captionWords`), so the
 * music volume is computed per frame from where speech actually is — not a
 * flat "music at 10%" bed. Attack starts slightly before a speech region,
 * release recovers smoothly after it, and short inter-word gaps stay
 * ducked so the bed never pumps between words.
 */
import { AUDIO_LEVELS, DUCK } from "./levels";

export interface SpeechRegion {
  startFrame: number;
  endFrame: number;
}

interface WordTimingLike {
  startMs: number;
  endMs: number;
}

/**
 * Merge word timings into contiguous speech regions (frames). Gaps under
 * DUCK.holdMs are speech pauses, not silence — they stay inside a region.
 */
export function buildSpeechRegions(
  words: readonly WordTimingLike[] | undefined,
  fps: number,
  offsetFrames: number,
): SpeechRegion[] {
  if (!words || words.length === 0) return [];
  const regions: SpeechRegion[] = [];
  let start = words[0].startMs;
  let end = words[0].endMs;
  for (let i = 1; i < words.length; i++) {
    const w = words[i];
    if (w.startMs - end <= DUCK.holdMs) {
      end = Math.max(end, w.endMs);
    } else {
      regions.push(toRegion(start, end, fps, offsetFrames));
      start = w.startMs;
      end = w.endMs;
    }
  }
  regions.push(toRegion(start, end, fps, offsetFrames));
  return regions;
}

function toRegion(
  startMs: number,
  endMs: number,
  fps: number,
  offsetFrames: number,
): SpeechRegion {
  return {
    startFrame: offsetFrames + Math.floor((startMs / 1000) * fps),
    endFrame: offsetFrames + Math.ceil((endMs / 1000) * fps),
  };
}

/**
 * Duck amount (0 = full bed, 1 = fully ducked) at a frame: ramps in over
 * DUCK.attackFrames before a region, holds through it, ramps out over
 * DUCK.releaseFrames after. Max across regions wins.
 */
export function duckAmountAt(frame: number, regions: SpeechRegion[]): number {
  let amount = 0;
  for (const r of regions) {
    let a = 0;
    if (frame >= r.startFrame && frame <= r.endFrame) {
      a = 1;
    } else if (frame < r.startFrame) {
      a = 1 - (r.startFrame - frame) / DUCK.attackFrames;
    } else {
      a = 1 - (frame - r.endFrame) / DUCK.releaseFrames;
    }
    if (a > amount) amount = Math.min(1, Math.max(0, a));
    if (amount === 1) break;
  }
  return amount;
}

/** Music bed volume at a frame, given the narration's speech regions. */
export function musicVolumeAt(frame: number, regions: SpeechRegion[]): number {
  const duck = duckAmountAt(frame, regions);
  return (
    AUDIO_LEVELS.musicBed +
    (AUDIO_LEVELS.musicDucked - AUDIO_LEVELS.musicBed) * duck
  );
}
