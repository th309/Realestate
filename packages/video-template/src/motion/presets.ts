/**
 * PropertyIQ motion vocabulary — the ONLY place spring configs, easing
 * curves, and stagger constants may be defined.
 *
 * Rules (enforced across every composition — see Skills/youtube-production):
 *  - Anything that should feel alive (entrances, counters, dial sweeps,
 *    chart draw-ins) uses `spring()` with a preset from SPRINGS.
 *  - Scripted, non-bouncy motion (camera pans, background shifts, wipes)
 *    uses `interpolate()` with an EASINGS curve. Raw/linear interpolate is
 *    banned for anything visible.
 *  - 2+ sibling elements NEVER animate on the same frame — offset each by
 *    `staggerDelay(index)`.
 */
import { Easing } from "remotion";
import type { SpringConfig } from "remotion";

export const SPRINGS = {
  /**
   * Standard entrance: slight overshoot then settle — the house move.
   * Pair with a 1.05→1.0 scale or a 24px rise (AnimatedEntrance does both).
   */
  entrance: { damping: 14, stiffness: 120, mass: 0.9 },
  /** Large surfaces / panels: settles without visible bounce. */
  gentle: { damping: 22, stiffness: 90, mass: 1 },
  /** Badges, pills, delta chips: energetic pop with a visible settle. */
  pop: { damping: 11, stiffness: 160, mass: 0.8 },
  /** Number counters and the score-dial sweep: heavy, no overshoot. */
  counter: { damping: 26, stiffness: 70, mass: 1.2 },
} as const satisfies Record<string, Partial<SpringConfig>>;

export type SpringPreset = keyof typeof SPRINGS;

export const EASINGS = {
  /** M3 standard — default for scripted moves. */
  standard: Easing.bezier(0.2, 0, 0, 1),
  /** M3 emphasized-decelerate — big scripted reveals, camera settles. */
  emphasized: Easing.bezier(0.05, 0.7, 0.1, 1),
  /** M3 accelerate — exits and wipes leaving the frame. */
  exit: Easing.bezier(0.3, 0, 0.8, 0.15),
} as const;

/** Frames between sibling entrances. 3–5 is the brand band; 4 is default. */
export const STAGGER_FRAMES = 4;

/** Start-frame offset for the index-th sibling in a staggered group. */
export function staggerDelay(index: number, per = STAGGER_FRAMES): number {
  return index * per;
}
