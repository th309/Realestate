/**
 * Wide-to-long CSV transposition for Zillow data.
 *
 * Zillow CSVs use a WIDE format where each date is a column header:
 *   RegionID, RegionName, ..., 2023-01-31, 2023-02-28, 2023-03-31, ...
 *   10001,    "New York, NY",  499000,     501000,     503000, ...
 *
 * This transformer transposes each row into multiple long-format records:
 *   { region_id, region_name, state_code, period_date, metric_name, value }
 *
 * Geography-specific fields (cbsa_code, fips_code) are added by the
 * region extractor functions in zillow-region-extractors.ts.
 */

import { parseNumeric, normalizeZipCode, normalizeFipsCode } from '../../lib';
import type { ZillowGeography } from './zillow-dataset-configs';

// ---------------------------------------------------------------------------
// State name to abbreviation mapping
// ---------------------------------------------------------------------------

const STATE_NAME_TO_CODE: Record<string, string> = {
  'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR',
  'California': 'CA', 'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE',
  'Florida': 'FL', 'Georgia': 'GA', 'Hawaii': 'HI', 'Idaho': 'ID',
  'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA', 'Kansas': 'KS',
  'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
  'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS',
  'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV',
  'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY',
  'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH', 'Oklahoma': 'OK',
  'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
  'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT',
  'Vermont': 'VT', 'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV',
  'Wisconsin': 'WI', 'Wyoming': 'WY', 'District of Columbia': 'DC',
};

// Date column regex: YYYY-MM-DD format
const DATE_COLUMN_REGEX = /^\d{4}-\d{2}-\d{2}$/;

// ---------------------------------------------------------------------------
// Region field extraction (geography-specific)
// ---------------------------------------------------------------------------

/**
 * Extract the state code from a Zillow CSV row.
 * Checks State, StateName, and RegionName fields.
 */
function extractStateCode(row: Record<string, string>): string | null {
  // Explicit State column (2-letter code, common in metro/county CSVs)
  if (row.State && row.State.length === 2) return row.State;

  // StateName column (full name or 2-letter code)
  if (row.StateName) {
    if (row.StateName.length === 2) return row.StateName;
    const mapped = STATE_NAME_TO_CODE[row.StateName];
    if (mapped) return mapped;
  }

  // For state-level files, RegionName might be the state name
  if (row.RegionName && STATE_NAME_TO_CODE[row.RegionName]) {
    return STATE_NAME_TO_CODE[row.RegionName];
  }

  // Special case for national aggregate row
  if (row.RegionName === 'United States') return 'US';

  return null;
}

/**
 * Build a 5-digit FIPS code from separate state and county FIPS fields.
 * Returns null if either component is missing.
 */
function buildCountyFipsCode(row: Record<string, string>): string | null {
  const stateFips = row.StateCodeFIPS;
  const countyFips = row.MunicipalCodeFIPS;
  if (!stateFips || !countyFips) return null;

  return normalizeFipsCode(stateFips, 2) + normalizeFipsCode(countyFips, 3);
}

/**
 * Extract geography-specific fields from a Zillow CSV row.
 */
function extractGeoFields(
  row: Record<string, string>,
  geography: ZillowGeography,
): Record<string, unknown> {
  const fields: Record<string, unknown> = {};

  if (geography === 'metro' && row.CBSACode) {
    fields.cbsa_code = row.CBSACode;
  }
  if (geography === 'county') {
    const fips = buildCountyFipsCode(row);
    if (fips) fields.fips_code = fips;
  }

  return fields;
}

/**
 * Normalize the region name for a given geography level.
 * ZIP codes are zero-padded to 5 digits.
 */
function normalizeRegionName(regionName: string, geography: ZillowGeography): string {
  if (geography === 'zip') {
    return normalizeZipCode(regionName) ?? regionName;
  }
  return regionName;
}

// ---------------------------------------------------------------------------
// Core transposition function
// ---------------------------------------------------------------------------

/**
 * Transpose a single Zillow WIDE-format CSV row into multiple long-format DB records.
 *
 * For a row with 300 date columns, this returns up to 300 records
 * (one per date column that has a valid numeric value).
 */
export function transposeWideRow(
  row: Record<string, string>,
  metricName: string,
  geography: ZillowGeography,
  dateColumns: string[],
): Record<string, unknown>[] {
  const regionId = parseInt(row.RegionID, 10);
  if (isNaN(regionId)) return [];

  const rawRegionName = row.RegionName || '';
  if (!rawRegionName) return [];

  const regionName = normalizeRegionName(rawRegionName, geography);
  const stateCode = extractStateCode(row);
  const geoFields = extractGeoFields(row, geography);

  const records: Record<string, unknown>[] = [];

  for (const dateCol of dateColumns) {
    const value = parseNumeric(row[dateCol]);
    if (value === null) continue;

    records.push({
      region_id: regionId,
      region_name: regionName,
      state_code: stateCode,
      period_date: dateCol,
      metric_name: metricName,
      value,
      ...geoFields,
    });
  }

  return records;
}

/**
 * Detect date columns from a sample row's keys.
 * Date columns match the YYYY-MM-DD pattern.
 */
export function detectDateColumns(sampleRow: Record<string, string>): string[] {
  return Object.keys(sampleRow).filter((key) => DATE_COLUMN_REGEX.test(key));
}

/**
 * Transpose all rows from a Zillow WIDE-format CSV into long-format DB records.
 *
 * This is the main entry point for the transformer.
 * Returns all records ready for batch upsert, plus counts for logging.
 */
export function transposeAllRows(
  rows: Record<string, string>[],
  metricName: string,
  geography: ZillowGeography,
): { records: Record<string, unknown>[]; rowsProcessed: number; rowsSkipped: number } {
  if (rows.length === 0) {
    return { records: [], rowsProcessed: 0, rowsSkipped: 0 };
  }

  const dateColumns = detectDateColumns(rows[0]);
  console.log(`  Detected ${dateColumns.length} date columns (${dateColumns[0]} to ${dateColumns[dateColumns.length - 1]})`);

  const allRecords: Record<string, unknown>[] = [];
  let rowsSkipped = 0;

  for (const row of rows) {
    const transposed = transposeWideRow(row, metricName, geography, dateColumns);
    if (transposed.length === 0) {
      rowsSkipped++;
    } else {
      allRecords.push(...transposed);
    }
  }

  return {
    records: allRecords,
    rowsProcessed: rows.length,
    rowsSkipped,
  };
}
