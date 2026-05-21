import { describe, it, expect } from "vitest";
import { CHART_TOKENS } from "../chart-tokens";

describe("CHART_TOKENS", () => {
  it("all values are CSS variable references", () => {
    Object.entries(CHART_TOKENS).forEach(([, value]) => {
      if (typeof value === "string") expect(value).toMatch(/^var\(--md-/);
      else
        Object.values(value).forEach((v) => expect(v).toMatch(/^var\(--md-/));
    });
  });
});
