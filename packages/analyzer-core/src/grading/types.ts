/**
 * Grading-engine contract. Consumes the same `DealInput` shape used by the
 * rental engine in ../types.ts — there is no parallel "flat decimal" contract.
 * Conversions between percent-form fields (e.g., interestRatePct = 7) and the
 * decimal thresholds used here (e.g., cashOnCash A = 0.12) happen inside
 * gradeDeal where the rental result is read.
 */

export type Letter = "A" | "B" | "C" | "D" | "F";
export type Strategy = "BUY_AND_HOLD" | "FIX_AND_FLIP" | "BRRRR";

export interface GradingContext {
  floodZone?: "AE" | "VE" | "A" | "X" | null;
  floodInsuranceQuoted?: boolean;
  appreciationPlayAccepted?: boolean;
  marketPiqScore?: number; // 0 to 100
}

export interface MetricThreshold {
  A: number;
  B: number;
  C: number;
  D: number;
  direction: "higher_is_better" | "lower_is_better";
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

/**
 * Upgrade-path engine — given a current deal that grades below a target letter,
 * find the smallest single-lever move that lifts it to the target. Used by the
 * analyzer UI to render "what would it take to get this to a B?" suggestions.
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
  unlocksGrade: Letter;
}

export interface UpgradePathResult {
  currentGrade: Letter;
  targetGrade: Letter;
  achievable: boolean;
  options: UpgradePathOption[];
  /** Populated when no single lever reaches the target — suggests a 2-lever combo. */
  combinationHint?: string;
}
