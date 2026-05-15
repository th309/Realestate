import { describe, it, expect } from "vitest";
import { computeSensitivity } from "./compute-sensitivity";
import type { DealInput } from "./types";

const validInput: DealInput = {
  price: 240_000,
  rentMonthly: 2_850,
  taxAnnual: 3_800,
  insuranceAnnual: 1_200,
  financing: { downPaymentPct: 0.2, interestRatePct: 7.1, termYears: 30 },
};

describe("computeSensitivity", () => {
  it("returns 6 factors", () => {
    const r = computeSensitivity(validInput);
    expect(r.factors).toHaveLength(6);
    const names = r.factors.map((f) => f.name).sort();
    expect(names).toEqual(
      ["exitCap", "insurance", "rate", "rent", "taxes", "vacancy"].sort(),
    );
  });

  it("each factor has irrAtMinus10pct and irrAtPlus10pct", () => {
    const r = computeSensitivity(validInput);
    r.factors.forEach((f) => {
      expect(typeof f.irrAtMinus10pct).toBe("number");
      expect(typeof f.irrAtPlus10pct).toBe("number");
      expect(typeof f.impactMagnitude).toBe("number");
    });
  });

  it("rate has greater impactMagnitude than insurance (high-leverage effect)", () => {
    const r = computeSensitivity(validInput);
    const rateF = r.factors.find((f) => f.name === "rate")!;
    const insF = r.factors.find((f) => f.name === "insurance")!;
    expect(rateF.impactMagnitude).toBeGreaterThan(insF.impactMagnitude);
  });
});
