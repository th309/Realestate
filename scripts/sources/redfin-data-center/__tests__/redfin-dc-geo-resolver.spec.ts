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

  it("orders county candidates by Redfin's city/county suffix", () => {
    // No suffix => independent city: try "<name> city" FIRST so "Hampton, VA"
    // resolves to Hampton city (51650), not the county "Southampton".
    expect(buildCountyNameCandidates("Hampton, VA")).toEqual([
      "hampton city",
      "hampton",
    ]);
    // "County" suffix => true county: try bare name FIRST.
    expect(buildCountyNameCandidates("Southampton County, VA")).toEqual([
      "southampton",
      "southampton county",
    ]);
    // Same base, different type => DISTINCT ordered candidates (no collision):
    expect(buildCountyNameCandidates("Richmond, VA")).toEqual([
      "richmond city",
      "richmond",
    ]);
    expect(buildCountyNameCandidates("Richmond County, VA")).toEqual([
      "richmond",
      "richmond county",
    ]);
  });
});
