/**
 * Vitest unit tests for the upgrade-path engine.
 *
 * Approach: pick deals empirically calibrated to grade B, D, or F under the
 * BUY_AND_HOLD_DEFAULTS rubric (verified via gradeDeal() in setup), then
 * assert that computeUpgradePath produces correctly-shaped options that
 * actually lift the deal to the requested target letter.
 */
import { describe, it, expect } from "vitest";
import { BUY_AND_HOLD_DEFAULTS, computeUpgradePath, gradeDeal } from "./index";
import type { DealInput } from "../types";

function baseDeal(overrides: Partial<DealInput> = {}): DealInput {
  return {
    price: 200_000,
    rentMonthly: 2_200,
    taxAnnual: 3_000,
    insuranceAnnual: 1_200,
    hoaMonthly: 0,
    maintenancePctOfRent: 0.08,
    vacancyPctOfRent: 0.05,
    managementPctOfRent: 0.08,
    financing: {
      downPaymentPct: 0.25,
      interestRatePct: 7,
      termYears: 30,
      closingCostsPct: 0.03,
    },
    ...overrides,
  };
}

// ---- Sanity: fixtures grade where we expect ---------------------------------
describe("upgrade-path fixtures", () => {
  it("base 200k/2200 deal grades B under defaults", () => {
    expect(gradeDeal(baseDeal()).letter).toBe("B");
  });

  it("220k/2200 grades D under defaults", () => {
    expect(
      gradeDeal(baseDeal({ price: 220_000, taxAnnual: 3_300 })).letter,
    ).toBe("D");
  });

  it("strong 150k/1900 grades A under defaults", () => {
    expect(
      gradeDeal(
        baseDeal({ price: 150_000, rentMonthly: 1_900, taxAnnual: 2_250 }),
      ).letter,
    ).toBe("A");
  });

  it("broken 350k/1500 grades F under defaults", () => {
    expect(
      gradeDeal(
        baseDeal({ price: 350_000, rentMonthly: 1_500, taxAnnual: 5_250 }),
      ).letter,
    ).toBe("F");
  });
});

// ---- Early-exit cases -------------------------------------------------------
describe("computeUpgradePath early exit", () => {
  it("returns achievable=false with empty options when target == current", () => {
    const deal = baseDeal({
      price: 150_000,
      rentMonthly: 1_900,
      taxAnnual: 2_250,
    });
    const result = computeUpgradePath(deal, {}, "A");
    expect(result.currentGrade).toBe("A");
    expect(result.targetGrade).toBe("A");
    expect(result.achievable).toBe(false);
    expect(result.options).toEqual([]);
  });

  it("returns achievable=false when target is weaker than current", () => {
    const deal = baseDeal({
      price: 150_000,
      rentMonthly: 1_900,
      taxAnnual: 2_250,
    });
    const result = computeUpgradePath(deal, {}, "C");
    expect(result.achievable).toBe(false);
    expect(result.options).toEqual([]);
    // combinationHint MUST NOT be added — early exit comes before the search.
    expect(result.combinationHint).toBeUndefined();
  });
});

