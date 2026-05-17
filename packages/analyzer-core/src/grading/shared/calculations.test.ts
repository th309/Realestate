/**
 * Unit tests for shared/calculations.ts.
 *
 * Targets ≥95% coverage on every primitive. Each helper has a "typical"
 * case and at least one degenerate / edge case to lock in the
 * well-defined behavior at boundaries (0 principal, 0 rate, 0 rent,
 * 100% vacancy, etc.).
 */
import { describe, expect, it } from "vitest";
import {
  breakEvenOccupancy,
  capRate,
  cashFlowPerDoorMonthly,
  dscr,
  monthlyHoldingCosts,
  monthlyLoanInterest,
  monthlyPI,
  noiAnnual,
  operatingExpensesAnnual,
} from "./calculations";

// ---- monthlyPI -------------------------------------------------------------

describe("monthlyPI", () => {
  it("typical 30-year loan: $200k @ 7% → ~$1330.60/mo", () => {
    // Standard amortization: monthly rate 0.07/12, n=360
    // M = 200000 · r·(1+r)^n / ((1+r)^n - 1) ≈ 1330.60
    expect(monthlyPI(200_000, 7, 30)).toBeCloseTo(1330.6, 1);
  });

  it("zero principal returns 0", () => {
    expect(monthlyPI(0, 7, 30)).toBe(0);
  });

  it("negative principal returns 0 (defensive)", () => {
    expect(monthlyPI(-100, 7, 30)).toBe(0);
  });

  it("zero rate degenerates to straight-line: principal / (term · 12)", () => {
    // $360k loan, 30y, 0% rate → $1000/mo
    expect(monthlyPI(360_000, 0, 30)).toBeCloseTo(1000, 6);
  });

  it("zero term returns 0 (defensive)", () => {
    expect(monthlyPI(200_000, 7, 0)).toBe(0);
  });

  it("15-year term gives higher monthly than 30-year for same principal+rate", () => {
    const p30 = monthlyPI(200_000, 7, 30);
    const p15 = monthlyPI(200_000, 7, 15);
    expect(p15).toBeGreaterThan(p30);
  });
});

// ---- monthlyLoanInterest --------------------------------------------------

describe("monthlyLoanInterest", () => {
  it("typical: $200k balance at 12% → $2000/mo interest", () => {
    expect(monthlyLoanInterest(200_000, 12)).toBeCloseTo(2000, 6);
  });

  it("zero balance returns 0", () => {
    expect(monthlyLoanInterest(0, 7)).toBe(0);
  });

  it("zero rate returns 0", () => {
    expect(monthlyLoanInterest(100_000, 0)).toBe(0);
  });

  it("negative balance returns 0 (defensive)", () => {
    expect(monthlyLoanInterest(-1000, 7)).toBe(0);
  });
});

// ---- operatingExpensesAnnual ----------------------------------------------

describe("operatingExpensesAnnual", () => {
  const baseOpts = {
    monthlyRent: 2000,
    maintenancePct: 0.08,
    capexPct: 0,
    pmPct: 0.08,
    propertyTaxAnnual: 3000,
    insuranceAnnual: 1200,
    hoaMonthly: 0,
  };

  it("typical: $2k rent + 8% maint + 8% pm + $3k tax + $1.2k ins → opex sum", () => {
    // grossAnnual = 24000; maint = 1920; pm = 1920; tax+ins = 4200; hoa=0; capex=0
    // total = 8040
    expect(operatingExpensesAnnual(baseOpts)).toBeCloseTo(8040, 2);
  });

  it("includes capex when capexPct > 0", () => {
    const r = operatingExpensesAnnual({ ...baseOpts, capexPct: 0.05 });
    // adds 24000 * 0.05 = 1200 → 9240
    expect(r).toBeCloseTo(9240, 2);
  });

  it("HOA folds in at monthly · 12", () => {
    const r = operatingExpensesAnnual({ ...baseOpts, hoaMonthly: 100 });
    // adds 1200 → 9240
    expect(r).toBeCloseTo(9240, 2);
  });

  it("zero rent: opex = tax + insurance + HOA only (rent-derived parts = 0)", () => {
    const r = operatingExpensesAnnual({
      ...baseOpts,
      monthlyRent: 0,
      hoaMonthly: 50,
    });
    // 3000 + 1200 + 600 = 4800
    expect(r).toBeCloseTo(4800, 2);
  });
});

// ---- noiAnnual ------------------------------------------------------------

describe("noiAnnual", () => {
  const baseOpts = {
    monthlyRent: 2000,
    vacancyPct: 0.05,
    maintenancePct: 0.08,
    capexPct: 0,
    pmPct: 0.08,
    propertyTaxAnnual: 3000,
    insuranceAnnual: 1200,
    hoaMonthly: 0,
  };

  it("typical: 24k gross, 5% vac, opex 8040 → NOI 14760", () => {
    // effective = 24000 * 0.95 = 22800; NOI = 22800 - 8040 = 14760
    expect(noiAnnual(baseOpts)).toBeCloseTo(14760, 2);
  });

  it("100% vacancy: NOI is just the negative of fixed opex (tax + ins + HOA)", () => {
    // effective = 0; opex still includes maint+pm of zero (because grossRent
    // is the base, and grossRent * pct = 0 IS the right answer — but the
    // function uses the same monthlyRent for both, so opex still has tax+ins.
    // Note: vacancyPct doesn't zero out rent in opex helper — opex is based
    // on grossRent (full occupancy). So opex stays 8040, NOI = -8040.
    expect(noiAnnual({ ...baseOpts, vacancyPct: 1 })).toBeCloseTo(-8040, 2);
  });

  it("zero rent: NOI = -opex (taxes + insurance + HOA)", () => {
    expect(noiAnnual({ ...baseOpts, monthlyRent: 0 })).toBeCloseTo(-4200, 2);
  });
});

