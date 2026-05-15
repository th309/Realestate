import { describe, it, expect } from "vitest";
import { computeAfterTax } from "./compute-after-tax";
import type { DealInput } from "./types";

const validInput: DealInput = {
  price: 240_000,
  rentMonthly: 2_850,
  taxAnnual: 3_800,
  insuranceAnnual: 1_200,
  financing: { downPaymentPct: 0.2, interestRatePct: 7.1, termYears: 30 },
};

describe("computeAfterTax", () => {
  it("returns 10 years by default", () => {
    const r = computeAfterTax(validInput);
    expect(r.yearly).toHaveLength(10);
  });

  it("depreciation = building basis ÷ 27.5 with default 25% land", () => {
    const r = computeAfterTax(validInput);
    const expectedDep = (240_000 * 0.75) / 27.5;
    expect(r.yearly[0].depreciationDeduction).toBeCloseTo(expectedDep, 0);
  });

  it("after-tax cashflow > pre-tax cashflow (tax shield)", () => {
    const r = computeAfterTax(validInput);
    r.yearly.forEach((y) => {
      expect(y.afterTaxCashflow).toBeGreaterThanOrEqual(y.preTaxCashflow);
    });
  });

  it("custom marginal rate scales tax benefit", () => {
    const low = computeAfterTax(validInput, { marginalTaxRate: 0.1 });
    const high = computeAfterTax(validInput, { marginalTaxRate: 0.37 });
    expect(high.yearly[0].estimatedTaxBenefit).toBeGreaterThan(
      low.yearly[0].estimatedTaxBenefit,
    );
  });
});
