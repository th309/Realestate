// scripts/__tests__/irs-migration.spec.ts
import { readFileSync } from "fs";
import { join } from "path";
import {
  parseIrsXlsx,
  normalizeIrsFips,
  deriveCountyAggregates,
} from "../download-irs-migration";

const inflowBuf = readFileSync(
  join(__dirname, "..", "__fixtures__", "irs-county-inflow-2023.csv"),
);
const outflowBuf = readFileSync(
  join(__dirname, "..", "__fixtures__", "irs-county-outflow-2023.csv"),
);

describe("normalizeIrsFips", () => {
  it("returns '00000' for state_code '96' (non-migrants)", () => {
    expect(normalizeIrsFips("96", "0")).toBe("00000");
  });
  it("returns '00000' for state_code '97' (all-migrants)", () => {
    expect(normalizeIrsFips("97", "0")).toBe("00000");
  });
  it("returns '99999' for state_code '98' (foreign)", () => {
    expect(normalizeIrsFips("98", "0")).toBe("99999");
  });
  it("returns '99999' for state_code '99' (unknown)", () => {
    expect(normalizeIrsFips("99", "0")).toBe("99999");
  });
  it("zero-pads to 5-char FIPS for normal counties", () => {
    expect(normalizeIrsFips("06", "37")).toBe("06037"); // LA County, CA
    expect(normalizeIrsFips("37", "183")).toBe("37183"); // Wake County, NC
  });
});

describe("parseIrsXlsx", () => {
  it("parses inflow rows", () => {
    const rows = parseIrsXlsx(inflowBuf, "in", 2023);
    expect(rows.length).toBeGreaterThan(100);
    expect(rows[0]).toHaveProperty("origin_fips");
    expect(rows[0]).toHaveProperty("destination_fips");
    expect(rows[0]).toHaveProperty("tax_year", 2023);
    // num_returns should always be a positive integer (suppressed -1 rows dropped)
    expect(rows.every((r) => r.num_returns > 0)).toBe(true);
    // 5-char FIPS for both ends
    expect(rows.every((r) => r.origin_fips.length === 5)).toBe(true);
    expect(rows.every((r) => r.destination_fips.length === 5)).toBe(true);
  });
  it("parses outflow rows", () => {
    const rows = parseIrsXlsx(outflowBuf, "out", 2023);
    expect(rows.length).toBeGreaterThan(100);
    expect(rows[0]).toHaveProperty("origin_fips");
    expect(rows[0]).toHaveProperty("destination_fips");
    expect(rows[0]).toHaveProperty("tax_year", 2023);
  });
});

describe("deriveCountyAggregates", () => {
  it("produces in_avg_agi = in_agi_thousands * 1000 / in_returns", () => {
    const flows = [
      {
        origin_fips: "37063",
        destination_fips: "37183",
        tax_year: 2023,
        num_returns: 100,
        num_exemptions: 200,
        agi_thousands: 8000,
      },
      {
        origin_fips: "37081",
        destination_fips: "37183",
        tax_year: 2023,
        num_returns: 50,
        num_exemptions: 100,
        agi_thousands: 5000,
      },
    ];
    const aggs = deriveCountyAggregates(flows);
    const wake = aggs.find(
      (a) => a.county_fips === "37183" && a.tax_year === 2023,
    );
    expect(wake).toBeDefined();
    expect(wake!.in_returns).toBe(150);
    expect(wake!.in_agi_thousands).toBe(13000);
    expect(wake!.in_avg_agi).toBeCloseTo((13000 * 1000) / 150, 0);
  });

  it("excludes reserved buckets (00000 / 99999) from aggregates", () => {
    const flows = [
      {
        origin_fips: "00000",
        destination_fips: "37183",
        tax_year: 2023,
        num_returns: 1000,
        num_exemptions: 2000,
        agi_thousands: 80000,
      },
      {
        origin_fips: "37183",
        destination_fips: "99999",
        tax_year: 2023,
        num_returns: 200,
        num_exemptions: 400,
        agi_thousands: 16000,
      },
    ];
    const aggs = deriveCountyAggregates(flows);
    // No aggregate row should exist for reserved FIPS
    expect(aggs.find((a) => a.county_fips === "00000")).toBeUndefined();
    expect(aggs.find((a) => a.county_fips === "99999")).toBeUndefined();
    // Wake destination row should exist with in_returns=1000 (origin reserved is allowed)
    const wakeDest = aggs.find((a) => a.county_fips === "37183");
    expect(wakeDest).toBeDefined();
    expect(wakeDest!.in_returns).toBe(1000);
    expect(wakeDest!.out_returns).toBe(200);
    expect(wakeDest!.net_returns).toBe(800);
  });
});
