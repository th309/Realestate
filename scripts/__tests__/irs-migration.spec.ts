// scripts/__tests__/irs-migration.spec.ts
import { readFileSync } from "fs";
import { join } from "path";
import {
  parseIrsXlsx,
  normalizeIrsFips,
  deriveCountyAggregates,
  dedupIrsFlows,
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

  it("does not double-count when fed deduplicated overlapping inflow/outflow rows", () => {
    // Same logical flow (37063 -> 37183, tax_year 2023) appears in BOTH files.
    // After dedup, aggregates must single-count the flow, not 2x.
    const inflow = [
      {
        origin_fips: "37063",
        destination_fips: "37183",
        tax_year: 2023,
        num_returns: 100,
        num_exemptions: 200,
        agi_thousands: 8000,
      },
    ];
    const outflow = [
      {
        origin_fips: "37063",
        destination_fips: "37183",
        tax_year: 2023,
        num_returns: 100,
        num_exemptions: 200,
        agi_thousands: 8000,
      },
    ];
    const deduped = dedupIrsFlows(inflow, outflow);
    expect(deduped.length).toBe(1);
    const aggs = deriveCountyAggregates(deduped);
    const wakeDest = aggs.find((a) => a.county_fips === "37183");
    expect(wakeDest!.in_returns).toBe(100); // NOT 200 (no double-count)
    const wakeOrig = aggs.find((a) => a.county_fips === "37063");
    expect(wakeOrig!.out_returns).toBe(100);
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

describe("dedupIrsFlows", () => {
  // Synthetic 5+5 with 4 overlapping primary keys
  const inflow = [
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
    {
      origin_fips: "06037",
      destination_fips: "37183",
      tax_year: 2023,
      num_returns: 30,
      num_exemptions: 60,
      agi_thousands: 2400,
    },
    {
      origin_fips: "36061",
      destination_fips: "37183",
      tax_year: 2023,
      num_returns: 25,
      num_exemptions: 50,
      agi_thousands: 2000,
    },
    {
      origin_fips: "12086",
      destination_fips: "37183",
      tax_year: 2023,
      num_returns: 15,
      num_exemptions: 30,
      agi_thousands: 1200,
    },
  ];
  const outflow = [
    // 4 overlap with inflow (same primary keys, identical values)
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
    {
      origin_fips: "06037",
      destination_fips: "37183",
      tax_year: 2023,
      num_returns: 30,
      num_exemptions: 60,
      agi_thousands: 2400,
    },
    {
      origin_fips: "36061",
      destination_fips: "37183",
      tax_year: 2023,
      num_returns: 25,
      num_exemptions: 50,
      agi_thousands: 2000,
    },
    // 1 unique outflow row — flow to foreign (99999) only appears in outflow file
    {
      origin_fips: "37183",
      destination_fips: "99999",
      tax_year: 2023,
      num_returns: 10,
      num_exemptions: 20,
      agi_thousands: 800,
    },
  ];

  it("returns 5 + 5 - 4 = 6 unique rows by (origin, destination, tax_year)", () => {
    const deduped = dedupIrsFlows(inflow, outflow);
    expect(deduped.length).toBe(6);
  });

  it("preserves the foreign-destination (99999) outflow row that only appears in outflow", () => {
    const deduped = dedupIrsFlows(inflow, outflow);
    const foreign = deduped.find(
      (f) => f.destination_fips === "99999" && f.origin_fips === "37183",
    );
    expect(foreign).toBeDefined();
    expect(foreign!.num_returns).toBe(10);
  });

  it("aggregates from deduped flows do not double-count overlapping rows", () => {
    const deduped = dedupIrsFlows(inflow, outflow);
    const aggs = deriveCountyAggregates(deduped);
    const wake = aggs.find((a) => a.county_fips === "37183");
    expect(wake).toBeDefined();
    // Sum of 100+50+30+25+15 = 220 (NOT 440 if double-counted)
    expect(wake!.in_returns).toBe(220);
    // Outflow from Wake: only the foreign-destination row → 10
    expect(wake!.out_returns).toBe(10);
  });

  it("produces unique primary-key tuples (no Postgres ON CONFLICT collisions)", () => {
    const deduped = dedupIrsFlows(inflow, outflow);
    const keys = deduped.map(
      (f) => `${f.origin_fips}|${f.destination_fips}|${f.tax_year}`,
    );
    expect(new Set(keys).size).toBe(keys.length);
  });
});
