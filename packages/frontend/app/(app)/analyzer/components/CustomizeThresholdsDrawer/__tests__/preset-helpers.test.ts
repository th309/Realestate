import { describe, expect, it } from "vitest";
import { BALANCED_THRESHOLDS } from "@propertyiq/analyzer-core";
import { detectActivePreset } from "../preset-helpers";

describe("detectActivePreset", () => {
  it("ignores a populated autoKills block when matching against preset rubrics", () => {
    const withAutoKills = {
      ...BALANCED_THRESHOLDS,
      autoKills: { dscrFloor: { enabled: false } },
    };
    expect(detectActivePreset("BUY_AND_HOLD", withAutoKills)).toBe("balanced");
  });

  it("still returns null for a genuinely customized rubric, autoKills or not", () => {
    const customized = {
      ...BALANCED_THRESHOLDS,
      cashOnCash: { ...BALANCED_THRESHOLDS.cashOnCash, A: 0.99 },
      autoKills: { dscrFloor: { enabled: false } },
    };
    expect(detectActivePreset("BUY_AND_HOLD", customized)).toBeNull();
  });
});
