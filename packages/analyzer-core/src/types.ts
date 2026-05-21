/**
 * Property class drives whether we apply residential or commercial underwriting.
 *
 *   "sfh"           — single-family detached. Pure residential.
 *   "small_mf"      — 2–4 units. Still residential under HUD/FHA conventions.
 *                     Math is identical to SFH, but `rentMonthly` is the total
 *                     across all units and the UI typically presents it as
 *                     per-unit × unit count.
 *   "commercial_mf" — 5+ units. Commercial underwriting:
 *                       • Loan is sized as min(LTV-cap, DSCR-cap)
 *                       • Cap-rate-implied valuation (NOI / market cap)
 *                       • Separate amortization vs loan term (balloon)
 *                       • Different default expense/financing assumptions
 */
export type PropertyClass = "sfh" | "small_mf" | "commercial_mf";

export interface FinancingTerms {
  downPaymentPct: number;
  interestRatePct: number;
  /**
   * Loan term — when the loan matures. For residential 30y this also equals
   * the amortization period. For commercial loans with a balloon, set this
   * to the balloon date (e.g., 7) and `amortizationYears` to the amort basis
   * (e.g., 30). Borrower pays 30y-amortized P&I for 7 years, then balloons.
   */
  termYears: number;
  closingCostsPct?: number;
  /**
   * Commercial-loan amortization period. When unset OR equal to termYears,
   * the loan fully amortizes (no balloon). When greater than termYears, the
   * borrower makes amortized payments through termYears, then a balloon
   * payment equal to the remaining balance is due at termYears.
   */
  amortizationYears?: number;
}

export interface DealInput {
  price: number;
  rentMonthly: number | null;
  taxAnnual: number | null;
  insuranceAnnual: number | null;
  hoaMonthly?: number;
  maintenancePctOfRent?: number;
  vacancyPctOfRent?: number;
  managementPctOfRent?: number;
  financing: FinancingTerms;
  /** Defaults to "sfh" when unset (residential behavior — backward compat). */
  propertyClass?: PropertyClass;
  /** Number of units. Required to make commercial math meaningful. */
  unitCount?: number;
  /** Market cap rate (%, e.g., 6.0). Drives cap-rate-implied valuation. */
  marketCapRatePct?: number;
  /** Minimum DSCR the lender will allow. Caps the loan when binding. */
  targetDSCR?: number;
  /** Annual capex reserve per unit (e.g., $300). Adds to opex. */
  capexReserveAnnualPerUnit?: number;
}

export interface RentalResult {
  noiAnnual: number | null;
  capRatePct: number | null;
  cashOnCashPct: number | null;
  dscr: number | null;
  cashflowMonthly: number | null;
  onePctRulePct: number | null;
  totalCashInvested: number;
  monthlyDebtService: number;
  projection?: ProjectionResult;
  sensitivity?: SensitivityResult;
  breakEven?: BreakEvenResult;
  afterTax?: AfterTaxResult;
  /** Commercial-mode outputs. All null/undefined when propertyClass !== "commercial_mf". */
  commercial?: CommercialUnderwriting;
}

export interface CommercialUnderwriting {
  /** NOI ÷ marketCapRatePct. Suggested price at market cap. */
  impliedValueAtMarketCap: number | null;
  /** Max loan allowed by LTV cap = price × (1 − downPaymentPct). */
  maxLtvLoan: number;
  /** Max loan that keeps NOI / annualDS ≥ targetDSCR. */
  maxDscrLoan: number | null;
  /** min(maxLtvLoan, maxDscrLoan). What the lender will actually fund. */
  effectiveLoan: number;
  /** Which constraint was binding ("ltv" | "dscr" | "neither"). */
  bindingConstraint: "ltv" | "dscr" | "neither";
  /** Remaining loan balance at termYears (balloon payment due). */
  balloonBalance: number;
  /** Per-unit annualized capex reserve actually applied. */
  capexReserveAnnual: number;
}

export interface FlipInput {
  arv: number;
  rehabBudget: number;
  holdingMonths?: number;
  sellingCostsPct?: number;
}

export interface FlipResult {
  mao70: number;
  wholetailMax: number;
  projectedProfit: number;
  projectedRoiPct: number;
}

export interface BrrrrInput extends DealInput {
  arv: number;
  rehabBudget: number;
  refinanceLTVPct?: number;
}

export interface BrrrrResult {
  score: number;
  refinanceCashOut: number;
  remainingCashInDeal: number;
  postRefiCashflowMonthly: number;
  rating: "EXCELLENT" | "STRONG" | "OK" | "WEAK" | "POOR";
  timeline?: BrrrrTimelineResult;
  sensitivity?: SensitivityResult;
  postRefiProjection?: ProjectionResult;
}

export interface ProjectionResult {
  yearly: Array<{
    year: number;
    grossRent: number;
    expenses: number;
    cashflow: number;
    principalPaydown: number;
    appreciationGain: number;
    cumulativeEquity: number;
    cumulativeCashflow: number;
    irrToDate: number;
    coCToDate: number;
  }>;
  horizons: {
    y1: { equity: number; irr: number; cashflow: number };
    y3: { equity: number; irr: number; cashflow: number };
    y5: { equity: number; irr: number; cashflow: number };
    y10: { equity: number; irr: number; cashflow: number };
    y20: { equity: number; irr: number; cashflow: number };
    y30: { equity: number; irr: number; cashflow: number };
  };
}

export interface SensitivityResult {
  baseIRR: number;
  factors: Array<{
    name: "rate" | "rent" | "vacancy" | "taxes" | "insurance" | "exitCap";
    irrAtMinus10pct: number;
    irrAtPlus10pct: number;
    impactMagnitude: number;
  }>;
}

export interface BreakEvenResult {
  rentMonthly: number;
  occupancy: number;
  rentCushionPct: number;
  occupancyCushionPct: number;
}

export interface BrrrrTimelineResult {
  phases: Array<{
    id: "buy" | "rehab" | "lease" | "season" | "refi" | "stabilized";
    label: string;
    monthStart: number;
    monthEnd: number | null;
  }>;
  monthsToFirstRefi: number;
}

export interface AfterTaxResult {
  yearly: Array<{
    year: number;
    preTaxCashflow: number;
    depreciationDeduction: number;
    interestDeduction: number;
    estimatedTaxBenefit: number;
    afterTaxCashflow: number;
  }>;
}
