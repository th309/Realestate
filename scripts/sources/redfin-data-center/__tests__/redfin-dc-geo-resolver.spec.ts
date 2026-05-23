import { extractStateCode, stripMetroSuffix } from "../redfin-dc-geo-resolver";

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
});
