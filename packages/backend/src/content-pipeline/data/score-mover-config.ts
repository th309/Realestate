// packages/backend/src/content-pipeline/data/score-mover-config.ts
/**
 * Single source of truth for the four Score Mover time windows.
 *
 * - `days`    — used to compute the prior score-date target
 * - `label`   — substituted into the script prompt as {{window_label}}
 *               (e.g. "PropertyIQ Score jumped 8 points {{window_label}}")
 * - `caption` — rendered as a small label above the delta in Remotion
 *
 * The label and caption phrasings are deliberately different: scripts speak
 * naturally ("year over year"); on-screen captions read like a chart axis
 * ("Year over year").
 */
export const SCORE_MOVER_WINDOWS = {
  30: { days: 30, label: 'this month', caption: 'Last 30 days' },
  90: { days: 90, label: 'this quarter', caption: 'Last 90 days' },
  180: { days: 180, label: 'over six months', caption: 'Last 6 months' },
  365: { days: 365, label: 'year over year', caption: 'Year over year' },
} as const;

export type ScoreMoverWindowDays = keyof typeof SCORE_MOVER_WINDOWS;

export const SCORE_MOVER_WINDOW_DAYS: ScoreMoverWindowDays[] = [
  30, 90, 180, 365,
];

/**
 * Population floor per geography level. Keeps the leaderboard from
 * surfacing tiny markets whose deltas are statistical noise rather than
 * meaningful score moves. Null population is dropped.
 */
export const POPULATION_FLOOR = {
  metro: 50_000,
  county: 10_000,
  zip: 1_000,
} as const;

export type ScoreMoverGeo = keyof typeof POPULATION_FLOOR;
