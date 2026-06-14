// scripts/sources/zillow/__tests__/zillow-metro-cbsa-map.spec.ts
import { buildCanonicalMetroCbsaMap } from "../zillow-metro-cbsa-map";

function fakeSupabase(rows: any[]) {
  return {
    from: () => ({
      select: () => ({
        not: () => ({
          range: (from: number) =>
            from === 0
              ? Promise.resolve({ data: rows, error: null })
              : Promise.resolve({ data: [], error: null }),
        }),
      }),
    }),
  } as any;
}

describe("buildCanonicalMetroCbsaMap", () => {
  it("picks the region whose city is named in the title, even with a higher id", async () => {
    // CBSA 10860 "Aransas Pass-Rockport, TX": Rockport is in the title; Alice is not.
    const rows = [
      {
        zillow_region_id: 394316,
        zillow_region_name: "Alice, TX",
        cbsa_code: "10860",
        cbsa_title: "Aransas Pass-Rockport, TX",
      },
      {
        zillow_region_id: 845169,
        zillow_region_name: "Rockport, TX",
        cbsa_code: "10860",
        cbsa_title: "Aransas Pass-Rockport, TX",
      },
    ];
    const map = await buildCanonicalMetroCbsaMap(fakeSupabase(rows));
    expect(map.get(845169)).toBe("10860"); // Rockport wins despite higher id
    expect(map.has(394316)).toBe(false);
  });

  it("picks the principal city for hyphenated titles (not luck)", async () => {
    // CBSA 12100 "Atlantic City-Hammonton, NJ"
    const rows = [
      {
        zillow_region_id: 394348,
        zillow_region_name: "Atlantic City, NJ",
        cbsa_code: "12100",
        cbsa_title: "Atlantic City-Hammonton, NJ",
      },
      {
        zillow_region_id: 394928,
        zillow_region_name: "Ocean City, NJ",
        cbsa_code: "12100",
        cbsa_title: "Atlantic City-Hammonton, NJ",
      },
    ];
    const map = await buildCanonicalMetroCbsaMap(fakeSupabase(rows));
    expect(map.get(394348)).toBe("12100");
    expect(map.has(394928)).toBe(false);
  });

  it("falls back to lowest region_id when no city is named in the title", async () => {
    const rows = [
      {
        zillow_region_id: 800,
        zillow_region_name: "Bbb, XX",
        cbsa_code: "99999",
        cbsa_title: "Zzz, XX",
      },
      {
        zillow_region_id: 900,
        zillow_region_name: "Aaa, XX",
        cbsa_code: "99999",
        cbsa_title: "Zzz, XX",
      },
    ];
    const map = await buildCanonicalMetroCbsaMap(fakeSupabase(rows));
    expect(map.get(800)).toBe("99999");
    expect(map.has(900)).toBe(false);
  });
});
