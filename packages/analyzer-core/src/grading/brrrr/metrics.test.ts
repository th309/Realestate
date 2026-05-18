/**
 * Vitest unit tests for the BRRRR metric helpers. Tests the pure math (no
 * orchestrator). Companion to `grade.test.ts` which exercises the full
 * `gradeBrrrrDeal` pipeline.
 */
import { describe, expect, it } from "vitest";
import {
  acquisitionFinancingCosts,
  allInCost,
  allInToARVRatio,
  capitalRecoveryPct,
  cashLeftInDeal,
  cashOutAtRefi,
  initialLoanPayoffAtRefi,
  postRefiCapRate,
  postRefiCashFlowMonthly,
  postRefiCashFlowPerDoorMonthly,
  postRefiDebtServiceAnnual,
  postRefiDSCR,
  postRefiMonthlyPI,
  postRefiNOI,
  refiClosingCosts,
  refiLoanAmount,
  timeToRefinanceMonths,
  totalCashInvested,
} from "./metrics";
import { cashBrrrr, indianapolisBrrrr, stuckBrrrr } from "./test-fixtures";

// ---- Acquisition phase -----------------------------------------------------

describe("acquisition-phase math", () => {
  it("acquisitionFinancingCosts: cash deal returns 0", () => {
    expect(acquisitionFinancingCosts(cashBrrrr())).toBe(0);
  });

  it("acquisitionFinancingCosts: hard money = points + interest × hold", () => {
    const d = indianapolisBrrrr();
    // 80k loan × 2 points = 1600; 80k × 12% / 12 = 800/mo × 5 mo = 4000
    expect(acquisitionFinancingCosts(d)).toBeCloseTo(1600 + 4000, 0);
  });

  it("allInCost: cash deal excludes financing costs", () => {
    const d = cashBrrrr();
    const expected =
      d.purchasePrice +
      d.purchasePrice * 0.03 + // buy closing
      d.rehabCost * 1.1 + // 10% contingency
      // carry: tax + ins per month + utilities (no HOA)
      (2_000 / 12 + 1_000 / 12 + 150) * 6;
    expect(allInCost(d)).toBeCloseTo(expected, 0);
  });

  it("allInToARVRatio: returns 0 when arv is 0", () => {
    const d = indianapolisBrrrr({ arv: 0 });
    expect(allInToARVRatio(d)).toBe(0);
  });

  it("allInToARVRatio: textbook BRRRR is under 75%", () => {
    expect(allInToARVRatio(indianapolisBrrrr())).toBeLessThan(0.75);
  });

  it("totalCashInvested: cash branch sums purchase + closing + rehab + holdCash", () => {
    const d = cashBrrrr();
    const expected =
      d.purchasePrice + d.purchasePrice * 0.03 + d.rehabCost + 5_000;
    expect(totalCashInvested(d)).toBeCloseTo(expected, 0);
  });

  it("totalCashInvested: hard-money branch keeps loan principal out", () => {
    const d = indianapolisBrrrr();
    // purchase 75k, loan 80k → ownEquityIn = 0
    // closing = 2.25k, rehabOOP = 0 (rehabNotFinanced=0), points = 1.6k,
    // holdCash = 3k → total 6.85k
    expect(totalCashInvested(d)).toBeCloseTo(6_850, 0);
  });
});

// ---- Refinance event -------------------------------------------------------

