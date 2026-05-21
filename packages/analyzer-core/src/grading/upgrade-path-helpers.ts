/**
 * Stateless helpers for the upgrade-path engine: lever metadata, dollar/rate
 * formatting, feasibility classification, sort tie-breakers, and rounding.
 * Split out of upgrade-path.ts to keep that file under CLAUDE.md §1.3's
 * 300-line hard limit.
 */
import type { UpgradeLever, UpgradePathOption } from "./buy-and-hold/types";
import { LETTER_RANK, type Letter } from "./shared/types";

export const LEVER_LABEL: Record<UpgradeLever, string> = {
  purchasePrice: "Negotiate purchase price down",
  monthlyRent: "Raise rent (renovate, value-add)",
  downPayment: "Increase down payment",
  interestRate: "Buy down the rate",
};

/** Smallest meaningful change per lever for the binary search termination. */
export const PRECISION: Record<UpgradeLever, number> = {
  purchasePrice: 1, // $1
  monthlyRent: 1, // $1/mo
  downPayment: 1, // $1 of down payment dollars
  interestRate: 0.0001, // 0.01pp (interestRatePct is in PERCENT units → 0.01)
};

/** Per-lever feasibility tier ranks for sort tie-breaking. */
export const FEASIBILITY_RANK: Record<
  UpgradePathOption["feasibility"],
  number
> = {
  easy: 0,
  moderate: 1,
  hard: 2,
};

/** Whole-dollar signed USD formatter (e.g. -$18,500 or +$15,000). */
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

/**
 * True iff `candidate` letter is at or better than `target`.
 * LETTER_RANK assigns A=4, B=3, C=2, D=1, F=0 — HIGHER rank = better letter.
 */
export function meetsTarget(candidate: Letter, target: Letter): boolean {
  return LETTER_RANK[candidate] >= LETTER_RANK[target];
}

/**
 * Feasibility classifier.
 *
 * Dollar levers: judged by relative change |Δ/current|. <5% easy, <15% moderate, else hard.
 *
 * Interest-rate lever: judged by absolute pp change. <0.5pp easy, <1.0pp moderate, else hard.
 *
 * NOTE: the spec originally wrote "<0.005pp easy, <0.010pp moderate" — that's
 * effectively zero rate movement and impossible to hit in practice. Treated as
 * a typo and using 0.5pp / 1.0pp which line up with the 1.5pp search bound.
 */
export function feasibilityFor(
  lever: UpgradeLever,
  delta: number,
  currentValue: number,
): UpgradePathOption["feasibility"] {
  if (lever === "interestRate") {
    const abs = Math.abs(delta);
    if (abs < 0.5) return "easy";
    if (abs < 1.0) return "moderate";
    return "hard";
  }
  const rel = currentValue === 0 ? Infinity : Math.abs(delta / currentValue);
  if (rel < 0.05) return "easy";
  if (rel < 0.15) return "moderate";
  return "hard";
}

/** Pre-format the signed delta for UI display. Lever-aware. */
export function formatDeltaFor(lever: UpgradeLever, delta: number): string {
  if (lever === "monthlyRent") return `${formatSignedUsd(delta)}/mo`;
  if (lever === "interestRate") {
    const sign = delta < 0 ? "-" : "+";
    return `${sign}${Math.abs(delta).toFixed(2)}pp`;
  }
  return formatSignedUsd(delta);
}

/** Round to nearest readable unit for the combination-hint copy. */
export function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}