// ---- dscr -----------------------------------------------------------------

describe("dscr", () => {
  it("typical: NOI 14760 / DS 11000 ≈ 1.342", () => {
    expect(dscr(14_760, 11_000)).toBeCloseTo(1.342, 2);
  });

  it("zero debt service returns Infinity", () => {
    expect(dscr(14_760, 0)).toBe(Number.POSITIVE_INFINITY);
  });

  it("high-leverage NOI < DS → DSCR < 1", () => {
    expect(dscr(8_000, 12_000)).toBeLessThan(1);
  });

  it("negative NOI yields negative DSCR (legitimate signal)", () => {
    expect(dscr(-1_000, 5_000)).toBeCloseTo(-0.2, 6);
  });
});

// ---- capRate --------------------------------------------------------------

describe("capRate", () => {
  it("typical: NOI 12000 / value 200000 = 0.06 (6%)", () => {
    expect(capRate(12_000, 200_000)).toBeCloseTo(0.06, 6);
  });

  it("zero property value returns 0 (cap rate undefined)", () => {
    expect(capRate(12_000, 0)).toBe(0);
  });

  it("negative value returns 0 (defensive)", () => {
    expect(capRate(12_000, -100)).toBe(0);
  });

  it("negative NOI yields negative cap rate", () => {
    expect(capRate(-5_000, 100_000)).toBeCloseTo(-0.05, 6);
  });
});

// ---- cashFlowPerDoorMonthly -----------------------------------------------

describe("cashFlowPerDoorMonthly", () => {
  it("typical: $24k annual CF, 1 door → $2000/door/mo", () => {
    expect(cashFlowPerDoorMonthly(24_000, 1)).toBeCloseTo(2_000, 2);
  });

  it("4 doors halves to per-door amount: $24k / 12 / 4 = $500", () => {
    expect(cashFlowPerDoorMonthly(24_000, 4)).toBeCloseTo(500, 2);
  });

  it("zero doors treated as 1 (defensive)", () => {
    expect(cashFlowPerDoorMonthly(1_200, 0)).toBeCloseTo(100, 2);
  });

  it("negative cash flow propagates the sign", () => {
    expect(cashFlowPerDoorMonthly(-2_400, 1)).toBeCloseTo(-200, 2);
  });
});

// ---- breakEvenOccupancy ---------------------------------------------------

describe("breakEvenOccupancy", () => {
  it("typical: opex 8k + ds 12k vs gross 24k → 83.3%", () => {
    expect(breakEvenOccupancy(8_000, 12_000, 24_000)).toBeCloseTo(0.833, 3);
  });

  it("zero gross rent returns Infinity (cannot break even on no rent)", () => {
    expect(breakEvenOccupancy(8_000, 12_000, 0)).toBe(Number.POSITIVE_INFINITY);
  });

  it("high leverage causing opex + ds > gross → break-even > 1.0", () => {
    expect(breakEvenOccupancy(15_000, 20_000, 24_000)).toBeGreaterThan(1);
  });

  it("no debt service: be = opex / gross", () => {
    expect(breakEvenOccupancy(8_000, 0, 20_000)).toBeCloseTo(0.4, 6);
  });
});

// ---- monthlyHoldingCosts --------------------------------------------------

describe("monthlyHoldingCosts", () => {
  it("typical cash flip carry: tax+ins/12 + util + hoa + 0 interest", () => {
    // $4200 tax/12 = 350, $1400 ins/12 = ~116.67, $200 util, $0 hoa, $0 interest
    // = 666.67
    expect(
      monthlyHoldingCosts({
        propertyTaxAnnual: 4_200,
        insuranceAnnual: 1_400,
        utilitiesMonthly: 200,
        hoaMonthly: 0,
        monthlyLoanInterest: 0,
      }),
    ).toBeCloseTo(666.67, 2);
  });

  it("hard-money flip adds the loan-interest portion", () => {
    // Same as above + 2360 interest = 3026.67
    expect(
      monthlyHoldingCosts({
        propertyTaxAnnual: 4_200,
        insuranceAnnual: 1_400,
        utilitiesMonthly: 200,
        hoaMonthly: 0,
        monthlyLoanInterest: 2_360,
      }),
    ).toBeCloseTo(3026.67, 2);
  });

  it("all-zero opts returns 0", () => {
    expect(
      monthlyHoldingCosts({
        propertyTaxAnnual: 0,
        insuranceAnnual: 0,
        utilitiesMonthly: 0,
        hoaMonthly: 0,
        monthlyLoanInterest: 0,
      }),
    ).toBe(0);
  });
});
