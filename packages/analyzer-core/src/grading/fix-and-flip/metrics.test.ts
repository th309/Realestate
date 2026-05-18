/**
 * Vitest unit tests for the F&F metric helpers. Tests the pure math (no
 * orchestrator). Companion to `grade.test.ts` which exercises the full
 * `gradeFixAndFlipDeal` pipeline.
 */
import { describe, expect, it } from "vitest";
import { marketAdjustment } from "../shared/aggregate";
import {
  annualizedROI,
  cashOnCashROI,
  financingCosts,
  purchaseMargin,
  monthlyHoldingCosts,
  monthlyLoanInterest,
  netProfit,
  netProfitMargin,
  totalCashInvested,
  totalProjectCosts,
} from "./metrics";
import { sacramentoDeal, strongCashDeal } from "./test-fixtures";
import type { FixAndFlipInput } from "./types";

// ---- The 5 graded metric calculations: typical / edge / broken --------------

describe("F&F metric calculations", () => {
  it("purchaseMargin: typical case matches (arv - rehab*(1+contingency) - price)/arv", () => {
    const d = strongCashDeal();
    const expected = (320_000 - 30_000 * 1.1 - 200_000) / 320_000;
    expect(purchaseMargin(d)).toBeCloseTo(expected, 4);
  });

  it("purchaseMargin: returns 0 when arv is 0 (broken input)", () => {
    const d = strongCashDeal({ arv: 0 });
    expect(purchaseMargin(d)).toBe(0);
  });

  it("purchaseMargin: edge — negative when overpaid", () => {
    const d = strongCashDeal({ price: 310_000 });
    expect(purchaseMargin(d)).toBeLessThan(0);
  });

  it("netProfit: revenue minus total project costs", () => {
    const d = strongCashDeal();
    expect(netProfit(d)).toBeCloseTo(d.arv - totalProjectCosts(d), 2);
  });

  it("netProfitMargin: profit divided by ARV", () => {
    const d = strongCashDeal();
    expect(netProfitMargin(d)).toBeCloseTo(netProfit(d) / d.arv, 6);
  });

  it("netProfitMargin: returns 0 when arv is 0", () => {
    const d = strongCashDeal({ arv: 0 });
    expect(netProfitMargin(d)).toBe(0);
  });

  it("cashOnCashROI: profit divided by total cash invested", () => {
    const d = strongCashDeal();
    expect(cashOnCashROI(d)).toBeCloseTo(
      netProfit(d) / totalCashInvested(d),
      6,
    );
  });

  it("cashOnCashROI: stays finite under degenerate (near-zero) cash", () => {
    const d: FixAndFlipInput = {
      price: 0.01,
      arv: 100_000,
      rehabBudget: 0,
      holdMonths: 4,
      financingType: "cash",
      closing: 0,
      holdingCashOutOfPocket: 0,
    };
    expect(Number.isFinite(cashOnCashROI(d))).toBe(true);
  });

  it("annualizedROI: scales CoC by 12/months", () => {
    const d = strongCashDeal({ holdMonths: 6 });
    expect(annualizedROI(d)).toBeCloseTo(cashOnCashROI(d) * 2, 6);
  });

  it("annualizedROI: returns 0 when hold months is 0 (broken)", () => {
    const d = strongCashDeal({ holdMonths: 0 });
    expect(annualizedROI(d)).toBe(0);
  });
});

// ---- Purchase margin under different maxAcquisitionMultiplier readings -----

describe("purchase margin under different maxAcquisitionMultiplier", () => {
  it("conservative (0.65): a comfortably-priced deal shows healthy margin", () => {
    const d = strongCashDeal({ price: 165_000 });
    expect(purchaseMargin(d)).toBeGreaterThan(0.07);
  });

  it("standard 70%: 0.232 margin is the spec's Sacramento number", () => {
    const d = sacramentoDeal();
    expect(purchaseMargin(d)).toBeCloseTo(0.232, 3);
  });

  it("aggressive 75%: lower margin is acceptable for a wholetail", () => {
    const d = strongCashDeal({ price: 240_000 });
    expect(purchaseMargin(d)).toBeCloseTo(0.147, 2);
  });
});

// ---- Net profit across financing types -------------------------------------

