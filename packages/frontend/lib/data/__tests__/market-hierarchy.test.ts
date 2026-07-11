import { describe, it, expect, vi } from "vitest";

vi.mock("../metro-slug-data", () => ({
  METRO_SLUG_DATA: [
    {
      cbsaCode: "12345",
      slug: "test-metro-tx",
      name: "Test Metro, TX",
      shortName: "Test Metro, TX",
      state: "TX",
    },
  ],
  CBSA_TO_METRO: new Map([
    [
      "12345",
      {
        cbsaCode: "12345",
        slug: "test-metro-tx",
        name: "Test Metro, TX",
        shortName: "Test Metro, TX",
        state: "TX",
      },
    ],
  ]),
}));

vi.mock("../county-slug-data", () => ({
  COUNTY_SLUG_DATA: [
    {
      fips: "48001",
      slug: "test-county-tx",
      name: "Test County",
      shortName: "Test County, TX",
      state: "TX",
      cbsaCode: "12345",
    },
    {
      fips: "48002",
      slug: "rural-county-tx",
      name: "Rural County",
      shortName: "Rural County, TX",
      state: "TX",
      cbsaCode: null,
    },
  ],
  FIPS_TO_COUNTY: new Map([
    [
      "48001",
      {
        fips: "48001",
        slug: "test-county-tx",
        name: "Test County",
        shortName: "Test County, TX",
        state: "TX",
        cbsaCode: "12345",
      },
    ],
    [
      "48002",
      {
        fips: "48002",
        slug: "rural-county-tx",
        name: "Rural County",
        shortName: "Rural County, TX",
        state: "TX",
        cbsaCode: null,
      },
    ],
  ]),
}));

vi.mock("../zip-slug-data", () => ({
  ZIP_SLUG_DATA: [
    {
      zip: "78701",
      slug: "78701-austin-tx",
      name: "78701 (Austin)",
      shortName: "78701, Austin, TX",
      state: "TX",
      countyFips: "48001",
      cbsaCode: "12345",
    },
    {
      zip: "78999",
      slug: "78999-nowhere-tx",
      name: "78999 (Nowhere)",
      shortName: "78999, Nowhere, TX",
      state: "TX",
      countyFips: "48002",
      cbsaCode: null,
    },
  ],
}));

import {
  getCountiesForMetro,
  getZipsForMetro,
  getZipsForCounty,
  getAncestorChainForMetro,
  getAncestorChainForCounty,
  getAncestorChainForZip,
} from "../market-hierarchy";
import { METRO_SLUG_DATA } from "../metro-slug-data";
import { COUNTY_SLUG_DATA } from "../county-slug-data";
import { ZIP_SLUG_DATA } from "../zip-slug-data";

describe("market-hierarchy", () => {
  it("getCountiesForMetro groups counties by cbsaCode", () => {
    expect(getCountiesForMetro("12345").map((c) => c.fips)).toEqual(["48001"]);
  });

  it("getCountiesForMetro returns an empty array for a metro with no counties", () => {
    expect(getCountiesForMetro("99999")).toEqual([]);
  });

  it("getZipsForMetro groups zips by cbsaCode, excluding zips with no cbsaCode", () => {
    expect(getZipsForMetro("12345").map((z) => z.zip)).toEqual(["78701"]);
  });

  it("getZipsForCounty groups zips by countyFips", () => {
    expect(getZipsForCounty("48002").map((z) => z.zip)).toEqual(["78999"]);
  });

  it("getAncestorChainForMetro resolves state only, no self-referential metro/county", () => {
    const chain = getAncestorChainForMetro(METRO_SLUG_DATA[0]);
    expect(chain.state?.abbrev).toBe("TX");
    expect(chain.metro).toBeNull();
    expect(chain.county).toBeNull();
  });

  it("getAncestorChainForCounty resolves the parent metro when cbsaCode is present", () => {
    const chain = getAncestorChainForCounty(COUNTY_SLUG_DATA[0]);
    expect(chain.state?.abbrev).toBe("TX");
    expect(chain.metro?.cbsaCode).toBe("12345");
  });

  it("getAncestorChainForCounty omits the metro tier for a non-CBSA county", () => {
    const chain = getAncestorChainForCounty(COUNTY_SLUG_DATA[1]);
    expect(chain.metro).toBeNull();
  });

  it("getAncestorChainForZip resolves both county and metro", () => {
    const chain = getAncestorChainForZip(ZIP_SLUG_DATA[0]);
    expect(chain.county?.fips).toBe("48001");
    expect(chain.metro?.cbsaCode).toBe("12345");
  });
});
