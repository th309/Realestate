import { describe, it, expect } from "vitest";
import { isIndependentCity } from "./independent-cities";

describe("isIndependentCity", () => {
  it("recognizes the 3 non-Virginia independent cities", () => {
    expect(isIndependentCity("24510")).toBe(true); // Baltimore City, MD
    expect(isIndependentCity("29510")).toBe(true); // St. Louis City, MO
    expect(isIndependentCity("32510")).toBe(true); // Carson City, NV
  });

  it("recognizes Virginia independent cities (FIPS >= 51510)", () => {
    expect(isIndependentCity("51510")).toBe(true); // Alexandria city
    expect(isIndependentCity("51760")).toBe(true); // Richmond city
    expect(isIndependentCity("51840")).toBe(true); // Winchester city
  });

  it("rejects real Virginia counties, including the FIPS boundary just below 510", () => {
    expect(isIndependentCity("51059")).toBe(false); // Fairfax County
    expect(isIndependentCity("51159")).toBe(false); // Richmond County
    expect(isIndependentCity("51509")).toBe(false); // one below the VA-city threshold
  });

  it("does not misfire on real counties whose name contains 'City'", () => {
    // James City County (51095) and Charles City County (51036) are real
    // counties, not independent cities — detection must stay FIPS-based.
    expect(isIndependentCity("51095")).toBe(false);
    expect(isIndependentCity("51036")).toBe(false);
  });

  it("rejects counties in other states, including similar-looking FIPS", () => {
    expect(isIndependentCity("24005")).toBe(false); // Baltimore County, MD
    expect(isIndependentCity("29189")).toBe(false); // St. Louis County, MO
    expect(isIndependentCity("48453")).toBe(false); // Travis County, TX
  });
});
