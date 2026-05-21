import { describe, it, expect } from "vitest";
import { computeBrrrrTimeline } from "./compute-brrrr-timeline";
import type { BrrrrInput } from "./types";

const validInput: BrrrrInput = {
  price: 165_000,
  rentMonthly: 2_500,
  taxAnnual: 2_400,
  insuranceAnnual: 1_000,
  arv: 300_000,
  rehabBudget: 45_000,
  financing: { downPaymentPct: 0.25, interestRatePct: 9.5, termYears: 30 },
};

describe("computeBrrrrTimeline", () => {
  it("returns 6 phases in order", () => {
    const r = computeBrrrrTimeline(validInput);
    expect(r.phases.map((p) => p.id)).toEqual([
      "buy",
      "rehab",
      "lease",
      "season",
      "refi",
      "stabilized",
    ]);
  });

  it("each phase starts where prior ends", () => {
    const r = computeBrrrrTimeline(validInput);
    for (let i = 1; i < r.phases.length; i++) {
      expect(r.phases[i].monthStart).toBe(r.phases[i - 1].monthEnd);
    }
  });

  it("final phase is open-ended", () => {
    const r = computeBrrrrTimeline(validInput);
    expect(r.phases[r.phases.length - 1].monthEnd).toBeNull();
  });

  it("default monthsToFirstRefi sums rehab + lease + season", () => {
    const r = computeBrrrrTimeline(validInput);
    expect(r.monthsToFirstRefi).toBe(10);
  });

  it("custom phase durations propagate", () => {
    const r = computeBrrrrTimeline(validInput, {
      rehabMonths: 4,
      leaseMonths: 2,
      seasoningMonths: 6,
    });
    expect(r.monthsToFirstRefi).toBe(12);
  });
});
