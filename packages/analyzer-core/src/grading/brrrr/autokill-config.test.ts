import { describe, it, expect } from "vitest";
import { BRRRR_DEFAULTS } from "./thresholds";
import type { BrrrrGradingInput, BrrrrThresholds } from "./types";
import { gradeBrrrrDeal } from "./grade";

/** Weak BRRRR: low rent vs refi debt → post-refi DSCR < 1 + negative CF. */
const WEAK_BRRRR: BrrrrGradingInput = {
  purchasePrice: 200_000,
  arv: 280_000,
  rehabCost: 40_000,
  holdMonthsBeforeRefi: 6,
  initialFinancingType: "cash",
  propertyTaxAnnual: 3_600,
  insuranceAnnual: 1_800,
  refiLtvPct: 0.75,
  refiRate: 7.5,
  refiTermYears: 30,
  monthlyRent: 1_200,
};

const withAutoKills = (
  autoKills: BrrrrThresholds["autoKills"],
): BrrrrThresholds => ({ ...BRRRR_DEFAULTS, autoKills });

describe("BRRRR auto-kill config", () => {
  it("no config equals explicit default config", () => {
    const bare = gradeBrrrrDeal(WEAK_BRRRR, {});
    const configured = gradeBrrrrDeal(
      WEAK_BRRRR,
      {},
      withAutoKills({
        refiDscrFloor: { enabled: true, value: 1.0 },
        negativePostRefiCashflow: { enabled: true },
        rehabContingency: { enabled: true, value: 0.1 },
        maxCashLeft: { enabled: true, value: 10_000 },
      }),
    );
    expect(configured).toEqual(bare);
  });

  it("bare run trips the refi-financeability kill (fixture sanity)", () => {
    const bare = gradeBrrrrDeal(WEAK_BRRRR, {});
    expect(bare.autoKills.map((k) => k.code)).toContain("REFI_NOT_FINANCEABLE");
  });

  it("lower refi DSCR floor suppresses REFI_NOT_FINANCEABLE", () => {
    const r = gradeBrrrrDeal(
      WEAK_BRRRR,
      {},
      withAutoKills({ refiDscrFloor: { value: 0.1 } }),
    );
    expect(r.autoKills.map((k) => k.code)).not.toContain(
      "REFI_NOT_FINANCEABLE",
    );
  });

  it("disabling all four rules yields zero auto-kills", () => {
    const r = gradeBrrrrDeal(
      WEAK_BRRRR,
      {},
      withAutoKills({
        refiDscrFloor: { enabled: false },
        negativePostRefiCashflow: { enabled: false },
        rehabContingency: { enabled: false },
        maxCashLeft: { enabled: false },
      }),
    );
    expect(r.autoKills).toEqual([]);
  });

  it("config maxCashLeft wins over context.maximumCashToLeave", () => {
    const r = gradeBrrrrDeal(
      WEAK_BRRRR,
      { maximumCashToLeave: 1 },
      withAutoKills({ maxCashLeft: { value: 10_000_000 } }),
    );
    expect(r.autoKills.map((k) => k.code)).not.toContain(
      "CASH_LEFT_EXCEEDS_MAXIMUM",
    );
  });
});
