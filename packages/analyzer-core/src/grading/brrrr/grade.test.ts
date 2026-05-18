/**
 * Vitest tests for the BRRRR grading orchestrator. Covers validation, auto-
 * kill triggers (REFI_NOT_FINANCEABLE / NEGATIVE_POST_REFI_CASHFLOW /
 * REHAB_UNVERIFIED_NO_CONTINGENCY / CASH_LEFT_EXCEEDS_MAXIMUM), floor caps
 * (cash_left F→C, post_refi_dscr F→D), advisory toggling, and integration
 * scenarios.
 */
import { describe, expect, it } from "vitest";
import { gradeBrrrrDeal } from "./grade";
import {
  cashLeftInDeal,
  postRefiCashFlowMonthly,
  postRefiDSCR,
} from "./metrics";
import { cashBrrrr, indianapolisBrrrr, stuckBrrrr } from "./test-fixtures";
import { BRRRR_DEFAULTS } from "./thresholds";
import type { BrrrrContext, BrrrrThresholds } from "./types";

// ---- Validation ------------------------------------------------------------

describe("gradeBrrrrDeal validation", () => {
  it("throws when purchasePrice is non-positive", () => {
    expect(() =>
      gradeBrrrrDeal(indianapolisBrrrr({ purchasePrice: 0 })),
    ).toThrow(/purchasePrice/);
  });

  it("throws when arv is non-positive", () => {
    expect(() => gradeBrrrrDeal(indianapolisBrrrr({ arv: 0 }))).toThrow(/arv/);
  });

  it("throws when monthlyRent is non-positive", () => {
    expect(() => gradeBrrrrDeal(indianapolisBrrrr({ monthlyRent: 0 }))).toThrow(
      /monthlyRent/,
    );
  });

  it("throws when refiTermYears is non-positive", () => {
    expect(() =>
      gradeBrrrrDeal(indianapolisBrrrr({ refiTermYears: 0 })),
    ).toThrow(/refiTermYears/);
  });
});

// ---- Result shape ----------------------------------------------------------

describe("gradeBrrrrDeal result shape", () => {
  it("returns the 5 graded metrics in a fixed order", () => {
    const r = gradeBrrrrDeal(indianapolisBrrrr());
    expect(r.metrics.map((m) => m.key)).toEqual([
      "cash_left_in_deal",
      "all_in_to_arv_ratio",
      "post_refi_dscr",
      "post_refi_cash_flow_per_door",
      "time_to_refinance_months",
    ]);
  });

  it("weights in defaults sum to 100", () => {
    const w = BRRRR_DEFAULTS.weights;
    const sum =
      w.cash_left_in_deal +
      w.all_in_to_arv_ratio +
      w.post_refi_dscr +
      w.post_refi_cash_flow_per_door +
      w.time_to_refinance_months;
    expect(sum).toBe(100);
  });
});

// ---- Auto-kills ------------------------------------------------------------

