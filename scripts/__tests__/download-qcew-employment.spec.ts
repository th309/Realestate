// scripts/__tests__/download-qcew-employment.spec.ts
import { readFileSync } from "fs";
import { join } from "path";
import {
  parseQcewSectorRows,
  NAICS_SUPERSECTORS,
  defaultQcewPeriod,
  findLatestPublishedQuarter,
} from "../download-qcew-employment";

describe("parseQcewSectorRows", () => {
  it("returns one row per (geo, sector) for sector 1012 (construction)", () => {
    const csv = readFileSync(
      join(__dirname, "..", "__fixtures__", "qcew-2023q4-industry-1012.csv"),
      "utf-8",
    );
    const rows = parseQcewSectorRows(csv, "1012");
    // Sample county/metro rows expected; private-sector own_code=5 only
    expect(rows.length).toBeGreaterThan(10);
    expect(rows.every((r) => r.sectorKey === "construction")).toBe(true);
    expect(rows.every((r) => typeof r.month3Emplvl === "number")).toBe(true);
  });

  it("returns one row per geo for industry 10 (total) using all-owners filter", () => {
    const csv = readFileSync(
      join(__dirname, "..", "__fixtures__", "qcew-2023q4-industry-10.csv"),
      "utf-8",
    );
    const rows = parseQcewSectorRows(csv, "10");
    expect(rows.every((r) => r.sectorKey === "total_nonfarm_employment")).toBe(
      true,
    );
    // own_code: 0 (total) is the all-owners summary — verify filter logic
    expect(rows.length).toBeGreaterThan(10);
  });

  it("exposes 11 NAICS supersectors plus total in the registry", () => {
    expect(Object.keys(NAICS_SUPERSECTORS)).toHaveLength(11);
    expect(NAICS_SUPERSECTORS["1012"]).toBe("construction");
  });

  it("rolls up government own_codes (1+2+3) for sector 1028 (public_administration)", () => {
    const csv = readFileSync(
      join(__dirname, "..", "__fixtures__", "qcew-2023q4-industry-1028.csv"),
      "utf-8",
    );
    const rows = parseQcewSectorRows(csv, "1028");

    // Every emitted row is the public_administration sector
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.sectorKey === "public_administration")).toBe(
      true,
    );

    // The government rollup must yield positive employment (regression
    // guard — the old own_code=5 filter returned zero rows for 1028).
    expect(rows.every((r) => r.month3Emplvl > 0)).toBe(true);

    // Each (area, year, qtr) appears exactly once after the fed/state/local sum.
    const seen = new Set<string>();
    for (const r of rows) {
      const key = `${r.areaFips}|${r.year}|${r.qtr}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }

    // Wage / establishment columns are intentionally null for 1028 —
    // sum-across-owners would be misleading.
    expect(rows.every((r) => r.avgWeeklyWage === null)).toBe(true);
    expect(rows.every((r) => r.qtrlyEstabs === null)).toBe(true);

    // Wake County, NC (37183) has all three government own_codes in the
    // fixture; assert the rollup equals federal + state + local.
    // Raw fixture values: own_code 1 → 3350, own_code 2 → 24914, own_code 3 → 15607.
    const wake = rows.find((r) => r.areaFips === "37183");
    expect(wake).toBeDefined();
    expect(wake!.month3Emplvl).toBe(3350 + 24914 + 15607);
  });
});

describe("defaultQcewPeriod", () => {
  // BLS publishes QCEW with a ~6-month lag. The function maps a calendar
  // month to the most-recently-published (year, qtr). This function is now the
  // sole source of truth (the economic-monthly-import.yml workflow was retired).
  const cases: Array<{
    label: string;
    iso: string;
    expected: { year: number; qtr: number };
  }> = [
    {
      label: "Feb mid-month → prev-year Q3",
      iso: "2026-02-15T00:00:00Z",
      expected: { year: 2025, qtr: 3 },
    },
    {
      label: "May mid-month → prev-year Q4",
      iso: "2026-05-10T00:00:00Z",
      expected: { year: 2025, qtr: 4 },
    },
    {
      label: "Aug start-of-month → current-year Q1",
      iso: "2026-08-01T00:00:00Z",
      expected: { year: 2026, qtr: 1 },
    },
    {
      label: "Nov end-of-month → current-year Q2",
      iso: "2026-11-30T00:00:00Z",
      expected: { year: 2026, qtr: 2 },
    },
    // Boundary cases — first day of the quarter-shift month.
    {
      label: "Apr 1 boundary → prev-year Q4",
      iso: "2026-04-01T00:00:00Z",
      expected: { year: 2025, qtr: 4 },
    },
    {
      label: "Jul 1 boundary → current-year Q1",
      iso: "2026-07-01T00:00:00Z",
      expected: { year: 2026, qtr: 1 },
    },
  ];

  for (const c of cases) {
    it(c.label, () => {
      expect(defaultQcewPeriod(new Date(c.iso))).toEqual(c.expected);
    });
  }
});

describe("findLatestPublishedQuarter", () => {
  // The self-heal that fixes the silent-0-rows bug: when the nominal quarter
  // isn't published yet, walk back to the newest one BLS actually has. A stub
  // `probe` stands in for the BLS network fetch so the branch is covered in CI.
  const probeFor =
    (published: Set<string>) =>
    async (year: number, qtr: number): Promise<string | null> =>
      published.has(`${year}-${qtr}`) ? "csv-data" : null;

  it("returns the start quarter when it is already published", async () => {
    const result = await findLatestPublishedQuarter(
      { year: 2026, qtr: 1 },
      4,
      probeFor(new Set(["2026-1"])),
    );
    expect(result).toEqual({ year: 2026, qtr: 1 });
  });

  it("walks back across the year boundary to the newest published quarter", async () => {
    // 2026Q1 unpublished (the exact bug), 2025Q4 published.
    const result = await findLatestPublishedQuarter(
      { year: 2026, qtr: 1 },
      4,
      probeFor(new Set(["2025-4"])),
    );
    expect(result).toEqual({ year: 2025, qtr: 4 });
  });

  it("keeps walking back multiple quarters until it finds data", async () => {
    const result = await findLatestPublishedQuarter(
      { year: 2026, qtr: 1 },
      4,
      probeFor(new Set(["2025-2"])),
    );
    expect(result).toEqual({ year: 2025, qtr: 2 });
  });

  it("returns null when nothing is published within the lookback window", async () => {
    const result = await findLatestPublishedQuarter(
      { year: 2026, qtr: 1 },
      4,
      probeFor(new Set()),
    );
    expect(result).toBeNull();
  });

  it("probes exactly start + maxLookback quarters before giving up", async () => {
    let calls = 0;
    await findLatestPublishedQuarter({ year: 2026, qtr: 1 }, 2, async () => {
      calls++;
      return null;
    });
    expect(calls).toBe(3); // i = 0, 1, 2
  });
});
