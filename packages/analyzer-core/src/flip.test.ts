import { describe, it, expect } from "vitest";
import { computeFlipMetrics } from "./flip";

describe("computeFlipMetrics", () => {
  it("70% rule and wholetail caps", () => {
    const r = computeFlipMetrics({
      price: 200_000,
      arv: 350_000,
      rehabBudget: 50_000,
    });
    expect(r.mao70).toBe(0.7 * 350_000 - 50_000); // 195,000
    expect(r.wholetailMax).toBe(0.8 * 350_000 - 50_000); // 230,000
  });

  it("projected profit uses default holding + selling defaults", () => {
    const r = computeFlipMetrics({
      price: 150_000,
      arv: 250_000,
      rehabBudget: 30_000,
    });
    // sellingCosts default 0.07 → 17,500. holdingMonths default 4 → ~property tax/util est not modeled. profit = ARV - sellingCosts - price - rehab.
    expect(r.projectedProfit).toBe(250_000 - 0.07 * 250_000 - 150_000 - 30_000);
    expect(r.projectedRoiPct).toBeCloseTo(
      (r.projectedProfit / (150_000 + 30_000)) * 100,
      1,
    );
  });

  it("allows custom selling cost", () => {
    const r = computeFlipMetrics({
      price: 100_000,
      arv: 200_000,
      rehabBudget: 20_000,
      sellingCostsPct: 0.1,
    });
    expect(r.projectedProfit).toBe(200_000 - 20_000 - 100_000 - 20_000);
  });

  it("mao70 must be < arv", () => {
    const r = computeFlipMetrics({
      price: 0,
      arv: 300_000,
      rehabBudget: 10_000,
    });
    expect(r.mao70).toBeLessThan(300_000);
  });
});