describe("auto-kill triggers", () => {
  it("REFI_NOT_FINANCEABLE: postRefiDSCR < 1.0 forces F", () => {
    const d = stuckBrrrr();
    expect(postRefiDSCR(d)).toBeLessThan(1.0);
    const r = gradeBrrrrDeal(d);
    expect(r.letter).toBe("F");
    expect(r.autoKills.map((k) => k.code)).toContain("REFI_NOT_FINANCEABLE");
  });

  it("REFI_NOT_FINANCEABLE suppressed when negativeCashFlowAccepted", () => {
    const r = gradeBrrrrDeal(stuckBrrrr(), { negativeCashFlowAccepted: true });
    expect(r.autoKills.map((k) => k.code)).not.toContain(
      "REFI_NOT_FINANCEABLE",
    );
  });

  it("NEGATIVE_POST_REFI_CASHFLOW: monthly CF < 0 forces F", () => {
    const d = stuckBrrrr();
    expect(postRefiCashFlowMonthly(d)).toBeLessThan(0);
    const r = gradeBrrrrDeal(d);
    expect(r.autoKills.map((k) => k.code)).toContain(
      "NEGATIVE_POST_REFI_CASHFLOW",
    );
  });

  it("REHAB_UNVERIFIED_NO_CONTINGENCY: estimate + <10% contingency + unaccepted → F", () => {
    const d = indianapolisBrrrr({ rehabContingencyPct: 0.05 });
    const r = gradeBrrrrDeal(d, { rehabVerification: "estimate" });
    expect(r.letter).toBe("F");
    expect(r.autoKills.map((k) => k.code)).toContain(
      "REHAB_UNVERIFIED_NO_CONTINGENCY",
    );
  });

  it("REHAB_UNVERIFIED suppressed when rehabRiskAccepted", () => {
    const d = indianapolisBrrrr({ rehabContingencyPct: 0.05 });
    const r = gradeBrrrrDeal(d, {
      rehabVerification: "estimate",
      rehabRiskAccepted: true,
    });
    expect(r.autoKills.map((k) => k.code)).not.toContain(
      "REHAB_UNVERIFIED_NO_CONTINGENCY",
    );
  });

  it("CASH_LEFT_EXCEEDS_MAXIMUM: cash left above default $10k forces F", () => {
    const d = cashBrrrr();
    expect(cashLeftInDeal(d)).toBeGreaterThan(10_000);
    const r = gradeBrrrrDeal(d);
    expect(r.letter).toBe("F");
    expect(r.autoKills.map((k) => k.code)).toContain(
      "CASH_LEFT_EXCEEDS_MAXIMUM",
    );
  });

  it("CASH_LEFT suppressed when capitalTrappingAccepted", () => {
    const r = gradeBrrrrDeal(cashBrrrr(), { capitalTrappingAccepted: true });
    expect(r.autoKills.map((k) => k.code)).not.toContain(
      "CASH_LEFT_EXCEEDS_MAXIMUM",
    );
  });

  it("maximumCashToLeave context override raises the bar", () => {
    // Indianapolis has cash_left = 0 → never triggers. Force a non-zero
    // cash-left by lowering refiLtv so refi gives back less.
    const d = indianapolisBrrrr({ refiLtvPct: 0.5 });
    const r = gradeBrrrrDeal(d, { maximumCashToLeave: 1_000 });
    expect(r.autoKills.map((k) => k.code)).toContain(
      "CASH_LEFT_EXCEEDS_MAXIMUM",
    );
  });
});

// ---- Floor caps ------------------------------------------------------------

describe("floor caps", () => {
  it("cash_left_in_deal F caps letter at C (no auto-kill)", () => {
    // Make cash_left grade F by setting a ridiculous threshold; also accept
    // capital trapping so the auto-kill doesn't preempt the floor test.
    const customThresholds: BrrrrThresholds = {
      ...BRRRR_DEFAULTS,
      cash_left_in_deal: {
        A: -10,
        B: -20,
        C: -30,
        D: -40,
        direction: "lower_is_better",
      },
    };
    const ctx: BrrrrContext = { capitalTrappingAccepted: true };
    const r = gradeBrrrrDeal(indianapolisBrrrr(), ctx, customThresholds);
    const cashLeftGrade = r.metrics.find(
      (m) => m.key === "cash_left_in_deal",
    )?.grade;
    expect(cashLeftGrade).toBe("F");
    expect(r.autoKills).toHaveLength(0);
    expect(["C", "D"]).toContain(r.letter);
    expect(r.flooredAt).toBe("C");
  });

  it("post_refi_dscr F caps letter at D (no auto-kill, DSCR ≥ 1.0)", () => {
    // Tighten DSCR threshold so the strong Indianapolis deal grades F on
    // DSCR alone, without crossing the 1.0 auto-kill line.
    const customThresholds: BrrrrThresholds = {
      ...BRRRR_DEFAULTS,
      post_refi_dscr: {
        A: 5.0,
        B: 4.5,
        C: 4.0,
        D: 3.5,
        direction: "higher_is_better",
      },
    };
    const r = gradeBrrrrDeal(indianapolisBrrrr(), {}, customThresholds);
    const dscrGrade = r.metrics.find((m) => m.key === "post_refi_dscr")?.grade;
    expect(dscrGrade).toBe("F");
    expect(r.autoKills).toHaveLength(0);
    expect(r.letter).toBe("D");
    expect(r.flooredAt).toBe("D");
  });
});

