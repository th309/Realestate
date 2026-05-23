/**
 * Column mapping logic for Redfin TSV files.
 *
 * Maps raw TSV rows directly to per-geography database records using
 * the 14 core metrics (each with _mom and _yoy variants) plus
 * geography-specific identifier columns.
 *
 * Note: Redfin TSV headers are UPPERCASE (e.g., MEDIAN_SALE_PRICE, STATE_CODE).
 * The mapper reads UPPERCASE keys from the TSV and writes lowercase keys for the DB.
 */

import { parseNumeric } from "../../lib";
import { METRIC_COLUMNS, STATE_FIPS } from "./redfin-config";
import { toCanonicalCbsa } from "./cbsa-crosswalk";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A fully parsed record ready for DB upsert. */
export interface RedfinMappedRecord {
  /** Period end date (used for latestPeriodDate tracking). */
  periodEnd: string;
  /** The database record with all columns set. */
  dbRecord: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Strip surrounding quotes from a TSV value. */
function unquote(val: string | undefined | null): string | null {
  if (!val) return null;
  return val.replace(/^"|"$/g, "").trim() || null;
}

/** Normalize Redfin ZIP region strings like "Zip Code: 02129" to "02129". */
function normalizeZipCode(val: string | undefined | null): string | null {
  const text = unquote(val);
  if (!text) return null;
  const prefixedMatch = text.match(/Zip\s+Code:\s*([0-9]{5})(?:-[0-9]{4})?$/i);
  if (prefixedMatch) return prefixedMatch[1];
  const plainMatch = text.match(/^([0-9]{5})(?:-[0-9]{4})?$/);
  if (plainMatch) return plainMatch[1];
  return text;
}

// ---------------------------------------------------------------------------
// Row mapping: TSV row object -> database record
// ---------------------------------------------------------------------------

/**
 * Map a single TSV data row (object with UPPERCASE keys) to a RedfinMappedRecord.
 *
 * Filters out seasonally adjusted data. Extracts all 14 metrics + MOM + YOY.
 * Sets geography-specific identifier columns based on geoLevel.
 *
 * Returns null if the row should be skipped (seasonally adjusted or missing date).
 */
export function mapTsvRowToRecord(
  row: Record<string, string>,
  geoLevel: string,
  lookupCountyFips?: (
    county: string | null,
    state: string | null,
  ) => string | null,
  dateCutoff?: string | null,
): RedfinMappedRecord | null {
  // Filter out seasonally adjusted data
  const sa = unquote(row.IS_SEASONALLY_ADJUSTED);
  if (sa === "true" || sa === "TRUE") return null;
  if (!row.PERIOD_END) return null;

  // Filter by date cutoff (--recent flag): skip rows older than the cutoff
  if (dateCutoff) {
    const periodEnd = unquote(row.PERIOD_END);
    if (periodEnd && periodEnd < dateCutoff) return null;
  }

  const stateCode = unquote(row.STATE_CODE);
  const tableId = parseNumeric(row.TABLE_ID);
  const parentMetroCode = unquote(row.PARENT_METRO_REGION_METRO_CODE);

  const dbRecord: Record<string, unknown> = {
    period_begin: unquote(row.PERIOD_BEGIN) || "",
    period_end: unquote(row.PERIOD_END) || "",
    property_type: unquote(row.PROPERTY_TYPE) || "All Residential",
    parent_metro_region: unquote(row.PARENT_METRO_REGION),
    parent_metro_region_metro_code: parentMetroCode,
    last_updated: unquote(row.LAST_UPDATED),
    redfin_table_id: tableId !== null ? Math.round(tableId) : null,
  };

  // Parse all 14 metrics + _mom + _yoy
  for (const metric of METRIC_COLUMNS) {
    const upper = metric.toUpperCase();
    dbRecord[metric] = parseNumeric(row[upper] ?? "");
    dbRecord[`${metric}_mom`] = parseNumeric(row[`${upper}_MOM`] ?? "");
    dbRecord[`${metric}_yoy`] = parseNumeric(row[`${upper}_YOY`] ?? "");
  }

  // Set geography-specific identifier columns
  switch (geoLevel) {
    case "national":
      break;
    case "state":
      dbRecord.state_code = stateCode;
      dbRecord.state_name = unquote(row.STATE);
      dbRecord.state_fips = stateCode ? STATE_FIPS[stateCode] || null : null;
      break;
    case "metro":
      dbRecord.region_name = unquote(row.REGION);
      // Redfin reports ~13 large metros under pre-2023 metro-division codes
      // (e.g. NYC=35614); normalize to the system's canonical 2023 MSA code
      // (35620) so scores/metrics join to the rest of the platform.
      dbRecord.cbsa_code = toCanonicalCbsa(
        tableId !== null ? String(Math.round(tableId)) : parentMetroCode,
      );
      break;
    case "county":
      dbRecord.county_name = unquote(row.REGION);
      dbRecord.state_code = stateCode;
      dbRecord.fips_code = lookupCountyFips
        ? lookupCountyFips(dbRecord.county_name as string, stateCode)
        : null;
      break;
    case "city":
      dbRecord.city_name =
        unquote(row.CITY) || unquote(row.REGION)?.split(",")[0]?.trim() || null;
      dbRecord.state_code = stateCode;
      break;
    case "zip":
      dbRecord.zip_code = normalizeZipCode(row.REGION);
      dbRecord.state_code = stateCode;
      break;
    case "neighborhood":
      dbRecord.neighborhood_name = unquote(row.REGION);
      dbRecord.city = unquote(row.CITY);
      dbRecord.state_code = stateCode;
      break;
  }

  const periodEnd = unquote(row.PERIOD_END) || "";
  return { periodEnd, dbRecord };
}
