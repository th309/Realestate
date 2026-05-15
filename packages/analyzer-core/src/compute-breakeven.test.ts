import { describe, it, expect } from "vitest";
import { computeBreakEven } from "./compute-breakeven";
import type { DealInput } from "./types";

const validInput: DealInput = {
  price: 240_000,
  rentMonthly: 2_850,
  taxAnnual: 3_800,
  insuranceAnnual: 1_200,
  financing: { downPaymentPct: 0.2, interestRatePct: 7.1, termYears: 30 },
};

describe("computeBreakEven", () => {
  it("break-even rent is less than current rent for cashflowing deal", () => {
    const r = computeBreakEven(validInput);
    expect(r.rentMonthly).toBeLessThan(validInput.rentMonthly!);
  });
  it("cushion is positive percentage", () => {
    const r = computeBreakEven(validInput);
    expect(r.rentCushionPct).toBeGreaterThan(0);
    expect(r.occupancyCushionPct).toBeGreaterThan(0);
  });
  it("returns occupancy between 0 and 1", () => {
    const r = computeBreakEven(validInput);
    expect(r.occupancy).toBeGreaterThanOrEqual(0);
    expect(r.occupancy).toBeLessThanOrEqual(1);
  });
});
