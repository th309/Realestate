import { describe, it, expect } from "vitest";
import { computeBrrrrScore } from "./brrrr";

const financing = {
  downPaymentPct: 0.2,
  interestRatePct: 7.1,
  termYears: 30,
  closingCostsPct: 0.03,
};

describe("computeBrrrrScore", () => {
  it("strong BRRRR: full cash-out, positive post-refi cashflow", () => {
    const r = computeBrrrrScore({
      price: 100_000,
      arv: 200_000,
      rehabBudget: 30_000,
      rentMonthly: 1_800,
      taxAnnual: 2_000,
      insuranceAnnual: 800,
      refinanceLTVPct: 0.75,
      financing,
    });
    // 75% of $200k ARV = $150k cash-out
    expect(r.refinanceCashOut).toBe(0.75 * 200_000);
    // total in = price + rehab + closing = 100k + 30k + 3k = 133k → remaining = 133k - 150k = -17k (cash back)
    expect(r.remainingCashInDeal).toBeLessThan(0);
    expect(r.score).toBeGreaterThanOrEqual(8);
    expect(r.rating).toBe("EXCELLENT");
  });

  it("weak BRRRR: leaves significant cash, low cashflow", () => {
    const r = computeBrrrrScore({
      price: 300_000,
      arv: 320_000,
      rehabBudget: 10_000,
      rentMonthly: 1_800,
      taxAnnual: 4_000,
      insuranceAnnual: 1_500,
      financing,
    });
    expect(r.remainingCashInDeal).toBeGreaterThan(0);
    expect(r.score).toBeLessThan(5);
  });

  it("null rent collapses score to 0", () => {
    const r = computeBrrrrScore({
      price: 100_000,
      arv: 200_000,
      rehabBudget: 20_000,
      rentMonthly: null,
      taxAnnual: 2_000,
      insuranceAnnual: 800,
      financing,
    });
    expect(r.score).toBe(0);
    expect(r.rating).toBe("POOR");
  });
});
