/**
 * Cross-strategy grading types. These describe the SHAPE of a grading result
 * and the threshold/metric/advisory primitives used by every strategy engine
 * (buy-and-hold, fix-and-flip, brrrr).
 *
 * Strategy-specific types — per-strategy threshold shapes (UserThresholds for
 * B&H, FixAndFlipThresholds for F&F) and per-strategy Context — live under
 * grading/<strategy>/types.ts.
 */

export type Letter = "A" | "B" | "C" | "D" | "F";
export type Strategy = "BUY_AND_HOLD" | "FIX_AND_FLIP" | "BRRRR";

export interface MetricThreshold {
  A: number;
  B: number;
  C: number;
  D: number;
  direction: "higher_is_better" | "lower_is_better";
}

/**
 * Generic UserThresholds — a strategy-specific rubric is a Record<MetricKey,
 * MetricThreshold> plus a Record<MetricKey, number> weights map. Each
 * strategy refines this with its own concrete metric keys (see
 * buy-and-hold/types.ts and fix-and-flip/types.ts).
 */
export type UserThresholdsGeneric<K extends string = string> = Record<
  K,
  MetricThreshold
> & {
  weights: Record<K, number>;
};

export interface MetricResult {
  key: string;
  label: string;
  value: number;
  formattedValue: string;
  grade: Letter;
  gpaPoints: number;
  weight: number;
  contribution: number;
  threshold: MetricThreshold;
}

export interface AdvisoryResult {
  key: string;
  label: string;
  value: number;
  status: "pass" | "marginal" | "fail";
}

export interface AutoKillFlag {
  code: string;
  message: string;
}

export interface DealGradingResult {
  letter: Letter;
  label: string;
  summary: string;
  rawGpa: number;
  marketAdjustment: number;
  finalGpa: number;
  metrics: MetricResult[];
  advisories: AdvisoryResult[];
  autoKills: AutoKillFlag[];
  flooredAt?: Letter;
}

export const LETTER_LABEL: Record<Letter, string> = {
  A: "Strong Buy",
  B: "Buy",
  C: "Hold / Reconsider",
  D: "Avoid",
  F: "Strong Avoid",
};

export const LETTER_RANK: Record<Letter, number> = {
  A: 4,
  B: 3,
  C: 2,
  D: 1,
  F: 0,
};
