import { describe, it, expect } from "vitest";
import { derivePropertyClass } from "../derive-property-class";

describe("derivePropertyClass", () => {
  it("returns sfh when propertyType is sfh regardless of units", () => {
    expect(derivePropertyClass("sfh", 1)).toBe("sfh");
    expect(derivePropertyClass("sfh", 4)).toBe("sfh");
    expect(derivePropertyClass("sfh", 50)).toBe("sfh");
  });

  it("returns sfh when MF is selected but units <= 1", () => {
    expect(derivePropertyClass("mf", 1)).toBe("sfh");
    expect(derivePropertyClass("mf", null)).toBe("sfh");
  });

  it("returns small_mf for HUD-eligible 2-4 unit residential MF", () => {
    expect(derivePropertyClass("mf", 2)).toBe("small_mf");
    expect(derivePropertyClass("mf", 3)).toBe("small_mf");
    expect(derivePropertyClass("mf", 4)).toBe("small_mf");
  });

  it("returns commercial_mf at the 5+ unit threshold", () => {
    expect(derivePropertyClass("mf", 5)).toBe("commercial_mf");
    expect(derivePropertyClass("mf", 10)).toBe("commercial_mf");
    expect(derivePropertyClass("mf", 100)).toBe("commercial_mf");
  });
});
