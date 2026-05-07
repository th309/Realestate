/**
 * Pure-function parser + aggregator for IRS SOI county migration files.
 *
 * Source: https://www.irs.gov/statistics/soi-tax-stats-migration-data
 *
 * Reserved IRS state codes:
 *   96 = non-migrants, 97 = total migrants (US+foreign) → mapped to "00000"
 *   98 = foreign,     99 = unknown                     → mapped to "99999"
 * These reserved buckets are excluded from per-county aggregates.
 */

import * as XLSX from "xlsx";

export interface IrsFlowRow {
  origin_fips: string;
  destination_fips: string;
  tax_year: number;
  num_returns: number;
  num_exemptions: number;
  agi_thousands: number;
}

export interface IrsCountyAggregate {
  county_fips: string;
  tax_year: number;
  in_returns?: number;
  out_returns?: number;
  net_returns?: number;
  in_exemptions?: number;
  out_exemptions?: number;
  in_agi_thousands?: number;
  out_agi_thousands?: number;
  in_avg_agi?: number;
  out_avg_agi?: number;
}

/**
 * Map IRS (state_code, county_code) to a 5-character county FIPS string.
 * Reserved state codes are collapsed into sentinel values:
 *   96/97 → "00000" (non-migrants / total migrants)
 *   98/99 → "99999" (foreign / unknown)
 */
export function normalizeIrsFips(
  stateCode: string,
  countyCode: string,
): string {
  if (stateCode === "96" || stateCode === "97") return "00000";
  if (stateCode === "98" || stateCode === "99") return "99999";
  const s = stateCode.padStart(2, "0");
  const c = (countyCode || "0").padStart(3, "0");
  return s + c;
}

/**
 * Case-insensitive, punctuation-insensitive column lookup with synonyms.
 * IRS column names vary year-to-year (`y2_statefips` vs `Y2_STATEFIPS` vs
 * `state_code_destination`). Pass any number of candidate keys; the first one
 * that matches an actual header (after lowercasing + stripping non-alnum) wins.
 */
function makeRowGetter(row: Record<string, any>) {
  return (...keys: string[]): any => {
    for (const k of keys) {
      const target = k.toLowerCase().replace(/[^a-z0-9]/g, "");
      for (const actual of Object.keys(row)) {
        if (actual.toLowerCase().replace(/[^a-z0-9]/g, "") === target) {
          return row[actual];
        }
      }
    }
    return null;
  };
}

/**
 * Parse an IRS county migration file (CSV or XLSX) into normalized flow rows.
 *
 * @param buf       file content as a Buffer
 * @param direction "in"  — y2_* is the destination county, y1_* is the origin
 *                  "out" — y2_* is the origin county,      y1_* is the destination
 * @param taxYear   ending tax year (e.g. 2023 for FY22-23)
 */