describe("net profit across financing types", () => {
  it("cash: financingCosts is zero", () => {
    const d = strongCashDeal({ financingType: "cash" });
    expect(financingCosts(d)).toBe(0);
  });

  it("conventional: interest-only, no points", () => {
    const d = strongCashDeal({
      financingType: "conventional",
      loanAmount: 150_000,
      interestRatePct: 7,
      downPayment: 50_000,
    });
    const expected = monthlyLoanInterest(d) * 4;
    expect(financingCosts(d)).toBeCloseTo(expected, 2);
  });

  it("hard_money: points + interest over hold", () => {
    const d = sacramentoDeal();
    const expected = 236_000 * 0.02 + monthlyLoanInterest(d) * 6;
    expect(financingCosts(d)).toBeCloseTo(expected, 2);
  });

  it("private: interest only, no points", () => {
    const d = strongCashDeal({
      financingType: "private",
      loanAmount: 150_000,
      interestRatePct: 9,
      downPayment: 50_000,
    });
    const expected = monthlyLoanInterest(d) * 4;
    expect(financingCosts(d)).toBeCloseTo(expected, 2);
  });

  it("totalCashInvested for hard_money excludes loan principal", () => {
    const d = sacramentoDeal();
    const cash = totalCashInvested(d);
    // equity (250-236=14k) + closing (5k) + rehabOOP (9k) + holdCash (5k) + points (4.72k) ≈ 38k
    expect(cash).toBeGreaterThan(30_000);
    expect(cash).toBeLessThan(50_000);
  });

  it("totalCashInvested for cash includes full purchase + rehab", () => {
    const d = strongCashDeal();
    const cash = totalCashInvested(d);
    expect(cash).toBeCloseTo(234_000, -3); // 200k + 4k closing + 30k rehab ≈ 234k
  });
});

// ---- Annualized ROI sensitivity to hold months -----------------------------

describe("annualized ROI hold-months sensitivity", () => {
  it("3mo hold quadruples CoC", () => {
    const d = strongCashDeal({ holdMonths: 3 });
    expect(annualizedROI(d)).toBeCloseTo(cashOnCashROI(d) * 4, 6);
  });

  it("6mo hold doubles CoC", () => {
    const d = strongCashDeal({ holdMonths: 6 });
    expect(annualizedROI(d)).toBeCloseTo(cashOnCashROI(d) * 2, 6);
  });

  it("12mo hold equals CoC", () => {
    const d = strongCashDeal({ holdMonths: 12 });
    expect(annualizedROI(d)).toBeCloseTo(cashOnCashROI(d), 6);
  });

  it("18mo hold yields 2/3 of CoC", () => {
    const d = strongCashDeal({ holdMonths: 18 });
    expect(annualizedROI(d)).toBeCloseTo(cashOnCashROI(d) * (12 / 18), 6);
  });
});

// ---- Market adjustment (F&F-specific bands) --------------------------------

describe("market adjustment (FIX_AND_FLIP bands)", () => {
  it(">= 70 PIQ: +0.25", () => {
    expect(marketAdjustment(75, "FIX_AND_FLIP")).toBe(0.25);
  });
  it("50-69 PIQ: 0", () => {
    expect(marketAdjustment(60, "FIX_AND_FLIP")).toBe(0);
  });
  it("35-49 PIQ: -0.25", () => {
    expect(marketAdjustment(40, "FIX_AND_FLIP")).toBe(-0.25);
  });
  it("< 35 PIQ: -0.50", () => {
    expect(marketAdjustment(20, "FIX_AND_FLIP")).toBe(-0.5);
  });
  it("undefined PIQ: 0", () => {
    expect(marketAdjustment(undefined, "FIX_AND_FLIP")).toBe(0);
  });
});

// ---- monthlyHoldingCosts derivation ---------------------------------------

describe("monthlyHoldingCosts derivation", () => {
  it("derives from components when not provided", () => {
    const d = strongCashDeal();
    const expected = 3_000 / 12 + 900 / 12 + 150 + 0 + 0;
    expect(monthlyHoldingCosts(d)).toBeCloseTo(expected, 2);
  });

  it("uses provided value verbatim when set", () => {
    const d = strongCashDeal({ monthlyHoldingCosts: 999 });
    expect(monthlyHoldingCosts(d)).toBe(999);
  });

  it("includes monthlyLoanInterest in hard-money holding costs", () => {
    const d = sacramentoDeal();
    expect(monthlyLoanInterest(d)).toBeCloseTo(2_360, 0);
    const expected = 4_200 / 12 + 1_400 / 12 + 200 + 0 + 2_360;
    expect(monthlyHoldingCosts(d)).toBeCloseTo(expected, 1);
  });
});
