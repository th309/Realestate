/**
 * User-tunable formula assumptions. Each field has a textbook default and can
 * be overridden from the Advanced Assumptions section in InputPanel.
 *
 * Why expose these:
 *   - Tax/depreciation outputs swing 10–30% by marginal rate alone
 *   - Appreciation/rent-growth assumptions dominate 30-year projection slope
 *   - Flip+BRRRR profit math is brittle without explicit holding/selling/refi inputs
 */
export interface AnalyzerAssumptions {
  /** Marginal income tax bracket. Default 0.24 (24%). */
  marginalTaxRate: number;
  /** Land-vs-building split for IRS 27.5y depreciation. Default 0.25. */
  landValuePct: number;
  /** Annual property appreciation. Default 0.03. */
  appreciationPct: number;
  /** Annual rent growth. Default 0.03. */
  rentGrowthPct: number;
  /** Annual operating-expense growth. Default 0.025. */
  expenseGrowthPct: number;
  /** Flip: months held before sale. Default 4. */
  holdingMonths: number;
  /** Flip: selling costs as % of ARV. Default 0.07. */
  sellingCostsPct: number;
  /** BRRRR: cash-out refi LTV cap. Default 0.75. */
  refinanceLTVPct: number;
  /** BRRRR: seasoning period before refi. Default 6 months. */
  seasoningMonths: number;
  /** BRRRR: rehab phase length. Default 3 months. */
  rehabMonths: number;
  /** BRRRR: lease-up phase length. Default 1 month. */
  leaseMonths: number;
  /** Commercial MF: market cap rate (% e.g. 7.0). Drives implied valuation. */
  marketCapRatePct: number;
  /** Commercial MF: lender's minimum DSCR. Caps the loan when binding. */
  targetDSCR: number;
  /** Commercial MF: annual capex reserve per unit ($). Adds to opex. */
  capexReserveAnnualPerUnit: number;
  /** Commercial MF: amortization period (years). Term in financing slider is the balloon date. */
  amortizationYears: number;
}

export const DEFAULT_ASSUMPTIONS: AnalyzerAssumptions = {
  marginalTaxRate: 0.24,
  landValuePct: 0.25,
  appreciationPct: 0.03,
  rentGrowthPct: 0.03,
  expenseGrowthPct: 0.025,
  holdingMonths: 4,
  sellingCostsPct: 0.07,
  refinanceLTVPct: 0.75,
  seasoningMonths: 6,
  rehabMonths: 3,
  leaseMonths: 1,
  marketCapRatePct: 7.0,
  targetDSCR: 1.25,
  capexReserveAnnualPerUnit: 300,
  amortizationYears: 30,
};
