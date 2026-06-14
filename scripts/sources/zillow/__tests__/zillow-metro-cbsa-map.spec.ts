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
  it("keeps one canonical region per CBSA (title match wins)", async () => {
    const rows = [
      {
        zillow_region_id: 200,
        zillow_region_name: "Helena, MT",
        cbsa_code: "25740",
        cbsa_title: "Helena, MT",
      },
      {
        zillow_region_id: 100,
        zillow_region_name: "Helena, AR",
        cbsa_code: "25740",
        cbsa_title: "Helena, MT",
      },
    ];
    const map = await buildCanonicalMetroCbsaMap(fakeSupabase(rows));
    expect(map.get(200)).toBe("25740");
    expect(map.has(100)).toBe(false);
  });

  it("breaks ties by lowest region_id when neither matches title", async () => {
    const rows = [
      {
        zillow_region_id: 900,
        zillow_region_name: "Aaa, XX",
        cbsa_code: "99999",
        cbsa_title: "Zzz, XX",
      },
      {
        zillow_region_id: 800,
        zillow_region_name: "Bbb, XX",
        cbsa_code: "99999",
        cbsa_title: "Zzz, XX",
      },
    ];
    const map = await buildCanonicalMetroCbsaMap(fakeSupabase(rows));
    expect(map.get(800)).toBe("99999");
    expect(map.has(900)).toBe(false);
  });
});
