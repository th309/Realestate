import { describe, it, expect } from "vitest";
import { computeRentalMetrics } from "../../rental";
import type { DealInput } from "../../types";
import {
  gradeMetric,
  letterFromGpa,
  marketAdjustment,
} from "../shared/aggregate";
import type { MetricThreshold } from "../shared/types";
import { gradeBuyAndHoldDeal } from "./grade";
import {
  annualOperatingExpenses,
  breakEvenOccupancy,
  cashFlowPerDoor,
  grm,
  opexRatio,
} from "./metrics";
import { BUY_AND_HOLD_DEFAULTS } from "./thresholds";

const baseFinancing = {
  downPaymentPct: 0.25,
  interestRatePct: 7,
  termYears: 30,
  closingCostsPct: 0.03,
};

function baseDeal(overrides: Partial<DealInput> = {}): DealInput {
  return {
    price: 185_000,
    rentMonthly: 1_850,
    taxAnnual: 2_775,
    insuranceAnnual: 1_200,
    hoaMonthly: 0,
    maintenancePctOfRent: 0.08,
    vacancyPctOfRent: 0.05,
    managementPctOfRent: 0.08,
    financing: baseFinancing,
    ...overrides,
  };
}

// A high-margin deal: cheap house, strong rent, low taxes. Used as the
// starting point for "force a specific metric to F" tests.
function strongDeal(overrides: Partial<DealInput> = {}): DealInput {
  return baseDeal({
    price: 120_000,
    rentMonthly: 2_200,
    taxAnnual: 1_400,
    insuranceAnnual: 900,
    financing: {
      ...baseFinancing,
      downPaymentPct: 0.3,
    },
    ...overrides,
  });
}

describe("metrics module", () => {
  it("cashFlowPerDoor divides annual pretax cash flow by 12 months and unit count", () => {
    expect(cashFlowPerDoor(24_000, 1)).toBeCloseTo(2_000, 0);
    expect(cashFlowPerDoor(24_000, 4)).toBeCloseTo(500, 0);
  });

  it("cashFlowPerDoor treats unit count of 0 as 1 to avoid division-by-zero", () => {
    expect(cashFlowPerDoor(1_200, 0)).toBeCloseTo(100, 0);
  });

  it("breakEvenOccupancy returns the fraction of rent needed to cover opex + debt service", () => {
    const input = baseDeal();
    const opex = annualOperatingExpenses(input);
    const grossRent = (input.rentMonthly ?? 0) * 12;
    const ds = 11_076.72; // computed elsewhere; only need rough alignment
    const expected = (opex + ds) / grossRent;
    expect(breakEvenOccupancy(input, ds)).toBeCloseTo(expected, 2);
  });

  it("breakEvenOccupancy returns Infinity when gross rent is zero", () => {
    // bypass gradeBuyAndHoldDeal validation by calling the metric helper directly
    const input = baseDeal({ rentMonthly: 0 });
    expect(breakEvenOccupancy(input, 5_000)).toBe(Number.POSITIVE_INFINITY);
  });

  it("grm divides price by annual rent", () => {
    expect(grm(baseDeal())).toBeCloseTo(185_000 / (1_850 * 12), 2);
  });

  it("grm returns Infinity when gross rent is zero", () => {
    expect(grm(baseDeal({ rentMonthly: 0 }))).toBe(Number.POSITIVE_INFINITY);
  });

  it("opexRatio returns opex divided by gross rent", () => {
    const input = baseDeal();
    const grossRent = (input.rentMonthly ?? 0) * 12;
    const expected = annualOperatingExpenses(input) / grossRent;
    expect(opexRatio(input)).toBeCloseTo(expected, 2);
  });

  it("opexRatio returns Infinity when gross rent is zero", () => {
    expect(opexRatio(baseDeal({ rentMonthly: 0 }))).toBe(
      Number.POSITIVE_INFINITY,
    );
  });

  it("gradeMetric returns A exactly at the A threshold (higher_is_better)", () => {
    expect(gradeMetric(0.12, BUY_AND_HOLD_DEFAULTS.cashOnCash)).toBe("A");
  });

  it("gradeMetric returns B exactly at the B threshold (higher_is_better)", () => {
    expect(gradeMetric(0.1, BUY_AND_HOLD_DEFAULTS.cashOnCash)).toBe("B");
  });

  it("gradeMetric honors lower_is_better direction", () => {
    expect(gradeMetric(0.75, BUY_AND_HOLD_DEFAULTS.breakEvenOccupancy)).toBe(
      "A",
    );
    expect(gradeMetric(0.95, BUY_AND_HOLD_DEFAULTS.breakEvenOccupancy)).toBe(
      "F",
    );
  });

  it("gradeMetric honors higher_is_better direction below D returns F", () => {
    const t: MetricThreshold = BUY_AND_HOLD_DEFAULTS.cashOnCash;
    expect(gradeMetric(0.04, t)).toBe("F");
  });

  it("letterFromGpa maps boundary GPAs to letters", () => {
    expect(letterFromGpa(3.5)).toBe("A");
    expect(letterFromGpa(2.5)).toBe("B");
    expect(letterFromGpa(1.5)).toBe("C");
    expect(letterFromGpa(0.5)).toBe("D");
    expect(letterFromGpa(0.49)).toBe("F");
  });

  it("marketAdjustment (BUY_AND_HOLD) returns tier-based adjustments by PIQ score", () => {
    expect(marketAdjustment(85, "BUY_AND_HOLD")).toBe(0.25);
    expect(marketAdjustment(67, "BUY_AND_HOLD")).toBe(0);
    expect(marketAdjustment(40, "BUY_AND_HOLD")).toBe(-0.25);
    expect(marketAdjustment(15, "BUY_AND_HOLD")).toBe(-0.5);
    expect(marketAdjustment(undefined, "BUY_AND_HOLD")).toBe(0);
  });

  it("marketAdjustment treats BRRRR the same as BUY_AND_HOLD (placeholder)", () => {
    expect(marketAdjustment(85, "BRRRR")).toBe(0.25);
    expect(marketAdjustment(40, "BRRRR")).toBe(-0.25);
  });
});

