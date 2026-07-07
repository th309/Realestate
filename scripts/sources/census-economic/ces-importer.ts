/**
 * CES (Current Employment Statistics) sector importer.
 *
 * Fetches monthly nonfarm payroll employment from BLS CES, decomposes the
 * seriesID into (level, area, supersector) and upserts into the
 * `economic_metro` / `economic_state` `ces_*` columns added by migration
 * 20260503000200_ces_sector_columns.sql.
 *
 * BLS publishes CES values in thousands of jobs; this importer multiplies
 * by 1000 before storing so downstream consumers see absolute employee
 * counts (BIGINT).
 *
 * Series ID layout (BLS State and Area employment, 20 chars):
 *   SM{seasonal:U|S} + state(2) + area(5) + industry(8) + datatype(2)
 *
 *   - State totals use SMS prefix with area '00000'.
 *   - Metro series use SMU prefix with the 5-digit CBSA in area.
 *   - Supersector code = first two digits of the 8-char industry block.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchBlsBatchRaw } from "./bls-api-client";

/**
 * BLS CES supersector code -> stable column suffix.
 *
 * The 11 published supersectors that map directly to columns added by
 * migration 058 (`ces_employment_<suffix>`). Combined supersectors that
 * BLS sometimes publishes for smaller metros (e.g. 15 = mining/logging
 * + construction combined) are intentionally NOT in this table — the
 * parser returns sectorKey='unknown' for those and the importer skips
 * the upsert.
 */
export const CES_SUPERSECTORS: Record<string, string> = {
  "10": "natural_resources_mining",
  "20": "construction",
  "30": "manufacturing",
  "40": "trade_transport_utilities",
  "50": "information",
  "55": "financial_activities",
  "60": "professional_business_services",
  "65": "education_health_services",
  "70": "leisure_hospitality",
  "80": "other_services",
  "90": "public_administration",
};

export interface ParsedCesSeriesId {
  level: "metro" | "state";
  stateFips: string;
  areaCode: string; // CBSA for metro, '00000' for state totals
  supersectorCode: string;
  datatype: string;
  sectorKey: string;
}

export function parseCesSeriesId(id: string): ParsedCesSeriesId {
  if (!id.startsWith("SMU") && !id.startsWith("SMS")) {
    throw new Error(`Unknown CES series ID prefix: ${id}`);
  }
  const level = id.startsWith("SMS") ? "state" : "metro";
  const stateFips = id.substring(3, 5);
  const areaCode = id.substring(5, 10);
  const supersectorCode = id.substring(10, 12);
  const datatype = id.substring(id.length - 2);

  let sectorKey: string;
  if (level === "state" && supersectorCode === "00") {
    sectorKey = "total_nonfarm";
  } else {
    sectorKey = CES_SUPERSECTORS[supersectorCode] ?? "unknown";
  }
  return { level, stateFips, areaCode, supersectorCode, datatype, sectorKey };
}

export interface CesValueRow {
  level: "metro" | "state";
  stateFips: string;
  areaCode: string;
  sectorKey: string;
  periodDate: string; // ISO YYYY-MM-01
  value: number; // absolute employees (BLS thousands * 1000)
}

interface BlsSeriesPayload {
  seriesID: string;
  data?: Array<{ year: string; period: string; value: string }>;
}

interface BlsBatchPayload {
  Results?: { series?: BlsSeriesPayload[] };
}

export function parseCesBatchResponse(json: unknown): CesValueRow[] {
  const out: CesValueRow[] = [];
  const payload = json as BlsBatchPayload;
  for (const series of payload.Results?.series ?? []) {
    const meta = parseCesSeriesId(series.seriesID);
    for (const dp of series.data ?? []) {
      // CES publishes monthly data with periods M01..M12; M13 = annual avg.
      const month = dp.period.startsWith("M")
        ? parseInt(dp.period.slice(1), 10)
        : NaN;
      if (!Number.isFinite(month) || month < 1 || month > 12) continue;
      const periodDate = `${dp.year}-${String(month).padStart(2, "0")}-01`;
      const numeric = parseFloat(dp.value);
      if (!Number.isFinite(numeric)) continue;
      out.push({
        level: meta.level,
        stateFips: meta.stateFips,
        areaCode: meta.areaCode,
        sectorKey: meta.sectorKey,
        periodDate,
        // BLS publishes in thousands of jobs; multiply for absolute counts.
        value: Math.round(numeric * 1000),
      });
    }
  }
  return out;
}

