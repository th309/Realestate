/**
 * Stateless helpers for the BRRRR upgrade-path engine.
 *
 * Calibration is BRRRR-native, NOT a port of B&H or F&F bands:
 *
 *   purchasePrice  — same negotiation discipline as F&F. Bound: -25%.
 *   arv            — strict-comps research can recover 3-8%; bound +10%.
 *                    (Refi appraiser sets the actual number — anything more
 *                    than +10% is wishful.)
 *   rehabCost      — better contractor bids trim 5-15%; bound -35%.
 *   refiLtvPct     — going from 70 → 75 → 80% LTV is a product-shopping move.
 *                    >80% LTV is rare on investment refi. Bound: +0.10 LTV
 *                    units (10 pp of LTV).
 *   monthlyRent    — pricing-up via better listing / quality of finish. Bound:
 *                    +15%. (Beyond that you're chasing the market, not
 *                    capturing it.)
 *   holdMonthsBeforeRefi — tighten schedule. Bound: -3 months but floored at 4
 *                    (a hard practical minimum to season).
 *   refiRate       — shop for a better DSCR product. Bound: -1.5pp.
 *
 * Bounds and bands live here so threshold tuning is a one-file change.
 */
import { LETTER_RANK, type Letter } from "../shared/types";

export type BrrrrUpgradeLever =
  | "purchasePrice"
  | "arv"
  | "rehabCost"
  | "refiLtvPct"
  | "monthlyRent"
  | "holdMonthsBeforeRefi"
  | "refiRate";

export const BRRRR_LEVER_LABEL: Record<BrrrrUpgradeLever, string> = {
  purchasePrice: "Negotiate purchase price down",
  arv: "Improve ARV (better finishes or comps)",
  rehabCost: "Reduce rehab cost",
  refiLtvPct: "Get a higher refi LTV",
  monthlyRent: "Push post-refi rent higher",
  holdMonthsBeforeRefi: "Shorten time to refinance",
  refiRate: "Get a better refi rate",
};

/**
 * Bounds (max realistic move per lever).
 *   `multiplier`   applies to the current value for dollar levers.
 *   `monthsDelta`  applies as `max(floor, current - delta)` for hold months.
 *   `ltvDelta`     applies as `min(0.80, current + delta)` for refi LTV.
 *   `rateDelta`    applies as `current - delta` (PERCENT units) for refi rate.
 */
export const BRRRR_LEVER_BOUNDS = {
  purchasePrice: { multiplier: 0.75 }, // -25%
  arv: { multiplier: 1.1 }, // +10%
  rehabCost: { multiplier: 0.65 }, // -35%
  refiLtvPct: { ltvDelta: 0.1, ceiling: 0.8 }, // +10pp of LTV, capped 80%
  monthlyRent: { multiplier: 1.15 }, // +15%
  holdMonthsBeforeRefi: { monthsDelta: 3, floor: 4 }, // -3 mo, floor 4
  refiRate: { rateDelta: 1.5 }, // -150 bps
} as const;

export const BRRRR_PRECISION: Record<BrrrrUpgradeLever, number> = {
  purchasePrice: 1, // $1
  arv: 1, // $1
  rehabCost: 1, // $1
  refiLtvPct: 0.001, // 10 bps of LTV
  monthlyRent: 1, // $1
  holdMonthsBeforeRefi: 1, // 1 month
  refiRate: 0.0001, // ~1 bp in PERCENT units
};

export interface BrrrrUpgradeOption {
  lever: BrrrrUpgradeLever;
  label: string;
  currentValue: number;
  targetValue: number;
  delta: number;
  formattedDelta: string;
  feasibility: "easy" | "moderate" | "hard";
  unlocksGrade: Letter;
}

export interface BrrrrUpgradePathResult {
  currentGrade: Letter;
  targetGrade: Letter;
  achievable: boolean;
  options: BrrrrUpgradeOption[];
  combinationHint?: string;
}

export const FEASIBILITY_RANK: Record<
  BrrrrUpgradeOption["feasibility"],
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
 * BRRRR-calibrated feasibility classifier.
 *
 *   purchasePrice / rehabCost / arv / monthlyRent : relative-magnitude bands
 *   refiLtvPct          : abs(Δ) ≤ 0.025 easy, ≤ 0.05 moderate, else hard
 *                         (2.5pp LTV is a product swap; 5pp is shopping hard)
 *   holdMonthsBeforeRefi: abs(Δ) ≤ 1 easy, ≤ 2 moderate, else hard
 *   refiRate            : abs(Δ) < 0.25 easy, < 0.75 moderate, else hard
 *                         (Δ in PERCENT units; 0.25 = 25 bps)
 */
export function feasibilityFor(
  lever: BrrrrUpgradeLever,
  delta: number,
  currentValue: number,
): BrrrrUpgradeOption["feasibility"] {
  if (lever === "holdMonthsBeforeRefi") {
    const abs = Math.abs(delta);
    if (abs <= 1) return "easy";
    if (abs <= 2) return "moderate";
    return "hard";
  }
  if (lever === "refiRate") {
    const abs = Math.abs(delta);
    if (abs < 0.25) return "easy";
    if (abs < 0.75) return "moderate";
    return "hard";
  }
  if (lever === "refiLtvPct") {
    const abs = Math.abs(delta);
    if (abs <= 0.025) return "easy";
    if (abs <= 0.05) return "moderate";
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
    case "monthlyRent":
      if (rel < 0.03) return "easy";
      if (rel < 0.08) return "moderate";
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
export function formatDeltaFor(
  lever: BrrrrUpgradeLever,
  delta: number,
): string {
  if (lever === "holdMonthsBeforeRefi") {
    const sign = delta < 0 ? "-" : "+";
    return `${sign}${Math.abs(delta).toFixed(0)} mo`;
  }
  if (lever === "refiRate") {
    const sign = delta < 0 ? "-" : "+";
    const bps = Math.abs(delta) * 100;
    return `${sign}${bps.toFixed(0)} bps`;
  }
  if (lever === "refiLtvPct") {
    const sign = delta < 0 ? "-" : "+";
    const pp = Math.abs(delta) * 100;
    return `${sign}${pp.toFixed(1)} pp LTV`;
  }
  return formatSignedUsd(delta);
}

export function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}
