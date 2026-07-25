import { describe, it, expect } from "vitest";
import {
  formatCompactNumber,
  formatSignedCompact,
  computeDelta,
} from "../insights-format";

describe("formatCompactNumber", () => {
  it("compacts thousands and millions", () => {
    expect(formatCompactNumber(12345)).toBe("12.3K");
    expect(formatCompactNumber(1200000)).toBe("1.2M");
    expect(formatCompactNumber(950)).toBe("950");
  });
});

describe("formatSignedCompact", () => {
  it("prefixes a sign for net-change values", () => {
    expect(formatSignedCompact(1234)).toBe("+1.2K");
    expect(formatSignedCompact(-340)).toBe("-340");
    expect(formatSignedCompact(0)).toBe("0");
  });
});

describe("computeDelta (30d vs prior)", () => {
  it("returns up/down/flat percentages", () => {
    expect(computeDelta(110, 100)).toEqual({ direction: "up", label: "10%" });
    expect(computeDelta(90, 100)).toEqual({ direction: "down", label: "10%" });
    expect(computeDelta(100, 100)).toEqual({ direction: "flat", label: "0%" });
  });

  it("handles a zero prior: New when it grew, — when still zero", () => {
    expect(computeDelta(50, 0)).toEqual({ direction: "up", label: "New" });
    expect(computeDelta(0, 0)).toEqual({ direction: "flat", label: "—" });
  });

  it("treats a negative current against zero prior as down", () => {
    expect(computeDelta(-5, 0)).toEqual({ direction: "down", label: "New" });
  });
});
