import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  computeRentalMetrics,
  computeFlipMetrics,
  computeBrrrrScore,
} from "./index";

// fc.float in fast-check v3 requires 32-bit float bounds; fc.double accepts
// arbitrary JS doubles, which matches how analyzer-core treats inputs.
const financingArb = fc.record({
  downPaymentPct: fc.double({ min: 0, max: 1, noNaN: true }),
  interestRatePct: fc.double({ min: 0, max: 15, noNaN: true }),
  termYears: fc.integer({ min: 5, max: 40 }),
  closingCostsPct: fc.double({ min: 0, max: 0.1, noNaN: true }),
});

const dealArb = fc.record({
  price: fc.double({ min: 1, max: 5_000_000, noNaN: true }),
  rentMonthly: fc.option(fc.double({ min: 100, max: 20_000, noNaN: true }), {
    nil: null,
  }),
  taxAnnual: fc.option(fc.double({ min: 0, max: 50_000, noNaN: true }), {
    nil: null,
  }),
  insuranceAnnual: fc.option(fc.double({ min: 0, max: 20_000, noNaN: true }), {
    nil: null,
  }),
  financing: financingArb,
});

describe("rental invariants", () => {
  it("never throws on any valid input", () => {
    fc.assert(
      fc.property(dealArb, (input) => {
        expect(() => computeRentalMetrics(input)).not.toThrow();
      }),
      { numRuns: 500 },
    );
  });

  it("totalCashInvested = price * (down + closing)", () => {
    fc.assert(
      fc.property(dealArb, (input) => {
        const r = computeRentalMetrics(input);
        const expected =
          input.price *
          (input.financing.downPaymentPct +
            (input.financing.closingCostsPct ?? 0.03));
        expect(r.totalCashInvested).toBeCloseTo(expected, 6);
      }),
    );
  });

  it("null rent ⇒ null rental outputs", () => {
    fc.assert(
      fc.property(
        dealArb.filter((d) => d.rentMonthly == null),
        (input) => {
          const r = computeRentalMetrics(input);
          expect(r.capRatePct).toBeNull();
          expect(r.cashflowMonthly).toBeNull();
          expect(r.dscr).toBeNull();
        },
      ),
    );
  });
});

describe("flip invariants", () => {
  const flipArb = fc.record({
    price: fc.double({ min: 0, max: 1_000_000, noNaN: true }),
    arv: fc.double({ min: 1, max: 2_000_000, noNaN: true }),
    rehabBudget: fc.double({ min: 0, max: 500_000, noNaN: true }),
    sellingCostsPct: fc.double({ min: 0, max: 0.2, noNaN: true }),
  });

  it("mao70 < arv when rehab > 0", () => {
    fc.assert(
      fc.property(
        flipArb.filter((f) => f.rehabBudget > 0),
        (input) => {
          const r = computeFlipMetrics(input);
          expect(r.mao70).toBeLessThan(input.arv);
        },
      ),
    );
  });

  it("wholetailMax > mao70", () => {
    fc.assert(
      fc.property(flipArb, (input) => {
        const r = computeFlipMetrics(input);
        expect(r.wholetailMax).toBeGreaterThan(r.mao70);
      }),
    );
  });
});