const BLS_BATCH_SIZE = 50;

/**
 * Fetches the supplied CES seriesIds in batches of 50 (BLS limit) and
 * upserts a row per (geography, period_date) populating the matching
 * ces_* sector column. Both `period_date` (existing PK) and
 * `ces_period_date` (CES "as-of" tracker) are set to the same value.
 *
 * Returns `{ inserted, skipped, failed }`: merged (geography, month) rows
 * upserted, rows with `sectorKey='unknown'` (combined supersectors not in
 * CES_SUPERSECTORS) skipped, and upsert errors logged-and-counted without
 * aborting the run.
 */
export async function importCes(
  supabase: SupabaseClient,
  seriesIds: string[],
  startYear: number,
  endYear: number,
): Promise<{ inserted: number; skipped: number; failed: number }> {
  let skipped = 0;

  // Merge every sector value for a given (table, geography, month) into ONE row
  // so we issue a single upsert per (geography, month) instead of one per sector
  // value (~11x fewer round-trips). The old per-sector path relied on ON
  // CONFLICT to accumulate columns incrementally; merging in memory first is
  // equivalent and keeps the full --all-metros run (~10k series) well under the
  // pipeline timeout instead of doing ~150k sequential upserts.
  const merged = new Map<
    string,
    { table: string; onConflict: string; row: Record<string, unknown> }
  >();

  for (let i = 0; i < seriesIds.length; i += BLS_BATCH_SIZE) {
    const batch = seriesIds.slice(i, i + BLS_BATCH_SIZE);
    const json = await fetchBlsBatchRaw(batch, startYear, endYear);
    const rows = parseCesBatchResponse(json);

    for (const r of rows) {
      if (r.sectorKey === "unknown") {
        skipped++;
        continue;
      }
      const sectorCol =
        r.sectorKey === "total_nonfarm"
          ? "ces_total_nonfarm_employment"
          : `ces_employment_${r.sectorKey}`;
      const table = r.level === "metro" ? "economic_metro" : "economic_state";
      // economic_state uses state_fips (NOT state_code — Phase 0.7 fix).
      const idCol = r.level === "metro" ? "cbsa_code" : "state_fips";
      const idVal = r.level === "metro" ? r.areaCode : r.stateFips;

      const key = `${table}|${idVal}|${r.periodDate}`;
      let entry = merged.get(key);
      if (!entry) {
        entry = {
          table,
          onConflict: `period_date,${idCol}`,
          row: {
            [idCol]: idVal,
            period_date: r.periodDate,
            ces_period_date: r.periodDate,
          },
        };
        // economic_metro carries an indexed state_fips column; populate it
        // when we know it so the row is queryable by state.
        if (r.level === "metro") entry.row.state_fips = r.stateFips;
        merged.set(key, entry);
      }
      entry.row[sectorCol] = r.value;
    }
  }

  // One upsert per merged (geography, month) row. Isolate failures so a single
  // transient upsert error doesn't abort the remaining thousands of rows.
  let inserted = 0;
  let failed = 0;
  for (const { table, onConflict, row } of merged.values()) {
    const { error } = await supabase.from(table).upsert(row, { onConflict });
    if (error) {
      console.warn(
        `  CES upsert failed (${table} @ ${String(row.period_date)}): ${error.message}`,
      );
      failed++;
      continue;
    }
    inserted++;
  }
  return { inserted, skipped, failed };
}
