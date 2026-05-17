/**
 * GOLDEN-OUTPUT REGRESSION TESTS — temporary safety net for the
 * shared/calculations.ts extraction refactor.
 *
 * Captures the FULL DealGradingResult JSON for one B&H deal and one F&F
 * deal at the time this file was written, before any refactor of
 * buy-and-hold/metrics.ts or fix-and-flip/metrics.ts. Any behavioral
 * change introduced by the refactor will surface as a deep-equal diff.
 *
 * TODO(refactor-merge): DELETE this file after the shared/calculations
 * extraction lands on main. Vitest snapshot tests + the existing per-
 * metric tests are sufficient long-term — this file's job is to guard
 * the in-flight refactor specifically.
 */
import { describe, expect, it } from "vitest";
import {
  gradeBuyAndHoldDeal,
  gradeFixAndFlipDeal,
  type DealInput,
} from "../../index";
import type { FixAndFlipInput } from "../fix-and-flip/types";

// ---- Buy & Hold golden deal -----------------------------------------------

const BNH_DEAL: DealInput = {
  price: 185_000,
  rentMonthly: 1_850,
  taxAnnual: 2_775,
  insuranceAnnual: 1_200,
  hoaMonthly: 0,
  maintenancePctOfRent: 0.08,
  vacancyPctOfRent: 0.05,
  managementPctOfRent: 0.08,
  financing: {
    downPaymentPct: 0.25,
    interestRatePct: 7,
    termYears: 30,
    closingCostsPct: 0.03,
  },
};

const BNH_CONTEXT = { marketPiqScore: 67 };

// ---- Fix & Flip golden deal -----------------------------------------------

const FF_DEAL: FixAndFlipInput = {
  price: 250_000,
  arv: 390_000,
  rehabBudget: 45_000,
  holdMonths: 6,
  buyClosingPct: 0.02,
  rehabContingencyPct: 0.1,
  sellingCostsPct: 0.07,
  financingType: "hard_money",
  loanAmount: 236_000,
  points: 0.02,
  interestRatePct: 12,
  rehabNotFinanced: 9_000,
  propertyTaxAnnual: 4_200,
  insuranceAnnual: 1_400,
  utilitiesMonthly: 200,
  hoaMonthly: 0,
  holdingCashOutOfPocket: 5_000,
};

const FF_CONTEXT = {
  marketPiqScore: 72,
  marketDomDays: 35,
  extendedHoldAccepted: true,
} as const;

// ---- Golden snapshots captured pre-refactor -------------------------------
//
// These were captured by running gradeBuyAndHoldDeal(BNH_DEAL, BNH_CONTEXT)
// and gradeFixAndFlipDeal(FF_DEAL, FF_CONTEXT) at HEAD before any refactor
// of buy-and-hold/metrics.ts or fix-and-flip/metrics.ts. Toggling
// REGENERATE_GOLDENS to true will refresh them — leave it false in CI.
const REGENERATE_GOLDENS = false;

describe("GOLDEN: B&H grade output unchanged across refactor", () => {
  it("gradeBuyAndHoldDeal returns the captured baseline", () => {
    const actual = gradeBuyAndHoldDeal(BNH_DEAL, BNH_CONTEXT);
    if (REGENERATE_GOLDENS) {
      console.log("B&H GOLDEN", JSON.stringify(actual, null, 2));
    }
    expect(actual).toMatchSnapshot();
  });
});

describe("GOLDEN: F&F grade output unchanged across refactor", () => {
  it("gradeFixAndFlipDeal returns the captured baseline", () => {
    const actual = gradeFixAndFlipDeal(FF_DEAL, FF_CONTEXT);
    if (REGENERATE_GOLDENS) {
      console.log("F&F GOLDEN", JSON.stringify(actual, null, 2));
    }
    expect(actual).toMatchSnapshot();
  });
});
