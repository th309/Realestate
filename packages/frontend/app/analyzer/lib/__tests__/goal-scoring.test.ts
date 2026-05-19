// packages/frontend/app/analyzer/lib/__tests__/goal-scoring.test.ts
import { describe, expect, it } from "vitest";
import type {
  BrrrrResult,
  FlipResult,
  RentalResult,
} from "@propertyiq/analyzer-core";
import { scoreForGoal } from "../goal-scoring";

/** Minimal fixture builder — only the fields scoring functions actually read. */
function makeFixtures(over: {
  rentalCashflowMonthly?: number;
  flipProfit?: number;
  flipHoldMonths?: number;
  brrrrPostRefiCashflow?: number;
}) {
  const rental = {
    cashflowMonthly: over.rentalCashflowMonthly ?? 0,
    noiAnnual: 0,
    capRatePct: 0,
    cashOnCashPct: 0,
    dscr: 1,
    onePctRulePct: 0,
    totalCashInvested: 80_000,
    monthlyDebtService: 0,
  } as RentalResult;
  const flip = {
    mao70: 0,
    wholetailMax: 0,
    projectedProfit: over.flipProfit ?? 0,
    projectedRoiPct: 0,
  } as FlipResult;
  const brrrr = {
    score: 0,
    refinanceCashOut: 0,
    remainingCashInDeal: 0,
    postRefiCashflowMonthly: over.brrrrPostRefiCashflow ?? 0,
    rating: "OK",
  } as BrrrrResult;
  const holdMonths = over.flipHoldMonths ?? 4;
  return { rental, flip, brrrr, projection: undefined, holdMonths };
}

describe("scoreForGoal — cash_flow", () => {
  it("B&H score equals rental monthly cashflow", () => {
    const f = makeFixtures({ rentalCashflowMonthly: 300 });
    const s = scoreForGoal("cash_flow", f);
    expect(s.buyAndHold).toBe(300);
  });

  it("BRRRR score equals post-refi monthly cashflow", () => {
    const f = makeFixtures({ brrrrPostRefiCashflow: 250 });
    const s = scoreForGoal("cash_flow", f);
    expect(s.brrrr).toBe(250);
  });

  it("F&F gets the soft-penalty proxy: (profit / months) × 0.4", () => {
    const f = makeFixtures({ flipProfit: 50_000, flipHoldMonths: 5 });
    // 50_000 / 5 = 10_000; × 0.4 = 4_000 per "month-equivalent"
    const s = scoreForGoal("cash_flow", f);
    expect(s.flip).toBeCloseTo(4_000, 1);
  });

  it("F&F floors at 0 when profit is negative (degenerate flip)", () => {
    const f = makeFixtures({ flipProfit: -10_000, flipHoldMonths: 4 });
    const s = scoreForGoal("cash_flow", f);
    expect(s.flip).toBe(0);
  });
});
