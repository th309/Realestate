/**
 * Buy-and-hold-specific grading types — the rubric shape and context inputs
 * that only make sense for residential / small-MF / commercial-MF rentals.
 */
import type { MetricThreshold } from "../shared/types";

export interface GradingContext {
  floodZone?: "AE" | "VE" | "A" | "X" | null;
  floodInsuranceQuoted?: boolean;
  appreciationPlayAccepted?: boolean;
  marketPiqScore?: number; // 0 to 100
}

export interface UserThresholds {
  cashOnCash: MetricThreshold;
  dscr: MetricThreshold;
  cashFlowPerDoor: MetricThreshold;
  capRate: MetricThreshold;
  breakEvenOccupancy: MetricThreshold;
  weights: {
    cashOnCash: number;
    dscr: number;
    cashFlowPerDoor: number;
    capRate: number;
    breakEvenOccupancy: number;
  };
}

/**
 * Upgrade-path engine — given a current deal that grades below a target letter,
 * find the smallest single-lever move that lifts it to the target. Used by the
 * analyzer UI to render "what would it take to get this to a B?" suggestions.
 * Today only applies to buy-and-hold (rental levers).
 */
export type UpgradeLever =
  | "purchasePrice"
  | "monthlyRent"
  | "downPayment"
  | "interestRate";

export interface UpgradePathOption {
  lever: UpgradeLever;
  /** Human-readable action label (e.g. "Negotiate purchase price down"). */
  label: string;
  currentValue: number;
  targetValue: number;
  /** Signed: negative = decrease, positive = increase. Same units as currentValue. */
  delta: number;
  /** Pre-formatted signed delta for display (e.g. "-$18,500", "+$200/mo", "-0.50pp"). */
  formattedDelta: string;
  feasibility: "easy" | "moderate" | "hard";
  unlocksGrade: import("../shared/types").Letter;
}

export interface UpgradePathResult {
  currentGrade: import("../shared/types").Letter;
  targetGrade: import("../shared/types").Letter;
  achievable: boolean;
  options: UpgradePathOption[];
  /** Populated when no single lever reaches the target — suggests a 2-lever combo. */
  combinationHint?: string;
}
