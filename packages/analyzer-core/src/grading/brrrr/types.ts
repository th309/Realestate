/**
 * BRRRR-specific grading types — input, context, threshold rubric.
 *
 * BRRRR (Buy, Rehab, Rent, Refinance, Repeat) has two distinct financial
 * phases the grading engine must reason about:
 *
 *   1. ACQUISITION: like a flip — purchase, contingency-adjusted rehab,
 *      hold-period carry, optional hard-money points + interest.
 *   2. REFINANCE + POST-REFI HOLD: like a rental — cash-out at refi against
 *      ARV, new amortizing loan, monthly rent supporting post-refi DSCR.
 *
 * The grading metrics combine both phases (e.g. all-in-to-ARV ratio uses
 * acquisition costs; post-refi DSCR uses rental cash flow), so the input
 * shape carries fields from both halves.
 *
 * Named `BrrrrGradingInput` (not `BrrrrInput`) to avoid colliding with the
 * legacy `BrrrrInput` in `../../types.ts` used by `computeBrrrrScore`.
 */

/** How the property is financed during the rehab/season phase, pre-refi. */
export type BrrrrInitialFinancingType = "cash" | "hard_money";

export interface BrrrrGradingInput {
  // ---- Acquisition phase --------------------------------------------------
  /** Purchase price ($). */
  purchasePrice: number;
  /** After-Repair Value used both for refi appraisal AND the all-in ratio. */
  arv: number;
  /** Rehab budget in dollars (excluding contingency). */
  rehabCost: number;
  /** Contingency as a fraction of rehab (default 0.10 = 10%). */
  rehabContingencyPct?: number;
  /** Buyer-side closing costs as fraction of purchase (default 0.03). */
  buyClosingPct?: number;
  /** Months between close and refi event (rehab + season). */
  holdMonthsBeforeRefi: number;

  // ---- Initial financing --------------------------------------------------
  initialFinancingType: BrrrrInitialFinancingType;
  /** Hard-money loan principal ($). Required when type=hard_money. */
  hardMoneyLoanAmount?: number;
  /** Hard-money rate in PERCENT units (12 = 12%). */
  hardMoneyRate?: number;
  /** Points as fraction (0.02 = 2 points). */
  hardMoneyPoints?: number;
  /** Portion of rehab the borrower funds OOP (not financed by hard money). */
  rehabNotFinanced?: number;
  /** Cash reserved for monthly carry during the hold ($). Default 0. */
  holdingCashOutOfPocket?: number;
  /** Interest paid OOP (rather than capitalized). Default 0. */
  interestPaidOutOfPocket?: number;

  // ---- Property carry (operating during hold + post-refi) ----------------
  propertyTaxAnnual: number;
  insuranceAnnual: number;
  utilitiesMonthly?: number;
  hoaMonthly?: number;

  // ---- Refinance event ---------------------------------------------------
  /** New loan as a fraction of ARV (default 0.75; lender-capped at 0.80). */
  refiLtvPct: number;
  /** Refi rate in PERCENT units (e.g., 7 = 7%). */
  refiRate: number;
  /** Refi amortization term in years (typically 30). */
  refiTermYears: number;
  /** Refi closing costs as fraction of the new loan amount (default 0.025). */
  refiClosingPct?: number;

  // ---- Post-refi rental --------------------------------------------------
  /** Post-refi monthly rent. Must be > 0 for the grade to be computable. */
  monthlyRent: number;
  /** Vacancy as a fraction of gross rent (default 0.05). */
  vacancyPct?: number;
  /** Maintenance as fraction of gross rent (default 0.08). */
  maintenancePct?: number;
  /** Capex reserve as fraction of gross rent (default 0). */
  capexPct?: number;
  /** Property management as fraction of gross rent (default 0.08). */
  pmPct?: number;

  /** Door count for cash-flow-per-door (default 1). */
  unitCount?: number;
}

export interface BrrrrContext {
  rehabVerification?: "estimate" | "contractor_bid" | "itemized_scope";
  rehabRiskAccepted?: boolean;
  arvVerification?: "estimate" | "bpo" | "appraisal" | "strict_comps";
  rentEstimateSource?: "estimate" | "rentcast" | "signed_lease";
  /** Allow REFI_NOT_FINANCEABLE / NEGATIVE_POST_REFI_CASHFLOW to NOT auto-kill. */
  negativeCashFlowAccepted?: boolean;
  /** Allow CASH_LEFT_EXCEEDS_MAXIMUM to NOT auto-kill (capital trapping is OK). */
  capitalTrappingAccepted?: boolean;
  /** Max cash left in deal $ floor before auto-kill (default 10000). */
  maximumCashToLeave?: number;
  marketPiqScore?: number;
  marketDomDays?: number;
}

/**
 * Five-metric BRRRR rubric. Same shape as B&H/F&F thresholds — per-metric
 * threshold + weights record summing to 100.
 */
export interface BrrrrThresholds {
  cash_left_in_deal: import("../shared/types").MetricThreshold;
  all_in_to_arv_ratio: import("../shared/types").MetricThreshold;
  post_refi_dscr: import("../shared/types").MetricThreshold;
  post_refi_cash_flow_per_door: import("../shared/types").MetricThreshold;
  time_to_refinance_months: import("../shared/types").MetricThreshold;
  weights: {
    cash_left_in_deal: number;
    all_in_to_arv_ratio: number;
    post_refi_dscr: number;
    post_refi_cash_flow_per_door: number;
    time_to_refinance_months: number;
  };
}
