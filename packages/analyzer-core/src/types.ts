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
}
