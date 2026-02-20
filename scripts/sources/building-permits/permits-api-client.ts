/**
 * Census Bureau BPS API client for building permits data.
 *
 * Fetches monthly county-level building permits CSV files from the
 * Census Bureau BPS archive, parses raw records, computes per-record
 * totals, calculates year-over-year growth, and aggregates county
 * data to the state level.
 *
 * Data source: https://www2.census.gov/econ/bps/County/
 * File format: co{YY}{MM}c.txt (e.g., co2401c.txt for Jan 2024)
 */

import { parse } from 'csv-parse/sync';
import { parseInteger } from '../../lib';
import {
  BPS_BASE_URL,
  BPS_COUNTY_CSV_COLUMNS,
  RATE_LIMIT_DELAY_MS,
  YOY_FIELDS,
  PERMIT_NUMERIC_FIELDS,
} from './permits-config';
import type { PermitCountyRecord, PermitStateRecord } from './permits-config';

export type { PermitCountyRecord, PermitStateRecord };

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Sum an array of nullable numbers. Returns null if all values are null. */
function sumNullable(values: (number | null)[]): number | null {
  const nonNull = values.filter((v): v is number => v !== null);
  if (nonNull.length === 0) return null;
  return nonNull.reduce((sum, v) => sum + v, 0);
}

// ---------------------------------------------------------------------------
// Fetch + parse a single month of county data
// ---------------------------------------------------------------------------

/**
 * Fetch a single month of county permit data from Census BPS.
 * Returns parsed county records, or an empty array if the file is missing.
 */
