import { describe, expect, it } from "vitest";
import {
  hasAnyAssumptionError,
  validateAssumptions,
  validateMetricThreshold,
  validateWeights,
} from "../validators";

describe("validateMetricThreshold", () => {
  it("accepts strictly descending values for higher_is_better", () => {
    expect(
      validateMetricThreshold({
        A: 0.12,
        B: 0.1,
        C: 0.08,
        D: 0.06,
        direction: "higher_is_better",
      }),
    ).toBeNull();
  });

  it("rejects equal A and B for higher_is_better", () => {
    expect(
      validateMetricThreshold({
        A: 0.1,
        B: 0.1,
        C: 0.08,
        D: 0.06,
        direction: "higher_is_better",
      }),
    ).toMatch(/decrease/);
  });

  it("accepts strictly ascending values for lower_is_better", () => {
    expect(
      validateMetricThreshold({
        A: 0.75,
        B: 0.8,
        C: 0.85,
        D: 0.9,
        direction: "lower_is_better",
      }),
    ).toBeNull();
  });

  it("rejects descending values for lower_is_better", () => {
    expect(
      validateMetricThreshold({
        A: 0.9,
        B: 0.85,
        C: 0.8,
        D: 0.75,
        direction: "lower_is_better",
      }),
    ).toMatch(/increase/);
  });

  it("rejects NaN values", () => {
    expect(
      validateMetricThreshold({
        A: NaN,
        B: 0.1,
        C: 0.08,
        D: 0.06,
        direction: "higher_is_better",
      }),
    ).toBe("All values must be numbers");
  });
});

describe("validateWeights", () => {
  it("accepts sum exactly 100", () => {
    const r = validateWeights({
      cashOnCash: 25,
      dscr: 25,
      cashFlowPerDoor: 20,
      capRate: 15,
      breakEvenOccupancy: 15,
    });
    expect(r).toEqual({ valid: true, sum: 100 });
  });

  it("accepts within ±0.01 tolerance", () => {
    const r = validateWeights({
      cashOnCash: 25.005,
      dscr: 25,
      cashFlowPerDoor: 20,
      capRate: 15,
      breakEvenOccupancy: 15,
    });
    expect(r.valid).toBe(true);
  });

  it("rejects 99.5", () => {
    const r = validateWeights({
      cashOnCash: 24.5,
      dscr: 25,
      cashFlowPerDoor: 20,
      capRate: 15,
      breakEvenOccupancy: 15,
    });
    expect(r.valid).toBe(false);
    expect(r.sum).toBeCloseTo(99.5, 5);
  });
});

describe("validateAssumptions", () => {
  it("accepts in-bounds values", () => {
    const errs = validateAssumptions({
      vacancyPct: 0.05,
      maintenancePct: 0.05,
      capexPct: 0.05,
      pmPct: 0.08,
      rentGrowthPct: 0.03,
      appreciationPct: 0.03,
      holdYears: 10,
      closingCostsPct: 0.03,
    });
    expect(hasAnyAssumptionError(errs)).toBe(false);
  });

  it("rejects vacancy > 1", () => {
    const errs = validateAssumptions({ vacancyPct: 1.5 });
    expect(errs.vacancyPct).toMatch(/between/);
  });

  it("rejects rent growth > 0.5", () => {
    const errs = validateAssumptions({ rentGrowthPct: 0.6 });
    expect(errs.rentGrowthPct).toMatch(/between/);
  });

  it("rejects holdYears out of [1,30]", () => {
    expect(validateAssumptions({ holdYears: 0 }).holdYears).toMatch(/between/);
    expect(validateAssumptions({ holdYears: 31 }).holdYears).toMatch(/between/);
  });

  it("rejects non-integer holdYears", () => {
    expect(validateAssumptions({ holdYears: 5.5 }).holdYears).toMatch(
      /whole number/,
    );
  });

  it("rejects closing costs > 0.2", () => {
    expect(
      validateAssumptions({ closingCostsPct: 0.25 }).closingCostsPct,
    ).toMatch(/between/);
  });

  it("ignores undefined fields", () => {
    const errs = validateAssumptions({});
    expect(hasAnyAssumptionError(errs)).toBe(false);
  });
});