describe("gradeBuyAndHoldDeal", () => {
  it("throws when rentMonthly is null or non-positive", () => {
    expect(() => gradeBuyAndHoldDeal(baseDeal({ rentMonthly: null }))).toThrow(
      /rentMonthly/,
    );
    expect(() => gradeBuyAndHoldDeal(baseDeal({ rentMonthly: 0 }))).toThrow(
      /rentMonthly/,
    );
  });

  it("throws when price is non-positive", () => {
    expect(() => gradeBuyAndHoldDeal(baseDeal({ price: 0 }))).toThrow(/price/);
  });

  it("returns five graded metrics in a fixed order", () => {
    const result = gradeBuyAndHoldDeal(baseDeal());
    expect(result.metrics.map((m) => m.key)).toEqual([
      "cashOnCash",
      "dscr",
      "cashFlowPerDoor",
      "capRate",
      "breakEvenOccupancy",
    ]);
  });

  it("returns three advisories (1% rule, GRM, opex ratio)", () => {
    const result = gradeBuyAndHoldDeal(baseDeal());
    expect(result.advisories.map((a) => a.key)).toEqual([
      "one_percent_rule",
      "grm",
      "opex_ratio",
    ]);
  });

  it("auto-kills when DSCR drops below 1.0 (high price suppresses NOI vs debt)", () => {
    // Bump price way up to crush DSCR while keeping rent flat.
    const input = baseDeal({ price: 400_000, rentMonthly: 1_400 });
    const rental = computeRentalMetrics(input);
    // sanity: DSCR should now be < 1
    expect(rental.dscr).toBeLessThan(1);
    const result = gradeBuyAndHoldDeal(input, {
      appreciationPlayAccepted: true,
    });
    expect(result.letter).toBe("F");
    expect(result.autoKills.map((k) => k.code)).toContain("DSCR_BELOW_1");
  });

  it("auto-kills when flood zone is AE without quoted insurance", () => {
    const result = gradeBuyAndHoldDeal(baseDeal(), { floodZone: "AE" });
    expect(result.letter).toBe("F");
    expect(result.autoKills.map((k) => k.code)).toContain("FLOOD_NO_INSURANCE");
  });

  it("does not auto-kill when flood insurance is quoted", () => {
    const result = gradeBuyAndHoldDeal(baseDeal(), {
      floodZone: "AE",
      floodInsuranceQuoted: true,
    });
    expect(result.autoKills.map((k) => k.code)).not.toContain(
      "FLOOD_NO_INSURANCE",
    );
  });

  it("auto-kills when taxes + insurance exceed 40% of gross annual rent", () => {
    const input = baseDeal({ taxAnnual: 10_000, insuranceAnnual: 2_000 });
    const result = gradeBuyAndHoldDeal(input, {
      appreciationPlayAccepted: true,
    });
    expect(result.letter).toBe("F");
    expect(result.autoKills.map((k) => k.code)).toContain("TAX_INS_OVER_40");
  });

  it("auto-kills on negative cash flow without appreciation acknowledgment", () => {
    // Crank rent down so cash flow goes negative.
    const input = baseDeal({ rentMonthly: 900 });
    const result = gradeBuyAndHoldDeal(input);
    expect(result.letter).toBe("F");
    expect(result.autoKills.map((k) => k.code)).toContain(
      "NEG_CF_NO_APPRECIATION_ACK",
    );
  });

  it("does not auto-kill negative cash flow when appreciation play is acknowledged", () => {
    const input = baseDeal({ rentMonthly: 900 });
    const result = gradeBuyAndHoldDeal(input, {
      appreciationPlayAccepted: true,
    });
    expect(result.autoKills.map((k) => k.code)).not.toContain(
      "NEG_CF_NO_APPRECIATION_ACK",
    );
  });

  it("collects multiple auto-kill codes simultaneously", () => {
    const input = baseDeal({
      price: 400_000,
      rentMonthly: 1_200,
      taxAnnual: 8_000,
      insuranceAnnual: 1_800,
    });
    const result = gradeBuyAndHoldDeal(input, { floodZone: "VE" });
    expect(result.letter).toBe("F");
    const codes = result.autoKills.map((k) => k.code);
    expect(codes).toContain("DSCR_BELOW_1");
    expect(codes).toContain("FLOOD_NO_INSURANCE");
    expect(codes).toContain("TAX_INS_OVER_40");
    expect(codes).toContain("NEG_CF_NO_APPRECIATION_ACK");
  });

  it("floors letter at D when DSCR metric grade is F (other metrics strong)", () => {
    const input = strongDeal();
    const customThresholds = {
      ...BUY_AND_HOLD_DEFAULTS,
      dscr: {
        A: 99,
        B: 98,
        C: 97,
        D: 96,
        direction: "higher_is_better" as const,
      },
    };
    const result = gradeBuyAndHoldDeal(
      input,
      { appreciationPlayAccepted: true },
      customThresholds,
    );
    const dscrMetric = result.metrics.find((m) => m.key === "dscr");
    expect(dscrMetric?.grade).toBe("F");
    expect(result.letter).toBe("D");
    expect(result.flooredAt).toBe("D");
    expect(result.autoKills).toHaveLength(0);
  });

  it("floors letter at D when cash-on-cash metric grade is F", () => {
    const input = strongDeal();
    const customThresholds = {
      ...BUY_AND_HOLD_DEFAULTS,
      cashOnCash: {
        A: 0.99,
        B: 0.98,
        C: 0.97,
        D: 0.96,
        direction: "higher_is_better" as const,
      },
    };
    const result = gradeBuyAndHoldDeal(
      input,
      { appreciationPlayAccepted: true },
      customThresholds,
    );
    const cocMetric = result.metrics.find((m) => m.key === "cashOnCash");
    expect(cocMetric?.grade).toBe("F");
    expect(result.autoKills).toHaveLength(0);
    expect(result.letter).toBe("D");
    expect(result.flooredAt).toBe("D");
  });

  it("auto-kill overrides the D floor and forces letter F", () => {
    // CoC=F (floor applies) AND DSCR<1.0 (auto-kill applies)
    const input = baseDeal({ price: 400_000, rentMonthly: 1_400 });
    const result = gradeBuyAndHoldDeal(input, {
      appreciationPlayAccepted: true,
    });
    expect(result.letter).toBe("F");
    expect(result.autoKills.map((k) => k.code)).toContain("DSCR_BELOW_1");
  });

  it("Indianapolis deal: produces a sensible graded result with no auto-kills", () => {
    const input: DealInput = {
      price: 185_000,
      rentMonthly: 1_850,
      taxAnnual: 2_775,
      insuranceAnnual: 1_200,
      hoaMonthly: 0,
      financing: {
        downPaymentPct: 0.25,
        interestRatePct: 7,
        termYears: 30,
        closingCostsPct: 0.03,
      },
    };
    const result = gradeBuyAndHoldDeal(input, { marketPiqScore: 67 });
    expect(result.autoKills).toHaveLength(0);
    // PIQ 67 sits in the 50-79 band → adjustment is 0.
    expect(result.marketAdjustment).toBe(0);
    // CoC fails benchmark → letter is floored at D.
    expect(result.letter).toBe("D");
    expect(result.flooredAt).toBe("D");
    expect(result.finalGpa).toBeGreaterThan(0);
    expect(result.finalGpa).toBeLessThan(2.5);
  });

  it("advisory 1% rule passes at 1.2%, marginal at 0.8%, fails at 0.5%", () => {
    const pass = gradeBuyAndHoldDeal(baseDeal({ price: 154_166 }), {
      appreciationPlayAccepted: true,
    });
    const marginal = gradeBuyAndHoldDeal(baseDeal({ price: 231_250 }), {
      appreciationPlayAccepted: true,
    });
    const fail = gradeBuyAndHoldDeal(baseDeal({ price: 370_000 }), {
      appreciationPlayAccepted: true,
    });
    expect(
      pass.advisories.find((a) => a.key === "one_percent_rule")?.status,
    ).toBe("pass");
    expect(
      marginal.advisories.find((a) => a.key === "one_percent_rule")?.status,
    ).toBe("marginal");
    expect(
      fail.advisories.find((a) => a.key === "one_percent_rule")?.status,
    ).toBe("fail");
  });
});