export async function fetchMonthlyCountyPermits(
  year: number,
  month: number,
): Promise<PermitCountyRecord[]> {
  const yy = String(year).slice(2);
  const mm = String(month).padStart(2, '0');
  const filename = `co${yy}${mm}c.txt`;
  const url = `${BPS_BASE_URL}/County/${filename}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      if (response.status === 404) {
        console.log(`  No data for ${year}-${mm}`);
      } else {
        console.warn(`  HTTP ${response.status} for ${filename}`);
      }
      return [];
    }

    const csvText = await response.text();
    if (!csvText.trim()) return [];

    // Skip the first 2 header rows in the Census BPS files
    const lines = csvText.split('\n');
    const dataLines = lines.slice(2).join('\n');

    const rawRows = parse(dataLines, {
      columns: [...BPS_COUNTY_CSV_COLUMNS],
      skip_empty_lines: true,
      relax_column_count: true,
      trim: true,
    }) as Record<string, string>[];

    return rawRows
      .filter(row => row.state_fips && row.county_fips && row.survey_date)
      .map(row => mapRawRowToCountyRecord(row));
  } catch (error) {
    console.warn(`  Error fetching ${filename}: ${error}`);
    return [];
  }
}

/** Map a single raw CSV row to a typed PermitCountyRecord. */
function mapRawRowToCountyRecord(row: Record<string, string>): PermitCountyRecord {
  const stateFips = row.state_fips.padStart(2, '0');
  const countyFips = row.county_fips.padStart(3, '0');
  const surveyYear = row.survey_date.slice(0, 4);
  const surveyMonth = row.survey_date.slice(4, 6);

  const sfBuildings = parseInteger(row.sf_buildings);
  const sfUnits = parseInteger(row.sf_units);
  const sfValue = parseInteger(row.sf_value);
  const duplexBuildings = parseInteger(row.duplex_buildings);
  const duplexUnits = parseInteger(row.duplex_units);
  const duplexValue = parseInteger(row.duplex_value);
  const smallMultiBuildings = parseInteger(row.small_multi_buildings);
  const smallMultiUnits = parseInteger(row.small_multi_units);
  const smallMultiValue = parseInteger(row.small_multi_value);
  const largeMultiBuildings = parseInteger(row.large_multi_buildings);
  const largeMultiUnits = parseInteger(row.large_multi_units);
  const largeMultiValue = parseInteger(row.large_multi_value);

  return {
    period_date: `${surveyYear}-${surveyMonth}-01`,
    fips_code: stateFips + countyFips,
    county_name: row.county_name || '',
    state_fips: stateFips,
    region_code: row.region_code || '',
    division_code: row.division_code || '',
    sf_buildings: sfBuildings,
    sf_units: sfUnits,
    sf_value: sfValue,
    duplex_buildings: duplexBuildings,
    duplex_units: duplexUnits,
    duplex_value: duplexValue,
    small_multi_buildings: smallMultiBuildings,
    small_multi_units: smallMultiUnits,
    small_multi_value: smallMultiValue,
    large_multi_buildings: largeMultiBuildings,
    large_multi_units: largeMultiUnits,
    large_multi_value: largeMultiValue,
    total_buildings: sumNullable([sfBuildings, duplexBuildings, smallMultiBuildings, largeMultiBuildings]),
    total_units: sumNullable([sfUnits, duplexUnits, smallMultiUnits, largeMultiUnits]),
    total_value: sumNullable([sfValue, duplexValue, smallMultiValue, largeMultiValue]),
    sf_units_yoy: null,
    total_units_yoy: null,
    updated_at: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Fetch all months in a year range
// ---------------------------------------------------------------------------

/**
 * Fetch county permits for all months in [startYear, endYear].
 * Rate-limits requests with a configurable delay between each.
 */
export async function fetchAllCountyPermits(
  startYear: number,
  endYear: number,
): Promise<PermitCountyRecord[]> {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const clampedEndYear = Math.min(endYear, currentYear);

  const allRecords: PermitCountyRecord[] = [];

  for (let year = startYear; year <= clampedEndYear; year++) {
    const maxMonth = (year === currentYear) ? currentMonth - 1 : 12;

    for (let month = 1; month <= maxMonth; month++) {
      process.stdout.write(`Fetching ${year}-${String(month).padStart(2, '0')}... `);
      const records = await fetchMonthlyCountyPermits(year, month);
      if (records.length > 0) {
        allRecords.push(...records);
        console.log(`${records.length} counties`);
      } else {
        console.log('no data');
      }
      await sleep(RATE_LIMIT_DELAY_MS);
    }
  }

  return allRecords;
}

// ---------------------------------------------------------------------------
// Year-over-year calculation
// ---------------------------------------------------------------------------

/**
 * Compute year-over-year percentage change for sf_units and total_units.
 * Mutates records in place for efficiency.
 */
export function computeYearOverYear<T extends Record<string, unknown>>(
  records: T[],
  regionKeyField: string,
): void {
  // Build lookup: "regionKey|period_date" -> record
  const lookup = new Map<string, T>();
  for (const record of records) {
    const key = `${record[regionKeyField]}|${record.period_date}`;
    lookup.set(key, record);
  }

  for (const record of records) {
    const currentDate = new Date(record.period_date as string);
    const prevDate = new Date(currentDate);
    prevDate.setFullYear(prevDate.getFullYear() - 1);
    const prevKey = `${record[regionKeyField]}|${prevDate.toISOString().slice(0, 10)}`;
    const prevRecord = lookup.get(prevKey);

    if (!prevRecord) continue;

    for (const [sourceField, yoyField] of Object.entries(YOY_FIELDS)) {
      const currentValue = record[sourceField] as number | null;
      const previousValue = prevRecord[sourceField] as number | null;

      if (previousValue && previousValue > 0 && currentValue !== null) {
        const yoyPercent = ((currentValue - previousValue) / previousValue) * 100;
        (record as Record<string, unknown>)[yoyField] = Math.round(yoyPercent * 100) / 100;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// State-level aggregation
// ---------------------------------------------------------------------------

/**
 * Aggregate county-level permit records to state-level totals.
 * Groups by state_fips + period_date, sums all numeric fields
 * using PERMIT_NUMERIC_FIELDS, then computes YoY on the result.
 */
export function aggregateCountyToState(countyRecords: PermitCountyRecord[]): PermitStateRecord[] {
  const stateMap = new Map<string, PermitStateRecord>();
  const updatedAt = new Date().toISOString();

  for (const county of countyRecords) {
    const key = `${county.state_fips}|${county.period_date}`;
    const existing = stateMap.get(key);

    if (!existing) {
      const newRecord: PermitStateRecord = {
        period_date: county.period_date,
        state_fips: county.state_fips,
        state_name: null,
        sf_buildings: 0, sf_units: 0, sf_value: 0,
        duplex_buildings: 0, duplex_units: 0, duplex_value: 0,
        small_multi_buildings: 0, small_multi_units: 0, small_multi_value: 0,
        large_multi_buildings: 0, large_multi_units: 0, large_multi_value: 0,
        total_buildings: 0, total_units: 0, total_value: 0,
        sf_units_yoy: null, total_units_yoy: null,
        updated_at: updatedAt,
      };
      for (const field of PERMIT_NUMERIC_FIELDS) {
        newRecord[field] = county[field] ?? 0;
      }
      stateMap.set(key, newRecord);
    } else {
      for (const field of PERMIT_NUMERIC_FIELDS) {
        existing[field] = ((existing[field] as number) ?? 0) + ((county[field] as number) ?? 0);
      }
    }
  }

  const stateRecords = Array.from(stateMap.values());
  computeYearOverYear(stateRecords, 'state_fips');
  return stateRecords;
}
