import { describe, it, expect } from "vitest";
import { generateMarketSeoContent } from "../[slug]/generate-seo-content";
import { generateCountySeoContent } from "../county/[slug]/generate-seo-content";
import { generateZipSeoContent } from "../zip/[slug]/generate-seo-content";

// The score is computed nationally and calibrated so 50 = the market's state
// average. Saying it PREDICTS performance "relative to the state" is allowed;
// saying it is "ranked within state" / "relative within each state" wrongly
// describes the computation and is forbidden (see commit 72f68bb3, CLAUDE.md §9).
const FORBIDDEN = [
  /ranked within (the )?state/i,
  /relative within each state/i,
  /within[- ]state ranking/i,
];

const metro = {
  cbsaCode: "12420",
  slug: "austin-tx",
  name: "Austin-Round Rock-Georgetown, TX",
  shortName: "Austin, TX",
  state: "TX",
};
const county = {
  fips: "48453",
  slug: "travis-county-tx",
  name: "Travis County",
  shortName: "Travis County, TX",
  state: "TX",
  cbsaCode: "12420",
};
const zip = {
  zip: "78701",
  slug: "78701-austin-tx",
  name: "78701",
  shortName: "78701, Austin, TX",
  state: "TX",
  countyFips: "48453",
  cbsaCode: "12420",
};

function allText(obj: object): string {
  return Object.values(obj)
    .filter((v): v is string => typeof v === "string")
    .join(" ");
}

describe("SEO score copy", () => {
  it("never describes the score as ranked/relative within state (metro/county/zip)", () => {
    const texts = [
      allText(generateMarketSeoContent(metro as never)),
      allText(generateCountySeoContent(county as never)),
      allText(generateZipSeoContent(zip as never)),
    ];
    for (const text of texts) {
      for (const rx of FORBIDDEN) expect(text).not.toMatch(rx);
    }
  });

  it("ZIP copy says four inputs, never three (across all middle templates)", () => {
    const sampleZips = ["78701", "90210", "10001", "33101", "60601", "98101"];
    for (const z of sampleZips) {
      const t = allText(
        generateZipSeoContent({
          zip: z,
          slug: `${z}-city-tx`,
          name: z,
          shortName: `${z}, City, TX`,
          state: "TX",
          countyFips: null,
          cbsaCode: null,
        } as never),
      );
      expect(t).not.toMatch(
        /three (housing )?(metrics|indicators|inputs|signals)/i,
      );
    }
  });

  it("no double-state suffix like 'TX, TX' in any generated prose", () => {
    const texts = [
      allText(generateMarketSeoContent(metro as never)),
      allText(generateCountySeoContent(county as never)),
      allText(generateZipSeoContent(zip as never)),
    ];
    for (const text of texts) {
      expect(text).not.toMatch(/,\s*([A-Z]{2}),\s*\1\b/);
    }
  });
});
