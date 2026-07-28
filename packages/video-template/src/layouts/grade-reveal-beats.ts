/**
 * Beat table for the grade-reveal family (grade_reveal ×1,
 * brokerage_market_share ×2.5, recruitment_angle ×3). One source of truth
 * consumed by BOTH the layout (Sequence frames) and the SFX cue builder
 * (audio/sfx-cues.ts) so sound triggers can never drift from the visuals.
 *
 * The bumper is NEVER scaled — a scaled bumper would put the narrator over
 * the logo. Content beats stretch to fill the format's remaining duration.
 *
 * On formats that don't open with a bumper (all vertical short-form), the
 * bumper beat collapses to zero and its frames are handed to the content
 * beats, so the hook lands at frame 0 rather than leaving dead air.
 */
import { BUMPER_FRAMES } from "../constants";

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

/** Content beats after the bumper, in order, at scale 1 (sum = 840). */
const CONTENT: Array<[keyof Omit<GradeRevealBeats, "bumper">, number]> = [
  ["intro", 60],
  ["score", 210],
  ["stats", 240],
  ["outro", 240],
  ["brand", 90],
];

export function buildGradeRevealBeats(
  scale = 1,
  openWithBumper = false,
): GradeRevealBeats {
  const total = Math.round(BASE_TOTAL * scale);
  const bumperFrames = openWithBumper ? BUMPER_FRAMES : 0;
  const contentBase = CONTENT.reduce((sum, [, d]) => sum + d, 0);
  const contentScale = (total - bumperFrames) / contentBase;

  const beats = {
    bumper: { from: 0, duration: bumperFrames },
  } as GradeRevealBeats;

  let cursor = bumperFrames;
  for (const [key, baseDuration] of CONTENT) {
    const duration = Math.round(baseDuration * contentScale);
    beats[key] = { from: cursor, duration };
    cursor += duration;
  }
  // Absorb rounding drift into the final beat so beats end exactly at total.
  beats.brand.duration += total - cursor;
  return beats;
}
