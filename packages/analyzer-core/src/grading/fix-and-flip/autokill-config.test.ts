import { describe, it, expect } from "vitest";
import { FIX_AND_FLIP_DEFAULTS } from "./thresholds";
import type { FixAndFlipThresholds } from "./types";
import { gradeFixAndFlipDeal } from "./grade";
import type { FixAndFlipInput } from "./types";

/** Thin-profit flip: profit > 0 but < $10k — trips PROFIT_BELOW_FLOOR only. */
const THIN_FLIP: FixAndFlipInput = {
  price: 200_000,
  arv: 260_000,
  rehabBudget: 30_000,
  holdingMonths: 6,
  sellingCostsPct: 0.07,
  financingType: "cash",
};

const withAutoKills = (
  autoKills: FixAndFlipThresholds["autoKills"],
): FixAndFlipThresholds => ({ ...FIX_AND_FLIP_DEFAULTS, autoKills });

describe("F&F auto-kill config", () => {
  it("no config equals explicit default config", () => {
    const bare = gradeFixAndFlipDeal(THIN_FLIP, {});
    const configured = gradeFixAndFlipDeal(
      THIN_FLIP,
      {},
      withAutoKills({
        projectLoss: { enabled: true },
        minNetProfit: { enabled: true, value: 10_000 },
        rehabContingency: { enabled: true, value: 0.1 },
        extremeHold: { enabled: true, value: 2 },
      }),
    );
    expect(configured).toEqual(bare);
  });

  it("lower minNetProfit floor clears PROFIT_BELOW_FLOOR", () => {
    const bare = gradeFixAndFlipDeal(THIN_FLIP, {});
    expect(bare.autoKills.map((k) => k.code)).toContain("PROFIT_BELOW_FLOOR");

    const r = gradeFixAndFlipDeal(
      THIN_FLIP,
      {},
      withAutoKills({ minNetProfit: { value: 0 } }),
    );
    expect(r.autoKills.map((k) => k.code)).not.toContain("PROFIT_BELOW_FLOOR");
  });

  it("config value takes precedence over context.minimumNetProfit", () => {
    const r = gradeFixAndFlipDeal(
      THIN_FLIP,
      { minimumNetProfit: 50_000 },
      withAutoKills({ minNetProfit: { value: 0 } }),
    );
    expect(r.autoKills.map((k) => k.code)).not.toContain("PROFIT_BELOW_FLOOR");
  });

  it("disabling minNetProfit suppresses the kill entirely", () => {
    const r = gradeFixAndFlipDeal(
      THIN_FLIP,
      {},
      withAutoKills({ minNetProfit: { enabled: false } }),
    );
    expect(r.autoKills.map((k) => k.code)).not.toContain("PROFIT_BELOW_FLOOR");
  });
});
