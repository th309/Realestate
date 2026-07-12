import { describe, it, expect } from "vitest";
import {
  autoKillRowsForStrategy,
  getAutoKillConfig,
  hasAnyAutoKillError,
  validateAutoKills,
} from "../autokill-rows";

describe("autoKillRowsForStrategy", () => {
  it("returns 4 rows per strategy with stable keys", () => {
    expect(autoKillRowsForStrategy("BUY_AND_HOLD").map((r) => r.key)).toEqual([
      "dscrFloor",
      "taxInsShareOfRent",
      "floodNoInsurance",
      "negativeCashflowNoAck",
    ]);
    expect(autoKillRowsForStrategy("FIX_AND_FLIP").map((r) => r.key)).toEqual([
      "projectLoss",
      "minNetProfit",
      "rehabContingency",
      "extremeHold",
    ]);
    expect(autoKillRowsForStrategy("BRRRR").map((r) => r.key)).toEqual([
      "refiDscrFloor",
      "negativePostRefiCashflow",
      "rehabContingency",
      "maxCashLeft",
    ]);
  });

  it("numeric rows carry engine defaults; toggle-only rows carry null", () => {
    const bh = autoKillRowsForStrategy("BUY_AND_HOLD");
    expect(bh.find((r) => r.key === "dscrFloor")?.defaultValue).toBe(1.0);
    expect(bh.find((r) => r.key === "floodNoInsurance")?.defaultValue).toBe(
      null,
    );
  });
});

describe("getAutoKillConfig", () => {
  it("returns {} for null or missing block", () => {
    expect(getAutoKillConfig(null)).toEqual({});
    expect(getAutoKillConfig({ weights: {} })).toEqual({});
  });
  it("returns the block when present", () => {
    expect(
      getAutoKillConfig({ autoKills: { dscrFloor: { value: 0.9 } } }),
    ).toEqual({ dscrFloor: { value: 0.9 } });
  });
});

describe("validateAutoKills", () => {
  it("passes an empty config", () => {
    const errs = validateAutoKills("BUY_AND_HOLD", undefined);
    expect(hasAnyAutoKillError(errs)).toBe(false);
  });
  it("flags out-of-bounds values with the row bounds", () => {
    const errs = validateAutoKills("BUY_AND_HOLD", {
      dscrFloor: { value: 0.1 },
    });
    expect(errs.dscrFloor).toMatch(/0\.3/);
    expect(hasAnyAutoKillError(errs)).toBe(true);
  });
  it("accepts in-bounds values and toggle-only rules", () => {
    const errs = validateAutoKills("FIX_AND_FLIP", {
      minNetProfit: { value: 5_000 },
      projectLoss: { enabled: false },
    });
    expect(hasAnyAutoKillError(errs)).toBe(false);
  });
});
