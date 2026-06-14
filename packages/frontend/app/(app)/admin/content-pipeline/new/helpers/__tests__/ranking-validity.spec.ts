import { describe, it, expect } from "vitest";
import {
  validLevelsForScope,
  validScopesForLevel,
  isValidCombo,
} from "../ranking-validity";

describe("validLevelsForScope", () => {
  it("national → all levels", () => {
    expect(validLevelsForScope("national")).toEqual(["metro", "county", "zip"]);
  });

  it("state → all levels", () => {
    expect(validLevelsForScope("state")).toEqual(["metro", "county", "zip"]);
  });

  it("metro → only zip", () => {
    expect(validLevelsForScope("metro")).toEqual(["zip"]);
  });
});

describe("validScopesForLevel", () => {
  it("metro level → national or state only", () => {
    expect(validScopesForLevel("metro")).toEqual(["national", "state"]);
  });

  it("county level → national or state only", () => {
    expect(validScopesForLevel("county")).toEqual(["national", "state"]);
  });

  it("zip level → all scopes", () => {
    expect(validScopesForLevel("zip")).toEqual(["national", "state", "metro"]);
  });
});

describe("isValidCombo", () => {
  it("metro × national OK", () => {
    expect(isValidCombo("metro", "national")).toBe(true);
  });

  it("metro × state OK", () => {
    expect(isValidCombo("metro", "state")).toBe(true);
  });

  it("metro × metro NOT OK", () => {
    expect(isValidCombo("metro", "metro")).toBe(false);
  });

  it("county × metro NOT OK", () => {
    expect(isValidCombo("county", "metro")).toBe(false);
  });

  it("county × national OK", () => {
    expect(isValidCombo("county", "national")).toBe(true);
  });

  it("zip × national OK", () => {
    expect(isValidCombo("zip", "national")).toBe(true);
  });

  it("zip × state OK", () => {
    expect(isValidCombo("zip", "state")).toBe(true);
  });

  it("zip × metro OK", () => {
    expect(isValidCombo("zip", "metro")).toBe(true);
  });
});
