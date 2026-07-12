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

  it("no growth opts = flat rent across years (backward compatible)", () => {
    const r = computeAfterTax(validInput);
    expect(r.yearly[0].preTaxCashflow).toBeCloseTo(
      r.yearly[9].preTaxCashflow,
      6,
    );
  });

  it("rent growth compounds year over year and lifts later cashflow", () => {
    const r = computeAfterTax(validInput, { rentGrowthPct: 0.5 });
    // Year 1 uses today's rent — identical to the no-growth year 1.
    const flat = computeAfterTax(validInput);
    expect(r.yearly[0].preTaxCashflow).toBeCloseTo(
      flat.yearly[0].preTaxCashflow,
      6,
    );
    // 50%/yr compounding: by year 10 a deeply negative deal turns hugely
    // positive (rent ≈ 38x while fixed costs stay flat).
    expect(r.yearly[9].preTaxCashflow).toBeGreaterThan(
      r.yearly[0].preTaxCashflow,
    );
    expect(r.yearly[9].preTaxCashflow).toBeGreaterThan(0);
  });

  it("expense growth compounds fixed costs and drags later cashflow", () => {
    const flat = computeAfterTax(validInput);
    const r = computeAfterTax(validInput, { expenseGrowthPct: 0.1 });
    expect(r.yearly[9].preTaxCashflow).toBeLessThan(
      flat.yearly[9].preTaxCashflow,
    );
  });
});
