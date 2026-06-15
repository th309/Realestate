/**
 * Download QCEW (Quarterly Census of Employment and Wages) Data
 *
 * BLS QCEW provides employment data for ALL counties and metros quarterly.
 * This fills the gap where FRED only has data for 3 metros.
 *
 * Data source: https://www.bls.gov/cew/downloadable-data-files.htm
 * API docs: https://www.bls.gov/cew/additional-resources/open-data/
 *
 * EFFICIENT APPROACH: Use industry slices to get all areas in one file
 * URL format: https://data.bls.gov/cew/data/api/{year}/{qtr}/industry/{industry_code}.csv
 *
 * Industry code 10 = Total, all industries
 * We filter for own_code 5 = Private sector
 */

import { writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { parse } from "csv-parse/sync";

// Use process.cwd() for compatibility with both CommonJS and ES modules
const OUTPUT_DIR = join(process.cwd(), "data/economic");
const QCEW_BASE_URL = "https://data.bls.gov/cew/data/api";

/**
 * NAICS supersector codes used by QCEW industry slices.
 * Keys are the 4-digit industry codes BLS publishes; values are the
 * `employment_<sector>` column suffix used on the economic_* tables.
 */
export const NAICS_SUPERSECTORS: Record<string, string> = {
  "1011": "natural_resources_mining",
  "1012": "construction",
  "1013": "manufacturing",
  "1021": "trade_transport_utilities",
  "1022": "information",
  "1023": "financial_activities",
  "1024": "professional_business_services",
  "1025": "education_health_services",
  "1026": "leisure_hospitality",
  "1027": "other_services",
  "1028": "public_administration",
};

export interface QcewParsedRow {
  areaFips: string;
  sectorKey: string; // 'construction' or 'total_nonfarm_employment'
  month3Emplvl: number; // last month of quarter (use as the "level")
  avgWeeklyWage: number | null;
  qtrlyEstabs: number | null;
  year: number;
  qtr: number;
}

/**
 * Parse a QCEW industry-slice CSV (per-area rows for one industry/quarter)
 * into a flat list of (geo, sector) rows.
 *
 * Ownership filter (own_code) per industry:
 *  - '10'   (total nonfarm) → own_code = '0' (all-owners summary)
 *  - '1028' (public administration) → own_code in {'1','2','3'}
 *           (federal/state/local government — there is no private public-admin)
 *  - other supersectors (1011-1027) → own_code = '5' (private)
 *
 * For sector 1028 we sum month3_emplvl across the three government own_codes
 * for each (area_fips, year, qtr) so the parser still emits one row per geo.
 * Wage and establishment columns are NOT attached to the 1028 rollup — those
 * are sector-specific and a sum-across-owners would be misleading; the
 * canonical economy-wide wage/establishment values come from industry 10.
 *
 * Aggregation levels kept (BLS QCEW agglvl_code):
 *  - 70 = county total all industries (industry 10)
 *  - 73 = county by NAICS supersector (industries 1011-1028)
 *  - 40 = MSA total all industries (industry 10)
 *  - 43 = MSA by NAICS supersector (industries 1011-1027 — note: BLS does
 *        not publish agglvl 43 for industry 1028; metro public_administration
 *        is not available from this slice and must be rolled up downstream
 *        from constituent counties)
 *
 * Excluded on purpose: 30/31/32/33/34 are CSA (Combined Statistical Area)
 * roll-ups whose area_fips are CS-prefixed (e.g. CS104) and don't map to
 * a CBSA, and 50/51/53 are statewide micro/non-MSA roll-ups.
 */
export function parseQcewSectorRows(
  csv: string,
  industryCode: string,
): QcewParsedRow[] {
  const lines = csv.trim().split(/\r?\n/);
  const header = lines[0].split(",").map((h) => h.replace(/"/g, "").trim());
  const idx = (col: string) => header.indexOf(col);

  const isTotal = industryCode === "10";
  const isPublicAdmin = industryCode === "1028";
  const sectorKey = isTotal
    ? "total_nonfarm_employment"
    : NAICS_SUPERSECTORS[industryCode];
  if (!sectorKey) {
    throw new Error(`Unknown QCEW industry code: ${industryCode}`);
  }

  const ownAllowed = isTotal
    ? new Set(["0"])
    : isPublicAdmin
      ? new Set(["1", "2", "3"]) // federal + state + local government
      : new Set(["5"]); // private
  // Industry 10 uses agglvl 70 (county) + 40 (MSA). Supersectors use
  // agglvl 73 (county-by-supersector) + 43 (MSA-by-supersector).
  const aggAllowed = isTotal ? new Set(["70", "40"]) : new Set(["73", "43"]);

  // For sector 1028 we accumulate fed/state/local rows per (area, year, qtr).
  // Key: `${areaFips}|${year}|${qtr}`
  const govSums = isPublicAdmin ? new Map<string, QcewParsedRow>() : null;

  const rows: QcewParsedRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.replace(/"/g, "").trim());
    const ownCode = cols[idx("own_code")];
    if (!ownAllowed.has(ownCode)) continue;

    const aggLvl = cols[idx("agglvl_code")];
    if (!aggAllowed.has(aggLvl)) continue;

    const areaFips = cols[idx("area_fips")];
    const month3 = parseInt(cols[idx("month3_emplvl")] || "0", 10);
    const avgWeeklyWage =
      parseInt(cols[idx("avg_wkly_wage")] || "0", 10) || null;
    const qtrlyEstabs = parseInt(cols[idx("qtrly_estabs")] || "0", 10) || null;
    const year = parseInt(cols[idx("year")], 10);
    const qtr = parseInt(cols[idx("qtr")], 10);

    if (govSums) {
      // Sum month3_emplvl across federal/state/local owners. Wage and
      // establishment columns are intentionally NOT carried for 1028.
      const key = `${areaFips}|${year}|${qtr}`;
      const existing = govSums.get(key);
      if (existing) {
        existing.month3Emplvl += month3;
      } else {
        govSums.set(key, {
          areaFips,
          sectorKey,
          month3Emplvl: month3,
          avgWeeklyWage: null,
          qtrlyEstabs: null,
          year,
          qtr,
        });
      }
      continue;
    }

    rows.push({
      areaFips,
      sectorKey,
      month3Emplvl: month3,
      avgWeeklyWage,
      qtrlyEstabs,
      year,
      qtr,
    });
  }

  if (govSums) {
    for (const r of govSums.values()) rows.push(r);
  }
  return rows;
}

// Rate limiting - BLS asks for reasonable request rates
const DELAY_MS = 500; // 500ms between requests (only ~40 requests total now)

interface QCEWRecord {
  area_fips: string;
  own_code: string;
  industry_code: string;
  year: string;
  qtr: string;
  month1_emplvl: string;
  month2_emplvl: string;
  month3_emplvl: string;
  qtrly_estabs: string;
  total_qtrly_wages: string;
}

interface EmploymentRecord {
  period_date: string;
  area_code: string;
  area_type: "county" | "metro";
  total_employment: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch QCEW industry slice data (all areas for a given industry)
 * This is MUCH more efficient than fetching per-area
 */
async function fetchQCEWIndustrySlice(
  year: number,
  qtr: number,
  industryCode: string,
): Promise<QCEWRecord[] | null> {
  const url = `${QCEW_BASE_URL}/${year}/${qtr}/industry/${industryCode}.csv`;

  console.log(`  Fetching ${year}Q${qtr}...`);

  try {
    const response = await fetch(url);
    if (!response.ok) {
      if (response.status === 404) {
        console.warn(`  No data for ${year}Q${qtr}`);
        return null;
      }
      console.warn(`  HTTP ${response.status} for ${year}Q${qtr}`);
      return null;
    }

    const csvText = await response.text();
    if (!csvText.trim() || csvText.includes("No Data")) {
      return null;
    }

    const records = parse(csvText, {
      columns: true,
      skip_empty_lines: true,
      relax_column_count: true,
    }) as QCEWRecord[];

    console.log(`  Got ${records.length} records for ${year}Q${qtr}`);
    return records;
  } catch (error) {
    console.warn(`  Error fetching ${year}Q${qtr}: ${error}`);
    return null;
  }
}

/**
 * Extract total private employment from QCEW records
 * own_code 5 = Private sector
 * Area FIPS codes: 5-digit for counties, CXXXXX format for MSAs
 */
function extractPrivateEmployment(records: QCEWRecord[]): EmploymentRecord[] {
  const results: EmploymentRecord[] = [];

  // Filter for Private ownership (own_code=5)
  const privateRecords = records.filter((r) => r.own_code === "5");

  for (const record of privateRecords) {
    const fips = record.area_fips;

    // Determine area type
    let areaType: "county" | "metro" | null = null;
    let areaCode: string = fips;

    if (fips.startsWith("C") && fips.length === 5) {
      // CXXXX format = MSA code, needs trailing '0' to make 5-digit CBSA code
      // E.g., C1018 -> CBSA 10180
      areaType = "metro";
      areaCode = fips.slice(1) + "0"; // Remove 'C' prefix and add trailing 0
    } else if (fips.length === 5 && !fips.startsWith("C")) {
      // 5-digit code = county FIPS (but skip state-level codes ending in 000)
      if (fips.endsWith("000")) continue;
      areaType = "county";
    } else {
      // Skip other area types (statewide, national, etc.)
      continue;
    }

    // QCEW provides monthly employment levels for each quarter
    // We'll use month3 (end of quarter) as the quarterly value
    const employment = parseInt(record.month3_emplvl);
    if (isNaN(employment) || employment === 0) continue;

    // Convert quarter to date (last month of quarter)
    const qtr = parseInt(record.qtr);
    const month = qtr * 3; // Q1=3, Q2=6, Q3=9, Q4=12
    const periodDate = `${record.year}-${String(month).padStart(2, "0")}-01`;

    results.push({
      period_date: periodDate,
      area_code: areaCode,
      area_type: areaType,
      total_employment: employment,
    });
  }

  return results;
}

/**
 * Calculate YoY employment growth
 */
function calculateEmploymentYoY(records: EmploymentRecord[]): Array<{
  period_date: string;
  area_code: string;
  area_type: "county" | "metro";
  total_employment: number;
  employment_yoy: number | null;
}> {
  // Sort by area and date
  const sorted = [...records].sort((a, b) => {
    const areaCompare = a.area_code.localeCompare(b.area_code);
    if (areaCompare !== 0) return areaCompare;
    return a.period_date.localeCompare(b.period_date);
  });

  // Create lookup for previous year values
  const lookup = new Map<string, EmploymentRecord>();
  for (const record of sorted) {
    const key = `${record.area_code}|${record.period_date}`;
    lookup.set(key, record);
  }

  // Calculate YoY
  return sorted.map((record) => {
    const currentDate = new Date(record.period_date);
    const prevDate = new Date(currentDate);
    prevDate.setFullYear(prevDate.getFullYear() - 1);
    const prevKey = `${record.area_code}|${prevDate.toISOString().slice(0, 10)}`;
    const prevRecord = lookup.get(prevKey);

    let employment_yoy: number | null = null;
    if (prevRecord && prevRecord.total_employment > 0) {
      employment_yoy =
        ((record.total_employment - prevRecord.total_employment) /
          prevRecord.total_employment) *
        100;
      employment_yoy = Math.round(employment_yoy * 100) / 100; // Round to 2 decimal places
    }

    return {
      ...record,
      employment_yoy,
    };
  });
}

/**
 * Save to CSV files
 */
function saveResults(
  countyData: ReturnType<typeof calculateEmploymentYoY>,
  metroData: ReturnType<typeof calculateEmploymentYoY>,
): void {
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Save county employment
  if (countyData.length > 0) {
    const countyRecords = countyData.map((r) => ({
      period_date: r.period_date,
      fips_code: r.area_code,
      total_nonfarm_employment: r.total_employment,
      employment_yoy: r.employment_yoy ?? "",
    }));

    const headers = Object.keys(countyRecords[0]);
    const csv = [
      headers.join(","),
      ...countyRecords.map((r) => headers.map((h) => (r as any)[h]).join(",")),
    ].join("\n");

    const path = join(OUTPUT_DIR, "qcew_county_employment.csv");
    writeFileSync(path, csv);
    console.log(
      `\nSaved ${countyRecords.length} county records to qcew_county_employment.csv`,
    );
  }

  // Save metro employment
  if (metroData.length > 0) {
    const metroRecords = metroData.map((r) => ({
      period_date: r.period_date,
      cbsa_code: r.area_code,
      total_nonfarm_employment: r.total_employment,
      employment_yoy: r.employment_yoy ?? "",
    }));

    const headers = Object.keys(metroRecords[0]);
    const csv = [
      headers.join(","),
      ...metroRecords.map((r) => headers.map((h) => (r as any)[h]).join(",")),
    ].join("\n");

    const path = join(OUTPUT_DIR, "qcew_metro_employment.csv");
    writeFileSync(path, csv);
    console.log(
      `Saved ${metroRecords.length} metro records to qcew_metro_employment.csv`,
    );
  }
}

/**
 * Convert (year, qtr) to the last day of the quarter as an ISO date string.
 * 2023q4 -> '2023-12-31', 2024q1 -> '2024-03-31', q2 -> '*-06-30'.
 */
export function quarterEndDate(year: number, qtr: number): string {
  const month = qtr * 3; // q1=3, q2=6, q3=9, q4=12
  const lastDay = month === 6 ? 30 : month === 9 ? 30 : 31;
  return `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
}

/**
 * Fetch a QCEW industry-slice CSV (raw text) for a single (year, qtr, industry).
 * Returns null on 404 / "No Data" responses.
 */
export async function downloadQcewIndustry(
  year: number,
  qtr: number,
  industryCode: string,
): Promise<string | null> {
  const url = `${QCEW_BASE_URL}/${year}/${qtr}/industry/${industryCode}.csv`;
  console.log(`  Fetching ${year}Q${qtr} sector ${industryCode}...`);
  try {
    const response = await fetch(url);
    if (!response.ok) {
      if (response.status === 404) {
        console.warn(`  No data for ${year}Q${qtr} sector ${industryCode}`);
        return null;
      }
      console.warn(
        `  HTTP ${response.status} for ${year}Q${qtr} sector ${industryCode}`,
      );
      return null;
    }
    const csvText = await response.text();
    if (!csvText.trim() || csvText.includes("No Data")) {
      return null;
    }
    return csvText;
  } catch (error) {
    console.warn(
      `  Error fetching ${year}Q${qtr} sector ${industryCode}: ${error}`,
    );
    return null;
  }
}

/**
 * Classify a QCEW area_fips into a county / metro target row, or null
 * if it's a state/national/other roll-up that doesn't belong in
 * economic_county or economic_metro.
 */
function classifyAreaFips(
  fips: string,
): { areaType: "county" | "metro"; areaCode: string } | null {
  // Skip BLS Combined Statistical Area codes (CS-prefix). CSAs aren't
  // valid CBSA codes and would otherwise produce garbage `cbsa_code`
  // values like 'S1040' if we naively stripped the leading 'C'.
  if (fips.startsWith("CS")) return null;
  if (fips.startsWith("C") && fips.length === 5) {
    // CXXXX → CBSA 5-digit (append trailing 0): C1018 -> 10180
    return { areaType: "metro", areaCode: fips.slice(1) + "0" };
  }
  if (fips.length === 5 && !fips.startsWith("C")) {
    if (fips.endsWith("000")) return null; // state-level roll-up
    return { areaType: "county", areaCode: fips };
  }
  return null;
}

interface CliArgs {
  year: number;
  qtr: number;
  counties: boolean;
  metros: boolean;
  dryRun: boolean;
}

/**
 * Compute the most-recently-published QCEW quarter for a given date.
 *
 * BLS QCEW publishes ~6 months after quarter end:
 *   Q1 → ~July, Q2 → ~October, Q3 → ~January, Q4 → ~April.
 *
 * This is the single source of truth for the default QCEW quarter. (The old
 * economic-monthly-import.yml that mirrored this bash logic was retired; QCEW
 * now imports via scripts/import-all-non-zillow.ts in the weekly pipeline.)
 *   Jan-Mar → previous-year Q3
 *   Apr-Jun → previous-year Q4
 *   Jul-Sep → current-year  Q1
 *   Oct-Dec → current-year  Q2
 */
export function defaultQcewPeriod(now: Date = new Date()): {
  year: number;
  qtr: number;
} {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1; // 1..12
  if (month <= 3) return { year: year - 1, qtr: 3 };
  if (month <= 6) return { year: year - 1, qtr: 4 };
  if (month <= 9) return { year, qtr: 1 };
  return { year, qtr: 2 };
}

function parseCliArgs(argv: string[]): CliArgs {
  const get = (flag: string): string | undefined => {
    const idx = argv.indexOf(flag);
    if (idx === -1) return undefined;
    return argv[idx + 1];
  };
  const has = (flag: string) => argv.includes(flag);

  const yearStr = get("--year");
  const qtrStr = get("--qtr");

  let year: number;
  let qtr: number;

  if (!yearStr && !qtrStr) {
    // Neither flag given: default to most-recently-published QCEW quarter.
    // This keeps the no-flag `npx tsx download-qcew-employment.ts` invocation
    // (run via scripts/import-all-non-zillow.ts) working after Phase 1.4 made
    // the sector-ingest path the default.
    const def = defaultQcewPeriod();
    year = def.year;
    qtr = def.qtr;
    console.log(
      `Defaulting to most-recently-published quarter: ${year}Q${qtr}`,
    );
  } else if (!yearStr || !qtrStr) {
    // Partial args: surface a clear usage error instead of silently defaulting.
    throw new Error(
      "Usage: download-qcew-employment.ts --year <yyyy> --qtr <1-4> [--counties] [--metros] [--dry-run]",
    );
  } else {
    year = parseInt(yearStr, 10);
    qtr = parseInt(qtrStr, 10);
    if (isNaN(year) || isNaN(qtr) || qtr < 1 || qtr > 4) {
      throw new Error(`Invalid --year/--qtr: ${yearStr} ${qtrStr}`);
    }
  }

  // If neither --counties nor --metros given, default to both (back-compat)
  let counties = has("--counties");
  let metros = has("--metros");
  if (!counties && !metros) {
    counties = true;
    metros = true;
  }

  return { year, qtr, counties, metros, dryRun: has("--dry-run") };
}

/**
 * Fetch all sectors (total + 11 supersectors) for one quarter and produce
 * upsert-ready rows for economic_county and economic_metro.
 *
 * Each row carries one period_date + area key + the sector employment
 * columns + qcew_avg_weekly_wage + qcew_total_establishments. All rows
 * are merged in-memory by (period_date, fips_code|cbsa_code) so a single
 * upsert per table covers the full sector matrix.
 */
export async function buildQcewSectorRows(
  year: number,
  qtr: number,
): Promise<{
  countyRows: Record<string, unknown>[];
  metroRows: Record<string, unknown>[];
}> {
  const sectorCodes = ["10", ...Object.keys(NAICS_SUPERSECTORS)]; // total + 11
  const periodDate = quarterEndDate(year, qtr);

  // key: areaCode -> partial row
  const countyByCode = new Map<string, Record<string, unknown>>();
  const metroByCode = new Map<string, Record<string, unknown>>();

  for (const code of sectorCodes) {
    const csv = await downloadQcewIndustry(year, qtr, code);
    if (!csv) {
      await sleep(DELAY_MS);
      continue;
    }
    const rows = parseQcewSectorRows(csv, code);

    for (const r of rows) {
      const classified = classifyAreaFips(r.areaFips);
      if (!classified) continue;

      const target =
        classified.areaType === "county" ? countyByCode : metroByCode;
      const keyCol =
        classified.areaType === "county" ? "fips_code" : "cbsa_code";

      let row = target.get(classified.areaCode);
      if (!row) {
        row = { period_date: periodDate, [keyCol]: classified.areaCode };
        target.set(classified.areaCode, row);
      }

      const colName =
        r.sectorKey === "total_nonfarm_employment"
          ? "total_nonfarm_employment"
          : `employment_${r.sectorKey}`;
      row[colName] = r.month3Emplvl;

      // Wage + establishments are sector-specific in QCEW; we keep the
      // total-nonfarm pass as the canonical economy-wide value.
      if (r.sectorKey === "total_nonfarm_employment") {
        row.qcew_avg_weekly_wage = r.avgWeeklyWage;
        row.qcew_total_establishments = r.qtrlyEstabs;
      }
    }
    await sleep(DELAY_MS);
  }

  return {
    countyRows: Array.from(countyByCode.values()),
    metroRows: Array.from(metroByCode.values()),
  };
}

async function runSectorIngest(args: CliArgs): Promise<void> {
  console.log("=".repeat(60));
  console.log(
    `BLS QCEW Sector Ingest — ${args.year}Q${args.qtr}` +
      (args.dryRun ? " (DRY RUN)" : ""),
  );
  console.log("=".repeat(60));

  const { countyRows, metroRows } = await buildQcewSectorRows(
    args.year,
    args.qtr,
  );

  console.log(
    `\nBuilt ${countyRows.length} county rows and ${metroRows.length} metro rows`,
  );

  if (args.dryRun) {
    console.log(
      `\n[dry-run] would upsert ${
        args.counties ? countyRows.length : 0
      } county rows`,
    );
    console.log(
      `[dry-run] would upsert ${args.metros ? metroRows.length : 0} metro rows`,
    );
    if (countyRows.length > 0) {
      console.log("[dry-run] sample county row:", countyRows[0]);
    }
    if (metroRows.length > 0) {
      console.log("[dry-run] sample metro row:", metroRows[0]);
    }
    return;
  }

  // Lazy import so --dry-run can run without Supabase env vars.
  const { upsertWithLogging } =
    await import("./sources/census-economic/census-economic-upsert");

  if (args.counties && countyRows.length > 0) {
    await upsertWithLogging({
      source: "bls",
      tableName: "economic_county",
      conflictKeys: ["period_date", "fips_code"],
      datasetId: `qcew-county-${args.year}q${args.qtr}`,
      records: countyRows,
    });
  }

  if (args.metros && metroRows.length > 0) {
    await upsertWithLogging({
      source: "bls",
      tableName: "economic_metro",
      conflictKeys: ["period_date", "cbsa_code"],
      datasetId: `qcew-metro-${args.year}q${args.qtr}`,
      records: metroRows,
    });
  }

  console.log("\n" + "=".repeat(60));
  console.log("QCEW sector ingest complete");
  console.log("=".repeat(60));
}

/**
 * Legacy CSV-export path (kept for existing combine-economic-data.ts users).
 * Triggered when no --year/--qtr CLI args are passed.
 */
async function runLegacyCsvDump(): Promise<void> {
  console.log("=".repeat(60));
  console.log("BLS QCEW Employment Data Download (Legacy CSV Dump)");
  console.log("=".repeat(60));

  const currentYear = new Date().getFullYear();
  const currentQtr = Math.ceil((new Date().getMonth() + 1) / 3);

  const startYear = currentYear - 10;
  const endYear = currentYear;

  console.log(`\nDownloading data from ${startYear} to ${endYear}`);
  console.log("Note: QCEW data is released ~6 months after quarter end");
  console.log("Using industry slice method (all areas per file)\n");

  const quarters: Array<{ year: number; qtr: number }> = [];
  for (let year = startYear; year <= endYear; year++) {
    for (let qtr = 1; qtr <= 4; qtr++) {
      if (year === currentYear && qtr >= currentQtr) continue;
      const monthsAgo = (currentYear - year) * 12 + (currentQtr * 3 - qtr * 3);
      if (monthsAgo < 6) continue;
      quarters.push({ year, qtr });
    }
  }

  console.log(`Fetching ${quarters.length} quarters of data\n`);

  const allCountyRecords: EmploymentRecord[] = [];
  const allMetroRecords: EmploymentRecord[] = [];

  for (const { year, qtr } of quarters) {
    const records = await fetchQCEWIndustrySlice(year, qtr, "10");
    if (records) {
      const employment = extractPrivateEmployment(records);
      for (const record of employment) {
        if (record.area_type === "county") {
          allCountyRecords.push(record);
        } else if (record.area_type === "metro") {
          allMetroRecords.push(record);
        }
      }
    }
    await sleep(DELAY_MS);
  }

  console.log(`\nTotal county records: ${allCountyRecords.length}`);
  console.log(`Total metro records: ${allMetroRecords.length}`);

  const countyWithYoY = calculateEmploymentYoY(allCountyRecords);
  const metroWithYoY = calculateEmploymentYoY(allMetroRecords);

  saveResults(countyWithYoY, metroWithYoY);

  console.log("\n" + "=".repeat(60));
  console.log("Download complete!");
  console.log("Run combine-economic-data.ts to merge into economic tables");
  console.log("=".repeat(60));
}

async function main(): Promise<void> {
  try {
    const argv = process.argv.slice(2);
    // Explicit opt-in to the legacy multi-quarter CSV dump path. Default
    // behaviour is the sector ingest, which self-defaults --year/--qtr to
    // the most-recently-published quarter when both are omitted.
    if (argv.includes("--legacy-csv-dump")) {
      await runLegacyCsvDump();
    } else {
      const args = parseCliArgs(argv);
      await runSectorIngest(args);
    }
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

// Only run main() when this file is invoked directly, not when imported
// from tests. require.main === module is the canonical CommonJS guard.
if (require.main === module) {
  main();
}
