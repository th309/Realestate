/**
 * Fix-and-flip-specific grading types — the input shape, context, threshold
 * rubric, and financing taxonomy that only make sense for a flip play.
 *
 * `FixAndFlipInput` extends the lean `FlipInput` from `../../types` (consumed
 * by `computeFlipMetrics`) with the full set of fields needed to grade a deal:
 * purchase price, financing, hold-period operating costs, contingencies, and
 * cash-out-of-pocket. All cost-related fields are optional with defaults
 * applied inside the metric helpers, so callers can stay terse for simple
 * cases and explicit when modeling a real deal.
 */
import type { FlipInput } from "../../types";
import type { MetricThreshold } from "../shared/types";

/**
 * Financing model for the flip.
 *   cash          — paid in full, no loan or interest
 *   conventional  — 20-30y amortizing loan, no points, monthly interest
 *   hard_money    — short-term high-rate loan, often points + interest-only
 *   private       — relationship-based, interest-only, no points
 */
export type FlipFinancingType =
  | "cash"
  | "conventional"
  | "hard_money"
  | "private";

export interface FixAndFlipInput extends FlipInput {
  /** Purchase price ($). The lean FlipInput doesn't include this. */
  price: number;

  // --- Holding period -------------------------------------------------------
  /** Months held between close and resale. Falls back to FlipInput.holdingMonths. */
  holdMonths?: number;

  // --- Acquisition costs ----------------------------------------------------
  /** Closing costs at acquisition as a fraction of price (default 0.02). */
  buyClosingPct?: number;

  // --- Rehab ---------------------------------------------------------------
  /** Fraction of rehabBudget held back as contingency (default 0.10). */
  rehabContingencyPct?: number;
  /**
   * Portion of the rehab budget paid out-of-pocket (rest is rolled into the
   * loan). Only meaningful for hard_money; default = full rehab amount for
   * cash/conventional/private (no rehab-rolled-into-loan there).
   */
  rehabNotFinanced?: number;

  // --- Monthly holding costs ------------------------------------------------
  /**
   * If provided, used verbatim. Otherwise derived from the component fields
   * below (propertyTaxAnnual/12 + insuranceAnnual/12 + utilitiesMonthly +
   * hoaMonthly + monthlyLoanInterest).
   */
  monthlyHoldingCosts?: number;
  propertyTaxAnnual?: number;
  insuranceAnnual?: number;
  utilitiesMonthly?: number;
  hoaMonthly?: number;

  // --- Financing -----------------------------------------------------------
  /** Defaults to 'cash' when unset (no loan, no interest, full price OOP). */
  financingType?: FlipFinancingType;
  /** Loan principal in dollars. Required when financingType !== 'cash'. */
  loanAmount?: number;
  /** Fraction (0.02 = 2 points). Only meaningful for hard_money. */
  points?: number;
  /** Annual rate in PERCENT units (e.g., 12 = 12%). */
  interestRatePct?: number;
  /** If provided, overrides loanAmount × (interestRatePct/100) / 12. */
  monthlyLoanInterest?: number;

  // --- Cash invested ------------------------------------------------------
  /** Down payment (conventional/private). Required for those types. */
  downPayment?: number;
  /** Buyer's closing costs in dollars (computed from price × buyClosingPct if unset). */
  closing?: number;
  /**
   * Optional extra cash needed to fund the hold period out-of-pocket beyond
   * the loan (utilities, taxes, etc., when not reserved in the loan). Default 0.
   */
  holdingCashOutOfPocket?: number;
}

export interface FixAndFlipContext {
  /**
   * How the user verified rehab numbers. 'estimate' is the riskiest;
   * 'itemized_scope' the most trustworthy. Affects the rehab-verified
   * auto-kill check.
   */
  rehabVerification?: "estimate" | "contractor_bid" | "itemized_scope";
  /** User explicitly acknowledged rehab risk despite verification level. */
  rehabRiskAccepted?: boolean;

  /** ARV verification basis — informational; advisory may be added later. */
  arvVerification?: "estimate" | "bpo" | "appraisal" | "strict_comps";

  /** User accepted that hold is materially longer than market DOM. */
  extendedHoldAccepted?: boolean;

  /** Floor on acceptable net profit ($) before auto-kill fires. Default 10000. */
  minimumNetProfit?: number;

  /**
   * MAO compliance threshold — the fraction of ARV that purchase + rehab can
   * NOT exceed. Default 0.70 (the canonical "70% rule"). Lower = more
   * conservative; some markets use 0.75 or even 0.80 for wholetail.
   */
  maxAcquisitionMultiplier?: number;

  /** Market PIQ score (0-100) — drives the strategy-aware market adjustment. */
  marketPiqScore?: number;

  /** Median days on market for this geography — anchors EXTREME_HOLD auto-kill. */
  marketDomDays?: number;

  /**
   * Local market avg financing rate in PERCENT units (e.g., 9). Used by the
   * financing-rate advisory. Falls back to 7 when omitted.
   */
  marketAvgRatePct?: number;
}

/**
 * Five-metric F&F rubric. Mirrors the B&H UserThresholds shape (per-metric
 * MetricThreshold + a weights map) but with F&F-specific metric keys.
 */
export interface FixAndFlipThresholds {
  purchase_margin: MetricThreshold;
  net_profit_margin: MetricThreshold;
  cash_on_cash_roi: MetricThreshold;
  annualized_roi: MetricThreshold;
  net_profit_dollar: MetricThreshold;
  weights: {
    purchase_margin: number;
    net_profit_margin: number;
    cash_on_cash_roi: number;
    annualized_roi: number;
    net_profit_dollar: number;
  };
}
