import { describe, it, expect } from "vitest";
import { AUTOKILL_DEFAULTS, ruleEnabled, ruleValue } from "./autokill-config";

describe("auto-kill config resolver", () => {
  it("ruleEnabled defaults to true when config or field is absent", () => {
    expect(ruleEnabled(undefined)).toBe(true);
    expect(ruleEnabled({})).toBe(true);
    expect(ruleEnabled({ enabled: true })).toBe(true);
    expect(ruleEnabled({ enabled: false })).toBe(false);
  });

  it("ruleValue falls back when config or value is absent", () => {
    expect(ruleValue(undefined, 1.0)).toBe(1.0);
    expect(ruleValue({}, 1.0)).toBe(1.0);
    expect(ruleValue({ value: 0.85 }, 1.0)).toBe(0.85);
    expect(ruleValue({ enabled: false, value: 0.85 }, 1.0)).toBe(0.85);
  });

  it("AUTOKILL_DEFAULTS mirror today's hardcoded literals", () => {
    expect(AUTOKILL_DEFAULTS.BUY_AND_HOLD).toEqual({
      dscrFloor: 1.0,
      taxInsShareOfRent: 0.4,
    });
    expect(AUTOKILL_DEFAULTS.FIX_AND_FLIP).toEqual({
      minNetProfit: 10_000,
      rehabContingency: 0.1,
      extremeHold: 2,
    });
    expect(AUTOKILL_DEFAULTS.BRRRR).toEqual({
      refiDscrFloor: 1.0,
      rehabContingency: 0.1,
      maxCashLeft: 10_000,
    });
  });
});
