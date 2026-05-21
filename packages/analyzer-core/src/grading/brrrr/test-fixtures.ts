/**
 * Shared test fixtures for BRRRR grading tests. Same pattern as the F&F
 * fixtures module — keeps individual *.test.ts files under the 500-line cap.
 */
import type { BrrrrGradingInput } from "./types";

/**
 * Indianapolis textbook BRRRR — strong cash-recovery deal. Purchase $75k,
 * medium rehab $25k, refi against $170k ARV at 70% LTV. Hard-money during
 * the 5-month season. Rent $1,700/mo (~1% rule) in a 64-PIQ Midwest market.
 * Should land A/B with no auto-kills.
 */
export function indianapolisBrrrr(
  overrides: Partial<BrrrrGradingInput> = {},
): BrrrrGradingInput {
  return {
    purchasePrice: 75_000,
    arv: 170_000,
    rehabCost: 25_000,
    rehabContingencyPct: 0.1,
    buyClosingPct: 0.03,
    holdMonthsBeforeRefi: 5,

    initialFinancingType: "hard_money",
    hardMoneyLoanAmount: 80_000,
    hardMoneyRate: 12,
    hardMoneyPoints: 0.02,
    rehabNotFinanced: 0,
    holdingCashOutOfPocket: 3_000,
    interestPaidOutOfPocket: 0,

    propertyTaxAnnual: 1_800,
    insuranceAnnual: 900,
    utilitiesMonthly: 150,
    hoaMonthly: 0,

    refiLtvPct: 0.7,
    refiRate: 7.5,
    refiTermYears: 30,
    refiClosingPct: 0.025,

    monthlyRent: 1_700,
    vacancyPct: 0.05,
    maintenancePct: 0.08,
    capexPct: 0,
    pmPct: 0.08,
    unitCount: 1,
    ...overrides,
  };
}

/**
 * Stuck-deal BRRRR — paid too much, rehab over budget, refi appraisal weak.
 * Cash left in deal is high; all-in to ARV is well past 80%. Should land C-D
 * (or F if cash_left maxes out and auto-kill triggers).
 */
export function stuckBrrrr(
  overrides: Partial<BrrrrGradingInput> = {},
): BrrrrGradingInput {
  return {
    purchasePrice: 130_000,
    arv: 175_000,
    rehabCost: 40_000,
    rehabContingencyPct: 0.1,
    buyClosingPct: 0.03,
    holdMonthsBeforeRefi: 7,

    initialFinancingType: "hard_money",
    hardMoneyLoanAmount: 130_000,
    hardMoneyRate: 12,
    hardMoneyPoints: 0.02,
    rehabNotFinanced: 5_000,
    holdingCashOutOfPocket: 4_000,
    interestPaidOutOfPocket: 0,

    propertyTaxAnnual: 2_400,
    insuranceAnnual: 1_100,
    utilitiesMonthly: 180,
    hoaMonthly: 0,

    refiLtvPct: 0.75,
    refiRate: 8.0,
    refiTermYears: 30,
    refiClosingPct: 0.025,

    monthlyRent: 1_550,
    vacancyPct: 0.05,
    maintenancePct: 0.08,
    capexPct: 0.03,
    pmPct: 0.08,
    unitCount: 1,
    ...overrides,
  };
}

/**
 * Cash BRRRR — operator buys outright, rehabs, then refis. No hard-money points
 * or interest in the acquisition phase. Used to exercise the cash branch of
 * acquisitionFinancingCosts and totalCashInvested.
 */
export function cashBrrrr(
  overrides: Partial<BrrrrGradingInput> = {},
): BrrrrGradingInput {
  return {
    purchasePrice: 100_000,
    arv: 180_000,
    rehabCost: 35_000,
    rehabContingencyPct: 0.1,
    buyClosingPct: 0.03,
    holdMonthsBeforeRefi: 6,

    initialFinancingType: "cash",
    holdingCashOutOfPocket: 5_000,

    propertyTaxAnnual: 2_000,
    insuranceAnnual: 1_000,
    utilitiesMonthly: 150,
    hoaMonthly: 0,

    refiLtvPct: 0.75,
    refiRate: 7.5,
    refiTermYears: 30,
    refiClosingPct: 0.025,

    monthlyRent: 1_650,
    vacancyPct: 0.05,
    maintenancePct: 0.08,
    capexPct: 0,
    pmPct: 0.08,
    unitCount: 1,
    ...overrides,
  };
}
