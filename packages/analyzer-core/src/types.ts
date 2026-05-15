export interface FinancingTerms {
  downPaymentPct: number;
  interestRatePct: number;
  termYears: number;
  closingCostsPct?: number;
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
