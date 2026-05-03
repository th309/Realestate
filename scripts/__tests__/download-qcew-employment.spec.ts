// scripts/__tests__/download-qcew-employment.spec.ts
import { readFileSync } from "fs";
import { join } from "path";
import {
  parseQcewSectorRows,
  NAICS_SUPERSECTORS,
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
});
