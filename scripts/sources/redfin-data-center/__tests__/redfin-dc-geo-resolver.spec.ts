import {
  extractStateCode,
  stripMetroSuffix,
  buildCountyNameCandidates,
} from "../redfin-dc-geo-resolver";

describe("redfin-dc-geo-resolver helpers", () => {
  it("strips the ' metro area' suffix Redfin DC appends", () => {
    expect(stripMetroSuffix("Akron, OH metro area")).toBe("Akron, OH");
    expect(stripMetroSuffix("Akron, OH")).toBe("Akron, OH");
  });

  it("extracts a 2-letter state code from a trailing ', XX'", () => {
    expect(extractStateCode("Bergen County, NJ")).toBe("NJ");
    expect(extractStateCode("Akron, OH metro area")).toBe("OH");
    expect(extractStateCode("National")).toBeNull();
    expect(extractStateCode("07002")).toBeNull();
  });

  it("builds exact county candidates incl. city/County variants (Hampton fix)", () => {
    // Independent city: must offer "hampton city" so it matches 51650, not
    // substring-matching "southampton county".
    const hampton = buildCountyNameCandidates("Hampton, VA");
    expect(hampton).toContain("hampton");
    expect(hampton).toContain("hampton city");
    expect(hampton).toContain("hampton county");
    expect(hampton).not.toContain("southampton county");

    // Already-suffixed county name round-trips.
    const southampton = buildCountyNameCandidates("Southampton County, VA");
    expect(southampton).toContain("southampton county");
    expect(southampton).toContain("southampton");
  });
});
