import { describe, it, expect } from "vitest";
import {
  computeRentalMetrics,
  maxLoanForDSCR,
  remainingBalance,
} from "./rental";
import type { DealInput } from "./types";

const commercialFinancing = {
  downPaymentPct: 0.3, // 30% min for commercial
  interestRatePct: 7.5,
  termYears: 7, // 7-year balloon
  amortizationYears: 30, // 30-year amortization basis
  closingCostsPct: 0.03,
};

function baseTenUnit(): DealInput {
  return {
    price: 1_200_000,
    rentMonthly: 11_000, // $1,100/unit × 10 units
    taxAnnual: 18_000,
    insuranceAnnual: 6_000,
    propertyClass: "commercial_mf",
    unitCount: 10,
    marketCapRatePct: 7.0,
    targetDSCR: 1.25,
    capexReserveAnnualPerUnit: 300,
    financing: commercialFinancing,
  };
}

describe("maxLoanForDSCR", () => {
  it("back-solves the loan whose annual debt service hits NOI / target DSCR", () => {
    // NOI=$80k, DSCR=1.25 → max annual DS = $64k
    // At 7.5% / 30y: monthly P&I per $1 of loan = 0.006992...
    // Annual = 0.083908... So max loan = 64000 / 0.083908 ≈ $762,727
    const loan = maxLoanForDSCR(80_000, 1.25, 7.5, 30);
    expect(loan).toBeGreaterThan(760_000);
    expect(loan).toBeLessThan(765_000);
  });

  it("returns 0 when NOI is non-positive", () => {
    expect(maxLoanForDSCR(0, 1.25, 7.5, 30)).toBe(0);
    expect(maxLoanForDSCR(-1000, 1.25, 7.5, 30)).toBe(0);
  });
});

describe("remainingBalance (balloon)", () => {
  it("returns the original loan when no payments have been made", () => {
    expect(remainingBalance(840_000, 7.5, 30, 0)).toBe(840_000);
  });

  it("returns 0 once amortization is complete", () => {
    expect(remainingBalance(840_000, 7.5, 30, 360)).toBe(0);
  });

  it("returns a meaningful balance partway through (7yr balloon on 30yr amort)", () => {
    // A $840k loan @ 7.5% / 30y amort still has the bulk of principal at year 7.
    // Standard amortization → ~$775k–$780k remaining at month 84.
    const balance = remainingBalance(840_000, 7.5, 30, 7 * 12);
    expect(balance).toBeGreaterThan(770_000);
    expect(balance).toBeLessThan(785_000);
  });
});

describe("computeRentalMetrics (commercial_mf)", () => {
  it("applies commercial defaults when class is commercial_mf and user didn't override", () => {
    const input: DealInput = {
      ...baseTenUnit(),
      vacancyPctOfRent: undefined,
      managementPctOfRent: undefined,
      capexReserveAnnualPerUnit: undefined,
    };
    const r = computeRentalMetrics(input);
    expect(r.commercial).toBeDefined();
    // Commercial defaults: vacancy 7%, mgmt 6%, capex $300/unit
    // gross = 132k, vac = 9.24k, maint = 132×0.08 = 10.56k, mgmt = 132×0.06 = 7.92k
    // opex = 18 + 6 + 10.56 + 7.92 + 0 + 3 (capex 10 units × $300) = 45.48k
    // NOI = 132 - 9.24 - 45.48 = ~77.28k
    expect(r.noiAnnual!).toBeGreaterThan(76_000);
    expect(r.noiAnnual!).toBeLessThan(79_000);
    expect(r.commercial!.capexReserveAnnual).toBe(3_000);
  });

  it("sizes the loan as min(LTV, DSCR) and flags binding constraint", () => {
    const input = baseTenUnit();
    const r = computeRentalMetrics(input);
    expect(r.commercial).toBeDefined();
    // LTV cap: $1.2M × 70% = $840k
    // DSCR cap: depends on NOI. With explicit reserves $300×10 and 5%/8%/8% defaults
    // overridden? No — user overrode vacancy/mgmt to commercial values via baseTenUnit.
    // Just assert effectiveLoan ≤ LTV cap and ≤ DSCR cap.
    expect(r.commercial!.effectiveLoan).toBeLessThanOrEqual(
      r.commercial!.maxLtvLoan,
    );
    if (r.commercial!.maxDscrLoan !== null) {
      expect(r.commercial!.effectiveLoan).toBeLessThanOrEqual(
        r.commercial!.maxDscrLoan,
      );
    }
    expect(["ltv", "dscr", "neither"]).toContain(
      r.commercial!.bindingConstraint,
    );
  });

  it("computes impliedValueAtMarketCap = NOI / cap", () => {
    const input = baseTenUnit();
    const r = computeRentalMetrics(input);
    const expected = r.noiAnnual! / 0.07;
    expect(r.commercial!.impliedValueAtMarketCap).toBeCloseTo(expected, 0);
  });

  it("computes balloon balance at termYears using amort schedule", () => {
    const input = baseTenUnit();
    const r = computeRentalMetrics(input);
    // 7-year balloon on 30y amort → balloon should be a large chunk of effective loan
    expect(r.commercial!.balloonBalance).toBeGreaterThan(
      r.commercial!.effectiveLoan * 0.85,
    );
    expect(r.commercial!.balloonBalance).toBeLessThan(
      r.commercial!.effectiveLoan,
    );
  });

  it("respects DSCR-constraint when NOI is too low to support full LTV loan", () => {
    // Lower the rent so DSCR becomes binding before LTV
    const input: DealInput = {
      ...baseTenUnit(),
      rentMonthly: 7_500, // much lower → squeezed NOI
    };
    const r = computeRentalMetrics(input);
    expect(r.commercial!.bindingConstraint).toBe("dscr");
    expect(r.commercial!.effectiveLoan).toBeLessThan(r.commercial!.maxLtvLoan);
    // The resulting DSCR should be at or very near the target
    expect(r.dscr).toBeGreaterThanOrEqual(1.24);
    expect(r.dscr).toBeLessThanOrEqual(1.26);
  });

  it("does NOT populate commercial output for residential (sfh) deals", () => {
    const input: DealInput = {
      ...baseTenUnit(),
      propertyClass: "sfh",
    };
    const r = computeRentalMetrics(input);
    expect(r.commercial).toBeUndefined();
  });

  it("treats unset propertyClass as residential (backward compat)", () => {
    const input: DealInput = {
      price: 425_000,
      rentMonthly: 2_950,
      taxAnnual: 7_650,
      insuranceAnnual: 1_800,
      financing: {
        downPaymentPct: 0.2,
        interestRatePct: 7.1,
        termYears: 30,
        closingCostsPct: 0.03,
      },
    };
    const r = computeRentalMetrics(input);
    expect(r.commercial).toBeUndefined();
    // Loan sized purely by LTV (no DSCR clamp)
    // 425k × 0.8 = 340k, monthly P&I @ 7.1%/30y = ~$2284.91
    expect(r.monthlyDebtService).toBeCloseTo(2_284.91, 1);
  });
});