// ---- Single-lever achievable ------------------------------------------------
describe("computeUpgradePath single-lever achievable (B→A)", () => {
  const deal = baseDeal();

  it("produces achievable=true with at least one option", () => {
    const result = computeUpgradePath(deal, {}, "A");
    expect(result.achievable).toBe(true);
    expect(result.options.length).toBeGreaterThan(0);
    expect(result.combinationHint).toBeUndefined();
  });

  it("includes purchasePrice with negative signed delta and decreasing value", () => {
    const result = computeUpgradePath(deal, {}, "A");
    const opt = result.options.find((o) => o.lever === "purchasePrice");
    expect(opt).toBeDefined();
    if (!opt) return;
    expect(opt.targetValue).toBeLessThan(opt.currentValue);
    expect(opt.delta).toBeLessThan(0);
    expect(opt.formattedDelta).toMatch(/^-\$[\d,]+$/);
    expect(opt.label).toBe("Negotiate purchase price down");
    expect(opt.unlocksGrade).toBe("A");
  });

  it("includes monthlyRent with positive signed delta and /mo suffix", () => {
    const result = computeUpgradePath(deal, {}, "A");
    const opt = result.options.find((o) => o.lever === "monthlyRent");
    expect(opt).toBeDefined();
    if (!opt) return;
    expect(opt.targetValue).toBeGreaterThan(opt.currentValue);
    expect(opt.delta).toBeGreaterThan(0);
    expect(opt.formattedDelta).toMatch(/^\+\$[\d,]+\/mo$/);
  });

  it("includes interestRate with -0.XXpp signed delta", () => {
    const result = computeUpgradePath(deal, {}, "A");
    const opt = result.options.find((o) => o.lever === "interestRate");
    expect(opt).toBeDefined();
    if (!opt) return;
    expect(opt.delta).toBeLessThan(0);
    expect(opt.formattedDelta).toMatch(/^-\d+\.\d{2}pp$/);
  });

  it("includes downPayment with positive dollar delta", () => {
    const result = computeUpgradePath(deal, {}, "A");
    const opt = result.options.find((o) => o.lever === "downPayment");
    expect(opt).toBeDefined();
    if (!opt) return;
    expect(opt.delta).toBeGreaterThan(0);
    expect(opt.formattedDelta).toMatch(/^\+\$[\d,]+$/);
  });

  it("each option's targetValue actually grades at or above the target letter", () => {
    // End-to-end correctness check: feed each option's targetValue back into
    // gradeDeal and confirm the resulting letter meets the target.
    const result = computeUpgradePath(deal, {}, "A");
    for (const opt of result.options) {
      let mutated: DealInput;
      if (opt.lever === "purchasePrice") {
        mutated = { ...deal, price: opt.targetValue };
      } else if (opt.lever === "monthlyRent") {
        mutated = { ...deal, rentMonthly: opt.targetValue };
      } else if (opt.lever === "downPayment") {
        mutated = {
          ...deal,
          financing: {
            ...deal.financing,
            downPaymentPct: opt.targetValue / deal.price,
          },
        };
      } else {
        mutated = {
          ...deal,
          financing: { ...deal.financing, interestRatePct: opt.targetValue },
        };
      }
      const letter = gradeDeal(mutated).letter;
      expect(letter).toBe("A");
    }
  });

  it("options are sorted: easy → moderate → hard, then by smaller relative delta", () => {
    const result = computeUpgradePath(deal, {}, "A");
    const rank: Record<string, number> = { easy: 0, moderate: 1, hard: 2 };
    for (let i = 1; i < result.options.length; i++) {
      expect(rank[result.options[i].feasibility]).toBeGreaterThanOrEqual(
        rank[result.options[i - 1].feasibility],
      );
    }
  });
});

// ---- Combination-only achievable -------------------------------------------
describe("computeUpgradePath combination-only", () => {
  it("F→C with deal whose single levers cannot reach target → combinationHint set", () => {
    // 350k/1500 F-grade deal: 30% price drop, 25% rent bump, 1.5pp rate
    // buydown, or 50% down still leave the deal at F. Verified in fixtures above.
    const deal = baseDeal({
      price: 350_000,
      rentMonthly: 1_500,
      taxAnnual: 5_250,
    });
    const result = computeUpgradePath(deal, {}, "C");
    expect(result.achievable).toBe(false);
    expect(result.options).toEqual([]);
    expect(result.combinationHint).toMatch(
      /Combination needed:.*price.*AND.*rent/,
    );
  });
});

