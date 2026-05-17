/**
 * Shared test fixtures for fix-and-flip grading tests. Exporting from a
 * dedicated module (rather than duplicating in each *.test.ts file) keeps the
 * grading-test files small enough to stay under the 500-line hard limit while
 * letting both `metrics.test.ts` and `grade.test.ts` exercise the same deal
 * shapes.
 */
import type { FixAndFlipInput } from "./types";

/** Strong cash deal: $200k purchase / $320k ARV / $30k rehab / 4mo hold. */
export function strongCashDeal(
  overrides: Partial<FixAndFlipInput> = {},
): FixAndFlipInput {
  return {
    price: 200_000,
    arv: 320_000,
    rehabBudget: 30_000,
    holdMonths: 4,
    buyClosingPct: 0.02,
    rehabContingencyPct: 0.1,
    sellingCostsPct: 0.07,
    financingType: "cash",
    propertyTaxAnnual: 3_000,
    insuranceAnnual: 900,
    utilitiesMonthly: 150,
    hoaMonthly: 0,
    ...overrides,
  };
}

/** Sacramento spec scenario — hard-money flip in a 72-PIQ / 35-DOM market. */
export function sacramentoDeal(
  overrides: Partial<FixAndFlipInput> = {},
): FixAndFlipInput {
  return {
    price: 250_000,
    arv: 390_000,
    rehabBudget: 45_000,
    holdMonths: 6,
    buyClosingPct: 0.02,
    rehabContingencyPct: 0.1,
    sellingCostsPct: 0.07,
    financingType: "hard_money",
    loanAmount: 236_000, // 80% LTC of (250 + 45) ≈ 236
    points: 0.02, // 2 points
    interestRatePct: 12,
    rehabNotFinanced: 9_000,
    propertyTaxAnnual: 4_200,
    insuranceAnnual: 1_400,
    utilitiesMonthly: 200,
    hoaMonthly: 0,
    holdingCashOutOfPocket: 5_000,
    ...overrides,
  };
}
