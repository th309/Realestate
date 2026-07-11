import { describe, it, expect } from "vitest";
import { forecastDisplayYear } from "./forecast-year";

describe("forecastDisplayYear rolls the display year forward from October", () => {
  it("returns the period year for January through September", () => {
    expect(forecastDisplayYear("2026-05-31")).toBe(2026);
    expect(forecastDisplayYear("2026-09-30")).toBe(2026);
  });

  it("returns the next year for October through December", () => {
    expect(forecastDisplayYear("2026-10-31")).toBe(2027);
    expect(forecastDisplayYear("2026-12-31")).toBe(2027);
  });

  it("falls back to a current-date-derived year for null or invalid input", () => {
    const now = new Date();
    const expected =
      now.getUTCMonth() >= 9 ? now.getUTCFullYear() + 1 : now.getUTCFullYear();
    expect(forecastDisplayYear(null)).toBe(expected);
    expect(forecastDisplayYear("not-a-date")).toBe(expected);
  });
});