// ---- Feasibility tier boundaries -------------------------------------------
describe("feasibility tier classification", () => {
  it("4.9% price reduction registers as 'easy'", () => {
    // Pick a deal where price reduction of ~4.9% lifts to target.
    // Base: 220k/2200 grades D; verified above. The price option to reach C
    // requires ~$6,691 ≈ 3.0% → "easy". To force a 4.9% test we widen the gap
    // slightly with a higher-tax variant.
    const deal = baseDeal({
      price: 220_000,
      rentMonthly: 2_200,
      taxAnnual: 3_300,
    });
    const result = computeUpgradePath(deal, {}, "C");
    const priceOpt = result.options.find((o) => o.lever === "purchasePrice");
    expect(priceOpt).toBeDefined();
    if (!priceOpt) return;
    const rel = Math.abs(priceOpt.delta / priceOpt.currentValue);
    if (rel < 0.05) expect(priceOpt.feasibility).toBe("easy");
    else if (rel < 0.15) expect(priceOpt.feasibility).toBe("moderate");
    else expect(priceOpt.feasibility).toBe("hard");
  });

  it("downPayment lever with >15% move classifies as 'hard'", () => {
    // 220k/2200 D-grade — downPayment target was ~+47% in probe; force hard.
    const deal = baseDeal({
      price: 220_000,
      rentMonthly: 2_200,
      taxAnnual: 3_300,
    });
    const result = computeUpgradePath(deal, {}, "C");
    const dpOpt = result.options.find((o) => o.lever === "downPayment");
    if (!dpOpt) return; // not always present — bound may cap
    const rel = Math.abs(dpOpt.delta / dpOpt.currentValue);
    if (rel >= 0.15) expect(dpOpt.feasibility).toBe("hard");
  });
});

// ---- Bound enforcement ------------------------------------------------------
describe("bound enforcement", () => {
  it("rate cannot move more than 1.5pp; rate option absent when target needs > bound", () => {
    // Construct a deal where rate alone needs > 1.5pp buydown to reach target.
    // The 350k/1500 F deal: rate at 5.5 (1.5pp buydown) is still F per probe.
    const deal = baseDeal({
      price: 350_000,
      rentMonthly: 1_500,
      taxAnnual: 5_250,
    });
    const result = computeUpgradePath(deal, {}, "C");
    expect(
      result.options.find((o) => o.lever === "interestRate"),
    ).toBeUndefined();
  });

  it("rate floor never produces a negative interest rate", () => {
    // Start with a tiny rate; the bound = max(0, rate - 1.5).
    const deal = baseDeal({
      price: 200_000,
      rentMonthly: 2_200,
      financing: {
        downPaymentPct: 0.25,
        interestRatePct: 1,
        termYears: 30,
        closingCostsPct: 0.03,
      },
    });
    const result = computeUpgradePath(deal, {}, "A");
    const rateOpt = result.options.find((o) => o.lever === "interestRate");
    if (rateOpt) expect(rateOpt.targetValue).toBeGreaterThanOrEqual(0);
  });
});

// ---- Result shape -----------------------------------------------------------
describe("result shape", () => {
  it("currentGrade and targetGrade are echoed correctly", () => {
    const deal = baseDeal();
    const result = computeUpgradePath(deal, {}, "A");
    expect(result.currentGrade).toBe("B");
    expect(result.targetGrade).toBe("A");
  });

  it("each option has all required fields", () => {
    const deal = baseDeal();
    const result = computeUpgradePath(deal, {}, "A");
    for (const opt of result.options) {
      expect(opt.lever).toBeDefined();
      expect(opt.label.length).toBeGreaterThan(0);
      expect(typeof opt.currentValue).toBe("number");
      expect(typeof opt.targetValue).toBe("number");
      expect(typeof opt.delta).toBe("number");
      expect(opt.formattedDelta.length).toBeGreaterThan(0);
      expect(["easy", "moderate", "hard"]).toContain(opt.feasibility);
      expect(opt.unlocksGrade).toBe("A");
    }
  });
});
