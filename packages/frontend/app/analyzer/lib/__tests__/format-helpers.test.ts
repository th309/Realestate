import { describe, it, expect } from "vitest";
import {
  deriveVerdict,
  VERDICT_LETTER,
  VERDICT_LABEL,
  verdictColor,
  type Verdict,
} from "../format-helpers";

describe("deriveVerdict", () => {
  it("null cap rate → marginal (avoid 'avoid' on empty inputs)", () => {
    expect(
      deriveVerdict({
        capRatePct: null,
        dscr: null,
        cashflowMonthly: null,
        piqScore: null,
      }),
    ).toBe("marginal");
  });

  it.each<[number, number | null, number | null, Verdict]>([
    [9.0, 1.4, 500, "great"],
    [8.0, 1.3, 1, "great"],
    [7.0, 1.25, 400, "good"],
    [6.5, 1.2, 100, "good"],
    [5.5, 1.05, 50, "marginal"],
    [5.0, 1.0, 25, "marginal"],
    [4.0, 1.5, -50, "bad"],
    [3.5, 1.5, -50, "bad"],
  ])(
    "cap %s%% / DSCR %s / cashflow %s → %s",
    (cap, dscr, cashflow, expected) => {
      expect(
        deriveVerdict({
          capRatePct: cap,
          dscr,
          cashflowMonthly: cashflow,
          piqScore: null,
        }),
      ).toBe(expected);
    },
  );

  describe("hard floors → avoid", () => {
    it("cap < 3.5%", () => {
      expect(
        deriveVerdict({
          capRatePct: 3.4,
          dscr: 2.0,
          cashflowMonthly: 1000,
          piqScore: 90,
        }),
      ).toBe("avoid");
    });
    it("DSCR < 1.0", () => {
      expect(
        deriveVerdict({
          capRatePct: 9.0,
          dscr: 0.99,
          cashflowMonthly: 1000,
          piqScore: 90,
        }),
      ).toBe("avoid");
    });
  });

  describe("DSCR demotes within cap tier", () => {
    it("9% cap with DSCR 1.1 lands at marginal (great fails 1.3, good fails 1.2)", () => {
      expect(
        deriveVerdict({
          capRatePct: 9.0,
          dscr: 1.1,
          cashflowMonthly: 500,
          piqScore: null,
        }),
      ).toBe("marginal");
    });
  });

  describe("cashflow gates great tier", () => {
    it("8% cap with negative cashflow → good (not great)", () => {
      expect(
        deriveVerdict({
          capRatePct: 8.5,
          dscr: 1.4,
          cashflowMonthly: -50,
          piqScore: null,
        }),
      ).toBe("good");
    });
  });

  describe("PIQ market downgrade", () => {
    it("PIQ < 35 demotes great → good", () => {
      expect(
        deriveVerdict({
          capRatePct: 9.0,
          dscr: 1.4,
          cashflowMonthly: 500,
          piqScore: 28,
        }),
      ).toBe("good");
    });
    it("PIQ ≥ 35 has no effect", () => {
      expect(
        deriveVerdict({
          capRatePct: 9.0,
          dscr: 1.4,
          cashflowMonthly: 500,
          piqScore: 50,
        }),
      ).toBe("great");
    });
    it("PIQ < 35 cannot push below avoid", () => {
      expect(
        deriveVerdict({
          capRatePct: 4.0,
          dscr: 1.5,
          cashflowMonthly: -100,
          piqScore: 10,
        }),
      ).toBe("avoid");
    });
  });
});

describe("verdict lookups", () => {
  it("letter / label maps cover all 5 verdicts", () => {
    const verdicts: Verdict[] = ["great", "good", "marginal", "bad", "avoid"];
    verdicts.forEach((v) => {
      expect(VERDICT_LETTER[v]).toMatch(/^[A-F]$/);
      expect(VERDICT_LABEL[v].length).toBeGreaterThan(0);
      expect(verdictColor(v)).toMatch(/^var\(--piq-/);
    });
  });
});
