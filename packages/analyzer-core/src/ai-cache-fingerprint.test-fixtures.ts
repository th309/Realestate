/**
 * Shared test fixtures for the AI-insights fingerprint tests. Split across
 * ai-cache-fingerprint.test.ts (core/top-level fields), .deal-input.test.ts,
 * .rental-result.test.ts, and .flip-brrrr.test.ts — same pattern as the
 * grading module's test-fixtures.ts files — keeps each file under the
 * 500-line cap.
 */
import type { AiInsightsFingerprintInput } from "./ai-cache-fingerprint";
import type { BrrrrResult, DealInput, FlipResult, RentalResult } from "./types";

export const dealInput: DealInput = {
  price: 425_000,
  rentMonthly: 2_950,
  taxAnnual: 6_400,
  insuranceAnnual: 1_400,
  hoaMonthly: 50,
  maintenancePctOfRent: 0.08,
  vacancyPctOfRent: 0.05,
  managementPctOfRent: 0.08,
  financing: {
    downPaymentPct: 0.2,
    interestRatePct: 7.1,
    termYears: 30,
    closingCostsPct: 0.03,
    amortizationYears: 30,
  },
  propertyClass: "sfh",
  unitCount: 1,
  marketCapRatePct: 6,
  targetDSCR: 1.25,
  capexReserveAnnualPerUnit: 300,
};

export const rentalResult: RentalResult = {
  noiAnnual: 24_000,
  capRatePct: 5.6,
  cashOnCashPct: 8.2,
  dscr: 1.234,
  cashflowMonthly: 412,
  onePctRulePct: 0.69,
  totalCashInvested: 95_000,
  monthlyDebtService: 1_650,
};

export const flipResult: FlipResult = {
  mao70: 280_000,
  wholetailMax: 320_000,
  projectedProfit: 45_000,
  projectedRoiPct: 24.5,
};

export const brrrrResult: BrrrrResult = {
  score: 7.3,
  refinanceCashOut: 300_000,
  remainingCashInDeal: 25_000,
  postRefiCashflowMonthly: 180,
  rating: "STRONG",
};

export const baseInput: AiInsightsFingerprintInput = {
  input: dealInput,
  rental: rentalResult,
  flip: null,
  brrrr: null,
  finalGpa: 3.14,
  letter: "B",
  autoKillCodes: ["REFI_NOT_FINANCEABLE", "NEGATIVE_CASHFLOW"],
  strategy: "BUY_AND_HOLD",
  goal: "cash_flow",
  projectionFinalEquity: 812_345,
  piqByGeo: { metro: 73, county: 68, zip: 42 },
  geoLevel: "metro",
};
