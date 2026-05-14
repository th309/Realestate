import { describe, it, expect } from "vitest";
import { computeRentalMetrics } from "./rental";
import type { DealInput } from "./types";

const baseFinancing = {
  downPaymentPct: 0.2,
  interestRatePct: 7.1,
  termYears: 30,
  closingCostsPct: 0.03,
};

describe("computeRentalMetrics", () => {
  it("computes a representative Austin deal", () => {
    const input: DealInput = {
      price: 425_000,
      rentMonthly: 2_950,
      taxAnnual: 7_650,
      insuranceAnnual: 1_800,
      hoaMonthly: 0,
      maintenancePctOfRent: 0.08,
      vacancyPctOfRent: 0.05,
      managementPctOfRent: 0.08,
      financing: baseFinancing,
    };
    const r = computeRentalMetrics(input);
    // Standard amortization formula: $340k @ 7.1% / 30yr = $2,284.91/mo
    // (plan draft listed 2283.49; corrected to match the canonical formula).
    expect(r.monthlyDebtService).toBeCloseTo(2_284.91, 1);
    expect(r.noiAnnual!).toBeGreaterThan(15_000);
    expect(r.capRatePct!).toBeGreaterThan(3.5);
    expect(r.capRatePct!).toBeLessThan(6.5);
    expect(r.onePctRulePct!).toBeCloseTo((2_950 / 425_000) * 100, 2);
    expect(r.dscr!).toBeGreaterThan(0);
    expect(r.totalCashInvested).toBe(425_000 * 0.2 + 425_000 * 0.03);
  });

  it("returns nulls for rental fields when rent is null but keeps debt service", () => {
    const r = computeRentalMetrics({
      price: 300_000,
      rentMonthly: null,
      taxAnnual: 5_000,
      insuranceAnnual: 1_200,
      financing: baseFinancing,
    });
    expect(r.noiAnnual).toBeNull();
    expect(r.capRatePct).toBeNull();
    expect(r.cashOnCashPct).toBeNull();
    expect(r.dscr).toBeNull();
    expect(r.cashflowMonthly).toBeNull();
    expect(r.onePctRulePct).toBeNull();
    expect(r.monthlyDebtService).toBeGreaterThan(0);
  });

  it("handles 100% down (no debt service)", () => {
    const r = computeRentalMetrics({
      price: 200_000,
      rentMonthly: 2_000,
      taxAnnual: 3_000,
      insuranceAnnual: 800,
      financing: { ...baseFinancing, downPaymentPct: 1 },
    });
    expect(r.monthlyDebtService).toBe(0);
    expect(r.dscr).toBe(Infinity);
    expect(r.cashflowMonthly!).toBeGreaterThan(0);
  });

  it("returns negative cashflow as a valid result", () => {
    const r = computeRentalMetrics({
      price: 800_000,
      rentMonthly: 2_500,
      taxAnnual: 12_000,
      insuranceAnnual: 2_400,
      financing: baseFinancing,
    });
    expect(r.cashflowMonthly!).toBeLessThan(0);
  });

  it("never throws on price=0", () => {
    expect(() =>
      computeRentalMetrics({
        price: 0,
        rentMonthly: 1000,
        taxAnnual: 0,
        insuranceAnnual: 0,
        financing: baseFinancing,
      }),
    ).not.toThrow();
  });
});