// ---- Advisories ------------------------------------------------------------

describe("advisory inclusion", () => {
  it("rehab_contingency: pass at 10%, marginal at 6%, fail at 3%", () => {
    const ctx: BrrrrContext = { rehabRiskAccepted: true };
    const pass = gradeBrrrrDeal(
      indianapolisBrrrr({ rehabContingencyPct: 0.1 }),
      ctx,
    );
    const marginal = gradeBrrrrDeal(
      indianapolisBrrrr({ rehabContingencyPct: 0.06 }),
      ctx,
    );
    const fail = gradeBrrrrDeal(
      indianapolisBrrrr({ rehabContingencyPct: 0.03 }),
      ctx,
    );
    expect(
      pass.advisories.find((a) => a.key === "rehab_contingency")?.status,
    ).toBe("pass");
    expect(
      marginal.advisories.find((a) => a.key === "rehab_contingency")?.status,
    ).toBe("marginal");
    expect(
      fail.advisories.find((a) => a.key === "rehab_contingency")?.status,
    ).toBe("fail");
  });

  it("refi_seasoning_compliance: 6+ mo pass, 4-5 marginal, <4 fail", () => {
    const pass = gradeBrrrrDeal(indianapolisBrrrr({ holdMonthsBeforeRefi: 6 }));
    const marginal = gradeBrrrrDeal(
      indianapolisBrrrr({ holdMonthsBeforeRefi: 5 }),
    );
    const fail = gradeBrrrrDeal(indianapolisBrrrr({ holdMonthsBeforeRefi: 3 }));
    expect(
      pass.advisories.find((a) => a.key === "refi_seasoning_compliance")
        ?.status,
    ).toBe("pass");
    expect(
      marginal.advisories.find((a) => a.key === "refi_seasoning_compliance")
        ?.status,
    ).toBe("marginal");
    expect(
      fail.advisories.find((a) => a.key === "refi_seasoning_compliance")
        ?.status,
    ).toBe("fail");
  });

  it("post_refi_cap_rate advisory always emitted", () => {
    const r = gradeBrrrrDeal(indianapolisBrrrr());
    expect(
      r.advisories.find((a) => a.key === "post_refi_cap_rate"),
    ).toBeDefined();
  });
});

// ---- Integration -----------------------------------------------------------

describe("integration scenarios", () => {
  it("Indianapolis textbook BRRRR: lands A/B with no auto-kills", () => {
    const r = gradeBrrrrDeal(indianapolisBrrrr(), { marketPiqScore: 64 });
    expect(r.autoKills).toHaveLength(0);
    expect(["A", "B"]).toContain(r.letter);
    expect(r.marketAdjustment).toBe(0); // PIQ 64 sits in the neutral band
  });

  it("Indianapolis with PIQ 80 market gets +0.25 tailwind", () => {
    const r = gradeBrrrrDeal(indianapolisBrrrr(), { marketPiqScore: 80 });
    expect(r.marketAdjustment).toBe(0.25);
  });

  it("Indianapolis in a 30-PIQ market gets -0.50 penalty", () => {
    const r = gradeBrrrrDeal(indianapolisBrrrr(), { marketPiqScore: 30 });
    expect(r.marketAdjustment).toBe(-0.5);
  });

  it("stuck BRRRR triggers all three financial auto-kills", () => {
    const r = gradeBrrrrDeal(stuckBrrrr(), { marketPiqScore: 50 });
    expect(r.letter).toBe("F");
    const codes = r.autoKills.map((k) => k.code);
    expect(codes).toContain("REFI_NOT_FINANCEABLE");
    expect(codes).toContain("NEGATIVE_POST_REFI_CASHFLOW");
    expect(codes).toContain("CASH_LEFT_EXCEEDS_MAXIMUM");
  });

  it("cash BRRRR with capital trapping accepted: lands above F", () => {
    const r = gradeBrrrrDeal(cashBrrrr(), { capitalTrappingAccepted: true });
    expect(r.autoKills).toHaveLength(0);
    expect(["A", "B", "C", "D"]).toContain(r.letter);
  });
});
