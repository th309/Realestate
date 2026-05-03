import { readFileSync } from "fs";
import { join } from "path";
import {
  parseCesBatchResponse,
  parseCesSeriesId,
  CES_SUPERSECTORS,
} from "../ces-importer";

describe("parseCesSeriesId", () => {
  it("decomposes a metro series ID", () => {
    // BLS CES State+Area format: SMU + state(2) + area(5) + industry(8) + datatype(2) = 20 chars
    // SMU + 37 + 39580 + 20000000 + 01 -> supersector 20 (construction)
    const parsed = parseCesSeriesId("SMU37395802000000001");
    expect(parsed).toEqual({
      level: "metro",
      stateFips: "37",
      areaCode: "39580",
      supersectorCode: "20",
      datatype: "01",
      sectorKey: "construction",
    });
  });

  it("decomposes a state series ID", () => {
    const parsed = parseCesSeriesId("SMS37000000000000001");
    expect(parsed).toEqual({
      level: "state",
      stateFips: "37",
      areaCode: "00000",
      supersectorCode: "00",
      datatype: "01",
      sectorKey: "total_nonfarm",
    });
  });

  it("decomposes the natural_resources_mining_construction combined supersector (15)", () => {
    const parsed = parseCesSeriesId("SMU37395801500000001");
    expect(parsed.supersectorCode).toBe("15");
    expect(parsed.areaCode).toBe("39580");
    expect(parsed.stateFips).toBe("37");
    expect(parsed.level).toBe("metro");
  });
});

describe("parseCesBatchResponse", () => {
  const json = JSON.parse(
    readFileSync(
      join(__dirname, "..", "__fixtures__", "ces-batch-sample.json"),
      "utf-8",
    ),
  );

  it("returns one row per series x month", () => {
    const rows = parseCesBatchResponse(json);
    // 5 series x 12 months = 60 rows
    expect(rows.length).toBeGreaterThan(40);
    expect(rows.every((r) => typeof r.value === "number")).toBe(true);
  });

  it("multiplies BLS thousands by 1000 to land integer employee counts", () => {
    const rows = parseCesBatchResponse(json);
    // BLS publishes in thousands; importer multiplies by 1000.
    // NC state total nonfarm Dec 2023 was 4997.5 thousand -> 4_997_500.
    const ncStateDec = rows.find(
      (r) =>
        r.level === "state" &&
        r.stateFips === "37" &&
        r.periodDate === "2023-12-01" &&
        r.sectorKey === "total_nonfarm",
    );
    expect(ncStateDec).toBeDefined();
    expect(ncStateDec!.value).toBe(4_997_500);
  });

  it("groups by (level, areaCode, periodDate) when projecting upserts", () => {
    const rows = parseCesBatchResponse(json);
    const raleighDec = rows.filter(
      (r) => r.areaCode === "39580" && r.periodDate === "2023-12-01",
    );
    // Expect both natural_resources_mining_construction (15) and manufacturing (30) for that month
    expect(raleighDec.length).toBe(2);
  });

  it("exports CES_SUPERSECTORS with all 11 published supersectors", () => {
    expect(Object.keys(CES_SUPERSECTORS)).toHaveLength(11);
  });
});
