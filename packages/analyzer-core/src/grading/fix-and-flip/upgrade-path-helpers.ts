/**
 * Stateless helpers for the Fix & Flip upgrade-path engine.
 *
 * Calibration is F&F-native, NOT a port of the B&H bands:
 *
 *   purchasePrice — flippers typically negotiate 5-15% below ask on motivated
 *                   inventory. >15% off is REO / wholesale / off-market
 *                   territory (you're hunting a different deal, not fixing
 *                   this one). Bound: -25%.
 *   rehabCost     — better contractor bids routinely trim 5-15% with no scope
 *                   change. 15-30% is value engineering (swap materials, cut
 *                   non-load-bearing changes). >30% is real scope cut and the
 *                   ARV assumption probably no longer holds. Bound: -35%.
 *   arv           — strict-comps research can recover 3-8% when initial comps
 *                   were sloppy. Beyond ~10% you're projecting, not analyzing.
 *                   Bound: +10%.
 *   holdMonths    — disciplined PM saves 0.5-2 months. Beyond that the rehab
 *                   estimate itself was probably already aggressive. Bound:
 *                   -3 months from current.
 *
 * Bounds and bands live here so threshold tuning is a one-file change.
 */
import { LETTER_RANK, type Letter } from "../shared/types";

/**
 * Five F&F operator levers per the Prompt 4 spec.
 *
 *   purchasePrice  — negotiate below ask
 *   arv            — push ARV up via strict comps / better staging
 *   rehabCost      — re-bid / value engineer
 *   holdMonths     — tighten project schedule
 *   financingRate  — buy down rate or switch lender (only when financed)
 */
export type FlipUpgradeLever =
  | "purchasePrice"
  | "arv"
  | "rehabCost"
  | "holdMonths"
  | "financingRate";

export const FLIP_LEVER_LABEL: Record<FlipUpgradeLever, string> = {
  purchasePrice: "Negotiate purchase price down",
  arv: "Improve ARV (better finishes or comps)",
  rehabCost: "Reduce rehab cost",
  holdMonths: "Shorten hold period",
  financingRate: "Get a better financing rate",
};

/**
 * Bounds (max realistic move per lever) — Prompt 4 spec values.
 *   `multiplier` applies to the current value for dollar levers.
 *   `monthsDelta` applies as `max(1, current - delta)` for hold months.
 *   `rateDelta` applies as `current - delta` (in PERCENT units) for rate.
 */
export const FLIP_LEVER_BOUNDS = {
  purchasePrice: { multiplier: 0.7 }, // up to 30% below ask
  arv: { multiplier: 1.1 }, // up to +10% ARV (comps cap)
  rehabCost: { multiplier: 0.75 }, // up to 25% rehab reduction
  holdMonths: { monthsDelta: 4 }, // shave up to 4 months
  financingRate: { rateDelta: 3.0 }, // up to 300 bps better (PERCENT units)
} as const;

/** Smallest meaningful change per lever for the binary search termination. */
export const FLIP_PRECISION: Record<FlipUpgradeLever, number> = {
  purchasePrice: 1, // $1
  arv: 1, // $1
  rehabCost: 1, // $1
  holdMonths: 1, // 1 month (spec)
  financingRate: 0.0001, // 0.01bps in PERCENT units
};

export interface FlipUpgradeOption {
  lever: FlipUpgradeLever;
  label: string;
  currentValue: number;
  targetValue: number;
  delta: number;
  formattedDelta: string;
  feasibility: "easy" | "moderate" | "hard";
  unlocksGrade: Letter;
}

export interface FlipUpgradePathResult {
  currentGrade: Letter;
  targetGrade: Letter;
  achievable: boolean;
  options: FlipUpgradeOption[];
  combinationHint?: string;
}

export const FEASIBILITY_RANK: Record<
  FlipUpgradeOption["feasibility"],
  number
> = {
  easy: 0,
  moderate: 1,
  hard: 2,
};

/** True iff `candidate` letter is at or better than `target`. */
export function meetsTarget(candidate: Letter, target: Letter): boolean {
  return LETTER_RANK[candidate] >= LETTER_RANK[target];
}

/**
 * F&F-calibrated feasibility classifier — Prompt 4 spec bands.
 *
 *   purchasePrice  : <5% rel = easy, 5-15% = moderate, >15% = hard
 *   arv            : <3% rel = easy, 3-7% = moderate, >7% = hard
 *   rehabCost      : <5% rel = easy, 5-15% = moderate, >15% = hard
 *   holdMonths     : abs(Δ) ≤ 1 = easy, ≤ 2 = moderate, else hard
 *   financingRate  : abs(Δ) < 0.005 = easy, < 0.015 = moderate, else hard
 *                    (Δ in PERCENT units; 0.005 → half a basis point of pp)
 */
export function feasibilityFor(
  lever: FlipUpgradeLever,
  delta: number,
  currentValue: number,
): FlipUpgradeOption["feasibility"] {
  if (lever === "holdMonths") {
    const abs = Math.abs(delta);
    if (abs <= 1) return "easy";
    if (abs <= 2) return "moderate";
    return "hard";
  }
  if (lever === "financingRate") {
    const abs = Math.abs(delta);
    if (abs < 0.005) return "easy";
    if (abs < 0.015) return "moderate";
    return "hard";
  }
  const rel = currentValue === 0 ? Infinity : Math.abs(delta / currentValue);
  switch (lever) {
    case "purchasePrice":
    case "rehabCost":
      if (rel < 0.05) return "easy";
      if (rel < 0.15) return "moderate";
      return "hard";
    case "arv":
      if (rel < 0.03) return "easy";
      if (rel < 0.07) return "moderate";
      return "hard";
  }
}

function formatSignedUsd(delta: number): string {
  const sign = delta < 0 ? "-" : "+";
  const abs = Math.abs(delta);
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(abs);
  return `${sign}${formatted}`;
}

/** Pre-format the signed delta for UI display. */
export function formatDeltaFor(lever: FlipUpgradeLever, delta: number): string {
  if (lever === "holdMonths") {
    const sign = delta < 0 ? "-" : "+";
    const months = Math.abs(delta);
    return `${sign}${months.toFixed(0)} mo`;
  }
  if (lever === "financingRate") {
    // PERCENT units → bps. 0.25 pp = 25 bps.
    const sign = delta < 0 ? "-" : "+";
    const bps = Math.abs(delta) * 100;
    return `${sign}${bps.toFixed(0)} bps`;
  }
  return formatSignedUsd(delta);
}

/** Round to nearest readable unit for the combination-hint copy. */
export function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}
