/**
 * Beat table for the grade-reveal family (grade_reveal ×1,
 * brokerage_market_share ×2.5, recruitment_angle ×3). One source of truth
 * consumed by BOTH the layout (Sequence frames) and the SFX cue builder
 * (audio/sfx-cues.ts) so sound triggers can never drift from the visuals.
 *
 * The bumper is NEVER scaled: narration starts at NARRATION_START_FRAME
 * (60) in every format — that's the backend audio-budget contract
 * (audio_buffer_seconds = 2s = the bumper) — so a scaled bumper would put
 * the narrator over the logo. Content beats stretch to fill the format's
 * remaining duration instead.
 */
import { NARRATION_START_FRAME } from "../constants";

export interface SceneBeat {
  from: number;
  duration: number;
}

export interface GradeRevealBeats {
  bumper: SceneBeat;
  intro: SceneBeat;
  score: SceneBeat;
  stats: SceneBeat;
  outro: SceneBeat;
  brand: SceneBeat;
}

/** Base (scale=1) composition length in frames — grade_reveal's 900. */
const BASE_TOTAL = 900;
const BUMPER_FRAMES = NARRATION_START_FRAME;

/** Content beats after the bumper, in order, at scale 1 (sum = 840). */
const CONTENT: Array<[keyof Omit<GradeRevealBeats, "bumper">, number]> = [
  ["intro", 60],
  ["score", 210],
  ["stats", 240],
  ["outro", 240],
  ["brand", 90],
];

export function buildGradeRevealBeats(scale = 1): GradeRevealBeats {
  const total = Math.round(BASE_TOTAL * scale);
  const contentBase = CONTENT.reduce((sum, [, d]) => sum + d, 0);
  const contentScale = (total - BUMPER_FRAMES) / contentBase;

  const beats = {
    bumper: { from: 0, duration: BUMPER_FRAMES },
  } as GradeRevealBeats;

  let cursor = BUMPER_FRAMES;
  for (const [key, baseDuration] of CONTENT) {
    const duration = Math.round(baseDuration * contentScale);
    beats[key] = { from: cursor, duration };
    cursor += duration;
  }
  // Absorb rounding drift into the final beat so beats end exactly at total.
  beats.brand.duration += total - cursor;
  return beats;
}
