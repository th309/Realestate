import { describe, it, expect } from "vitest";
import { resolveCountyAlias } from "../market-slug-aliases";

describe("resolveCountyAlias — independent-city bare-alias ordering", () => {
  it("resolves a contested bare alias to the city, not the same-named county", () => {
    // Richmond, Roanoke, and Franklin VA each have both a real county AND a
    // same-named independent city. The bare alias must deterministically
    // favor the city (what most searchers mean), not whichever happens to
    // sort first in the source data.
    expect(resolveCountyAlias("richmond-va")).toBe("richmond-city-va");
    expect(resolveCountyAlias("roanoke-va")).toBe("roanoke-city-va");
    expect(resolveCountyAlias("franklin-va")).toBe("franklin-city-va");
  });

  it("resolves a contested bare alias to the city for the non-VA cases too", () => {
    expect(resolveCountyAlias("baltimore-md")).toBe("baltimore-city-md");
    expect(resolveCountyAlias("st-louis-mo")).toBe("st-louis-city-mo");
  });

  it("never aliases a real county's own canonical slug away from itself", () => {
    // These are real, distinct counties (not aliases) — resolveCountyAlias
    // must return null so the county page route serves them directly rather
    // than redirecting to the same-named city.
    expect(resolveCountyAlias("richmond-county-va")).toBeNull();
    expect(resolveCountyAlias("roanoke-county-va")).toBeNull();
    expect(resolveCountyAlias("franklin-county-va")).toBeNull();
    expect(resolveCountyAlias("baltimore-county-md")).toBeNull();
  });

  it("aliases the old pre-fix '-county-' city URLs to the corrected '-city-' slug", () => {
    // Virginia Beach has no same-named county, so its old (wrong) slug is
    // safe to alias directly — unlike the Richmond/Roanoke/Franklin cases.
    expect(resolveCountyAlias("virginia-beach-county-va")).toBe(
      "virginia-beach-city-va",
    );
  });

  it("aliases old Louisiana parish-slugged URLs to the canonical county slug", () => {
    expect(resolveCountyAlias("acadia-parish-la")).toBe("acadia-county-la");
  });

  it("classifies James City / Charles City County as ordinary counties, not cities", () => {
    // James City County (FIPS 51095) and Charles City County (51036) are
    // real counties whose proper name happens to contain "City" — isCity
    // classification is FIPS-based specifically so these aren't swept into
    // the independent-city alias-swap logic. (Their canonical slug is
    // currently missing "City" due to a separate, pre-existing upstream
    // name-truncation bug unrelated to this alias logic — not asserted
    // here.) What matters for this fix: their bare "-county-" alias behaves
    // like any ordinary county's, not a city's.
    expect(resolveCountyAlias("james-va")).toBe("james-county-va");
    expect(resolveCountyAlias("charles-va")).toBe("charles-county-va");
  });
});