export function parseIrsXlsx(
  buf: Buffer,
  direction: "in" | "out",
  taxYear: number,
): IrsFlowRow[] {
  const wb = XLSX.read(buf, { type: "buffer" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, {
    defval: null,
  });

  const out: IrsFlowRow[] = [];
  for (const row of rows) {
    const get = makeRowGetter(row);

    const yState = String(
      get("y2_statefips", "state_code_destination", "y2statefips") ?? "",
    ).trim();
    const yCounty = String(get("y2_countyfips", "y2countyfips") ?? "").trim();
    const xState = String(
      get("y1_statefips", "state_code_origin", "y1statefips") ?? "",
    ).trim();
    const xCounty = String(get("y1_countyfips", "y1countyfips") ?? "").trim();
    const numReturns = Number(get("n1", "num_returns")) || 0;
    const numExemptions = Number(get("n2", "num_exemptions")) || 0;
    const agi = Number(get("agi", "agi_thousands")) || 0;

    if (!yState || !xState) continue;
    // IRS suppresses small cells with -1 for disclosure protection; skip them
    // (and any genuinely-zero rows that slipped through).
    if (numReturns <= 0) continue;

    const yFips = normalizeIrsFips(yState, yCounty);
    const xFips = normalizeIrsFips(xState, xCounty);

    // direction='in' = inflow file: y is destination, x is origin
    // direction='out' = outflow file: y is origin (reporting county), x is destination
    const origin = direction === "in" ? xFips : yFips;
    const destination = direction === "in" ? yFips : xFips;

    out.push({
      origin_fips: origin,
      destination_fips: destination,
      tax_year: taxYear,
      num_returns: numReturns,
      num_exemptions: numExemptions,
      agi_thousands: agi,
    });
  }
  return out;
}

/**
 * Merge inflow and outflow rows into a single deduplicated list keyed by
 * `(origin_fips, destination_fips, tax_year)`.
 *
 * IRS publishes each county-to-county flow in BOTH the inflow and outflow
 * files (the destination county's inflow file and the origin county's outflow
 * file report the same numeric tuple). Concatenating without dedup causes:
 *   1. Postgres `ON CONFLICT DO UPDATE command cannot affect row a second time`
 *      errors during chunked upsert.
 *   2. ~2x double-counting in `deriveCountyAggregates`.
 *
 * Empirically ~87% of outflow rows are duplicates of inflow rows; the
 * remaining ~13% are flows whose destination is a reserved-bucket FIPS
 * (`00000` non-migrants, `99999` foreign) which only appear in the outflow
 * file and MUST be preserved.
 *
 * Last-write-wins is safe — IRS reports identical numeric values for the
 * same `(origin, destination, year)` tuple in both files by design.
 */
export function dedupIrsFlows(
  inflowRows: IrsFlowRow[],
  outflowRows: IrsFlowRow[],
): IrsFlowRow[] {
  return Array.from(
    new Map(
      [...inflowRows, ...outflowRows].map((f) => [
        `${f.origin_fips}|${f.destination_fips}|${f.tax_year}`,
        f,
      ]),
    ).values(),
  );
}

/**
 * Roll county-level inflow/outflow flows up into per-(county, tax_year)
 * aggregates. Reserved buckets (00000/99999) are excluded as aggregate rows
 * but their flows still contribute to real counties on the other end.
 */
export function deriveCountyAggregates(
  flows: IrsFlowRow[],
): IrsCountyAggregate[] {
  const map = new Map<string, IrsCountyAggregate>();
  const upsert = (key: string, init: IrsCountyAggregate) => {
    if (!map.has(key)) map.set(key, init);
    return map.get(key)!;
  };

  for (const f of flows) {
    if (f.destination_fips !== "00000" && f.destination_fips !== "99999") {
      const key = `${f.destination_fips}|${f.tax_year}`;
      const a = upsert(key, {
        county_fips: f.destination_fips,
        tax_year: f.tax_year,
      });
      a.in_returns = (a.in_returns ?? 0) + f.num_returns;
      a.in_exemptions = (a.in_exemptions ?? 0) + f.num_exemptions;
      a.in_agi_thousands = (a.in_agi_thousands ?? 0) + f.agi_thousands;
    }
    if (f.origin_fips !== "00000" && f.origin_fips !== "99999") {
      const key = `${f.origin_fips}|${f.tax_year}`;
      const a = upsert(key, {
        county_fips: f.origin_fips,
        tax_year: f.tax_year,
      });
      a.out_returns = (a.out_returns ?? 0) + f.num_returns;
      a.out_exemptions = (a.out_exemptions ?? 0) + f.num_exemptions;
      a.out_agi_thousands = (a.out_agi_thousands ?? 0) + f.agi_thousands;
    }
  }

  for (const a of map.values()) {
    a.net_returns = (a.in_returns ?? 0) - (a.out_returns ?? 0);
    if (a.in_returns)
      a.in_avg_agi = ((a.in_agi_thousands ?? 0) * 1000) / a.in_returns;
    if (a.out_returns)
      a.out_avg_agi = ((a.out_agi_thousands ?? 0) * 1000) / a.out_returns;
  }
  return [...map.values()];
}
