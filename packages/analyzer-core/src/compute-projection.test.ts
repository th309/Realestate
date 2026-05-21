import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { computeProjection } from "./compute-projection";
import type { DealInput } from "./types";

const validInput: DealInput = {
  price: 240_000,
  rentMonthly: 2_850,
  taxAnnual: 3_800,
  insuranceAnnual: 1_200,
  hoaMonthly: 0,
  financing: {
    downPaymentPct: 0.2,
    interestRatePct: 7.1,
    termYears: 30,
    closingCostsPct: 0.03,
  },
};

describe("computeProjection", () => {
  it("returns 30 yearly rows by default", () => {
    const r = computeProjection(validInput);
    expect(r.yearly).toHaveLength(30);
    expect(r.yearly[0].year).toBe(1);
    expect(r.yearly[29].year).toBe(30);
  });

  it("returns horizons at canonical years", () => {
    const r = computeProjection(validInput);
    expect(r.horizons.y1.equity).toBe(r.yearly[0].cumulativeEquity);
    expect(r.horizons.y10.equity).toBe(r.yearly[9].cumulativeEquity);
    expect(r.horizons.y30.equity).toBe(r.yearly[29].cumulativeEquity);
  });

  it("cumulative equity is monotonically non-decreasing under positive appreciation", () => {
    const r = computeProjection(validInput, { appreciationPct: 0.03 });
    for (let i = 1; i < r.yearly.length; i++) {
      expect(r.yearly[i].cumulativeEquity).toBeGreaterThanOrEqual(
        r.yearly[i - 1].cumulativeEquity,
      );
    }
  });

  it("respects custom horizon length", () => {
    const r = computeProjection(validInput, { years: 10 });
    expect(r.yearly).toHaveLength(10);
  });

  it("null rentMonthly produces zero gross rent throughout", () => {
    const r = computeProjection({ ...validInput, rentMonthly: null });
    expect(r.yearly.every((y) => y.grossRent === 0)).toBe(true);
  });

  it("property: principalPaydown is positive every year for amortized loan", () => {
    fc.assert(
      fc.property(
        fc.float({
          min: Math.fround(0.04),
          max: Math.fround(0.1),
          noNaN: true,
        }),
        fc.integer({ min: 15, max: 30 }),
        (rate, term) => {
          const r = computeProjection({
            ...validInput,
            financing: {
              ...validInput.financing,
              interestRatePct: rate * 100,
              termYears: term,
            },
          });
          return r.yearly.every((y) => y.principalPaydown > 0);
        },
      ),
      { numRuns: 50 },
    );
  });
});
