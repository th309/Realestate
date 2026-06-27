import { describe, it, expect } from "vitest";
import {
  formatGeoDisplayName,
  titleCaseLocationName,
} from "../geo-display-name";

describe("titleCaseLocationName", () => {
  it("capitalizes a lowercase city", () => {
    expect(titleCaseLocationName("frederick")).toBe("Frederick");
  });
  it("capitalizes each word", () => {
    expect(titleCaseLocationName("new york")).toBe("New York");
  });
  it("capitalizes across hyphens", () => {
    expect(titleCaseLocationName("winston-salem")).toBe("Winston-Salem");
  });
  it("capitalizes after a period", () => {
    expect(titleCaseLocationName("st. louis")).toBe("St. Louis");
  });
  it("preserves deliberately mixed-case names (does not force-lowercase)", () => {
    expect(titleCaseLocationName("DeKalb County")).toBe("DeKalb County");
  });
  it("leaves already-correct names untouched", () => {
    expect(titleCaseLocationName("Frederick County")).toBe("Frederick County");
  });
  it("handles empty input", () => {
    expect(titleCaseLocationName("")).toBe("");
  });
});

describe("formatGeoDisplayName", () => {
  it("title-cases city and uppercases state", () => {
    expect(formatGeoDisplayName("frederick, md")).toBe("Frederick, MD");
  });
  it("leaves a properly-cased value unchanged", () => {
    expect(formatGeoDisplayName("Aberdeen, SD")).toBe("Aberdeen, SD");
  });
  it("preserves mixed-case city + uppercases state", () => {
    expect(formatGeoDisplayName("DeKalb County, ga")).toBe("DeKalb County, GA");
  });
  it("handles multi-state metros", () => {
    expect(
      formatGeoDisplayName("washington-arlington-alexandria, dc-va-md-wv"),
    ).toBe("Washington-Arlington-Alexandria, DC-VA-MD-WV");
  });
  it("handles a bare city with no state", () => {
    expect(formatGeoDisplayName("pomfret")).toBe("Pomfret");
  });
  it("returns empty string for empty / nullish input (caller supplies fallback)", () => {
    expect(formatGeoDisplayName("")).toBe("");
    expect(formatGeoDisplayName(null)).toBe("");
    expect(formatGeoDisplayName(undefined)).toBe("");
  });
});
