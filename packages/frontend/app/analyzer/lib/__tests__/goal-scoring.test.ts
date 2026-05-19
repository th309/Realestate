// packages/frontend/app/analyzer/lib/__tests__/goal-scoring.test.ts
import { describe, expect, it } from "vitest";
import type {
  BrrrrResult,
  FlipResult,
  ProjectionResult,
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

describe("scoreForGoal — long_term_wealth", () => {
  it("B&H score reads projection.horizons.y30.equity", () => {
    const f = makeFixtures({});
    f.projection = {
      yearly: [],
      horizons: {
        y1: { equity: 0, irr: 0, cashflow: 0 },
        y3: { equity: 0, irr: 0, cashflow: 0 },
        y5: { equity: 0, irr: 0, cashflow: 0 },
        y10: { equity: 0, irr: 0, cashflow: 0 },
        y20: { equity: 0, irr: 0, cashflow: 0 },
        y30: { equity: 425_000, irr: 0, cashflow: 0 },
      },
    } as ProjectionResult;
    const s = scoreForGoal("long_term_wealth", f);
    expect(s.buyAndHold).toBe(425_000);
  });

  it("F&F score compounds projectedProfit at 7% over 30 years", () => {
    const f = makeFixtures({ flipProfit: 50_000 });
    const s = scoreForGoal("long_term_wealth", f);
    // 50_000 × 1.07^30 ≈ 380_612
    expect(s.flip).toBeCloseTo(50_000 * Math.pow(1.07, 30), 0);
  });

  it("BRRRR score uses postRefiProjection.horizons.y30.equity when present", () => {
    const f = makeFixtures({});
    f.brrrr = {
      ...f.brrrr,
      postRefiProjection: {
        yearly: [],
        horizons: {
          y1: { equity: 0, irr: 0, cashflow: 0 },
          y3: { equity: 0, irr: 0, cashflow: 0 },
          y5: { equity: 0, irr: 0, cashflow: 0 },
          y10: { equity: 0, irr: 0, cashflow: 0 },
          y20: { equity: 0, irr: 0, cashflow: 0 },
          y30: { equity: 500_000, irr: 0, cashflow: 0 },
        },
      },
    } as BrrrrResult;
    const s = scoreForGoal("long_term_wealth", f);
    expect(s.brrrr).toBe(500_000);
  });

  it("BRRRR falls back to B&H y30 equity when postRefiProjection is absent", () => {
    const f = makeFixtures({});
    f.projection = {
      yearly: [],
      horizons: {
        y1: { equity: 0, irr: 0, cashflow: 0 },
        y3: { equity: 0, irr: 0, cashflow: 0 },
        y5: { equity: 0, irr: 0, cashflow: 0 },
        y10: { equity: 0, irr: 0, cashflow: 0 },
        y20: { equity: 0, irr: 0, cashflow: 0 },
        y30: { equity: 425_000, irr: 0, cashflow: 0 },
      },
    } as ProjectionResult;
    const s = scoreForGoal("long_term_wealth", f);
    expect(s.brrrr).toBe(425_000);
  });
});

describe("scoreForGoal — fast_cash", () => {
  it("F&F score equals projectedProfit", () => {
    const f = makeFixtures({ flipProfit: 65_000 });
    const s = scoreForGoal("fast_cash", f);
    expect(s.flip).toBe(65_000);
  });

  it("BRRRR score equals refinanceCashOut − totalCashInvested, floored at 0", () => {
    const f = makeFixtures({});
    f.brrrr = {
      ...f.brrrr,
      refinanceCashOut: 100_000,
    } as BrrrrResult;
    // rental.totalCashInvested defaults to 80_000 in the fixture; net = 20k
    const s = scoreForGoal("fast_cash", f);
    expect(s.brrrr).toBe(20_000);
  });

  it("BRRRR floors at 0 when refi doesn't cover the cash put in", () => {
    const f = makeFixtures({});
    f.brrrr = { ...f.brrrr, refinanceCashOut: 50_000 } as BrrrrResult;
    const s = scoreForGoal("fast_cash", f);
    expect(s.brrrr).toBe(0);
  });

  it("B&H uses the year-1 equity proxy when projection is present", () => {
    const f = makeFixtures({});
    f.projection = {
      yearly: [],
      horizons: {
        y1: { equity: 100_000, irr: 0, cashflow: 0 },
        y3: { equity: 0, irr: 0, cashflow: 0 },
        y5: { equity: 0, irr: 0, cashflow: 0 },
        y10: { equity: 0, irr: 0, cashflow: 0 },
        y20: { equity: 0, irr: 0, cashflow: 0 },
        y30: { equity: 0, irr: 0, cashflow: 0 },
      },
    } as ProjectionResult;
    // initialEquity defaults to rental.totalCashInvested (80k) when no
    // separate down-payment field is on the input; helper picks 70% of the
    // delta as HELOC-able. (100k − 80k) × 0.7 = 14_000
    const s = scoreForGoal("fast_cash", f);
    expect(s.buyAndHold).toBeCloseTo(14_000, 0);
  });

  it("B&H falls back to soft proxy when projection is absent", () => {
    const f = makeFixtures({});
    const s = scoreForGoal("fast_cash", f);
    // totalCashInvested × 0.05 = 80_000 × 0.05 = 4_000 (consistent with the
    // Recycle Capital B&H proxy — small but never zero)
    expect(s.buyAndHold).toBe(4_000);
  });
});