describe("refinance-event math", () => {
  it("refiLoanAmount: arv × refiLtvPct (clamped 0-1)", () => {
    const d = indianapolisBrrrr();
    expect(refiLoanAmount(d)).toBeCloseTo(170_000 * 0.7, 2);
  });

  it("refiLoanAmount: clamps LTV above 1", () => {
    const d = indianapolisBrrrr({ refiLtvPct: 1.5 });
    expect(refiLoanAmount(d)).toBe(d.arv);
  });

  it("refiClosingCosts: refi loan × refiClosingPct", () => {
    const d = indianapolisBrrrr();
    expect(refiClosingCosts(d)).toBeCloseTo(170_000 * 0.7 * 0.025, 2);
  });

  it("initialLoanPayoffAtRefi: 0 for cash deals", () => {
    expect(initialLoanPayoffAtRefi(cashBrrrr())).toBe(0);
  });

  it("initialLoanPayoffAtRefi: hard-money principal for HM deals", () => {
    const d = indianapolisBrrrr();
    expect(initialLoanPayoffAtRefi(d)).toBe(d.hardMoneyLoanAmount);
  });

  it("cashOutAtRefi: refi loan minus closing minus payoff", () => {
    const d = indianapolisBrrrr();
    const expected =
      refiLoanAmount(d) - refiClosingCosts(d) - initialLoanPayoffAtRefi(d);
    expect(cashOutAtRefi(d)).toBeCloseTo(expected, 2);
  });

  it("cashLeftInDeal: clamped at 0 from below (strong recovery)", () => {
    const d = indianapolisBrrrr();
    // cashOut (~36k) far exceeds invested (~6.85k) → would be negative, clamped to 0
    expect(cashLeftInDeal(d)).toBe(0);
  });

  it("cashLeftInDeal: positive when refi doesn't return all invested cash", () => {
    expect(cashLeftInDeal(cashBrrrr())).toBeGreaterThan(0);
  });

  it("capitalRecoveryPct: clamped to [0, 1]", () => {
    expect(capitalRecoveryPct(indianapolisBrrrr())).toBeLessThanOrEqual(1);
    expect(capitalRecoveryPct(stuckBrrrr())).toBeGreaterThanOrEqual(0);
  });
});

// ---- Post-refi hold --------------------------------------------------------

describe("post-refi math", () => {
  it("postRefiMonthlyPI: standard amortizing payment", () => {
    const d = indianapolisBrrrr();
    // 119k @ 7.5% / 30yr is about $832/mo
    expect(postRefiMonthlyPI(d)).toBeGreaterThan(820);
    expect(postRefiMonthlyPI(d)).toBeLessThan(845);
  });

  it("postRefiDebtServiceAnnual: 12 × monthly P&I", () => {
    const d = indianapolisBrrrr();
    expect(postRefiDebtServiceAnnual(d)).toBeCloseTo(
      postRefiMonthlyPI(d) * 12,
      4,
    );
  });

  it("postRefiNOI: positive on a textbook BRRRR", () => {
    expect(postRefiNOI(indianapolisBrrrr())).toBeGreaterThan(0);
  });

  it("postRefiDSCR: textbook BRRRR above 1.2 lender threshold", () => {
    expect(postRefiDSCR(indianapolisBrrrr())).toBeGreaterThan(1.2);
  });

  it("postRefiDSCR: stuck deal below 1.0 (unfinanceable)", () => {
    expect(postRefiDSCR(stuckBrrrr())).toBeLessThan(1.0);
  });

  it("postRefiCashFlowMonthly: positive when DSCR > 1", () => {
    expect(postRefiCashFlowMonthly(indianapolisBrrrr())).toBeGreaterThan(0);
  });

  it("postRefiCashFlowPerDoorMonthly: divides by unitCount", () => {
    const d = indianapolisBrrrr({ unitCount: 2 });
    // Single-door cf divided by 2 doors
    const singleDoor = postRefiCashFlowMonthly(d);
    expect(postRefiCashFlowPerDoorMonthly(d)).toBeCloseTo(singleDoor / 2, 2);
  });

  it("postRefiCapRate: NOI / ARV as a decimal", () => {
    const d = indianapolisBrrrr();
    expect(postRefiCapRate(d)).toBeCloseTo(postRefiNOI(d) / d.arv, 4);
  });
});

// ---- Time ------------------------------------------------------------------

describe("time math", () => {
  it("timeToRefinanceMonths: passes through input.holdMonthsBeforeRefi", () => {
    expect(timeToRefinanceMonths(indianapolisBrrrr())).toBe(5);
    expect(timeToRefinanceMonths(stuckBrrrr())).toBe(7);
  });
});
