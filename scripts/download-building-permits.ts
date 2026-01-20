/**
 * Download Building Permits Data from Census Bureau BPS
 *
 * Data source: U.S. Census Bureau Building Permits Survey (BPS)
 * URL: https://www2.census.gov/econ/bps/
 *
 * Downloads monthly county-level and state-level building permits data.
 * Metro (CBSA) data requires separate handling via Excel files.
 *
 * Usage:
 *   npx tsx scripts/download-building-permits.ts
 *   npx tsx scripts/download-building-permits.ts --start-year=2020
 *   npx tsx scripts/download-building-permits.ts --year=2024  # Single year only
 */

import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { parse } from 'csv-parse/sync';

const OUTPUT_DIR = join(process.cwd(), 'data/permits');
const BPS_BASE_URL = 'https://www2.census.gov/econ/bps';

// Rate limiting - be respectful of Census servers
const DELAY_MS = 300;

// Default to 10 years of data
const DEFAULT_START_YEAR = 2015;
const DEFAULT_END_YEAR = 2024;

interface RawPermitRecord {
  survey_date: string;     // YYYYMM
  state_fips: string;
  county_fips: string;
  region_code: string;
  division_code: string;
  county_name: string;
  // 1-unit (single-family)
  sf_buildings: string;
  sf_units: string;
  sf_value: string;
  // 2-units (duplex)
  duplex_buildings: string;
  duplex_units: string;
  duplex_value: string;
  // 3-4 units (small multi)
  small_multi_buildings: string;
  small_multi_units: string;
  small_multi_value: string;
  // 5+ units (large multi)
  large_multi_buildings: string;
  large_multi_units: string;
  large_multi_value: string;
}

interface PermitRecord {
  period_date: string;       // YYYY-MM-01
  fips_code: string;         // 5-digit county FIPS
  county_name: string;
  state_fips: string;
  region_code: string;
  division_code: string;
  sf_buildings: number | null;
  sf_units: number | null;
  sf_value: number | null;
  duplex_buildings: number | null;
  duplex_units: number | null;
  duplex_value: number | null;
  small_multi_buildings: number | null;
  small_multi_units: number | null;
  small_multi_value: number | null;
  large_multi_buildings: number | null;
  large_multi_units: number | null;
  large_multi_value: number | null;
  total_buildings: number | null;
  total_units: number | null;
  total_value: number | null;
}

interface PermitRecordWithYoY extends PermitRecord {
  sf_units_yoy: number | null;
  total_units_yoy: number | null;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function parseInteger(value: string | undefined): number | null {
  if (!value || value.trim() === '') return null;
  const num = parseInt(value.replace(/,/g, ''), 10);
  return isNaN(num) ? null : num;
}

/**
 * Fetch monthly county permits data
 * File format: co{YYMM}c.txt (e.g., co2401c.txt for Jan 2024)
 */
async function fetchMonthlyCountyData(year: number, month: number): Promise<RawPermitRecord[] | null> {
  const yy = String(year).slice(2);
  const mm = String(month).padStart(2, '0');
  const filename = `co${yy}${mm}c.txt`;
  const url = `${BPS_BASE_URL}/County/${filename}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      if (response.status === 404) {
        console.log(`  No data for ${year}-${mm}`);
        return null;
      }
      console.warn(`  HTTP ${response.status} for ${filename}`);
      return null;
    }

    const csvText = await response.text();
    if (!csvText.trim()) {
      return null;
    }

    // Skip the first 2 header rows
    const lines = csvText.split('\n');
    const dataLines = lines.slice(2).join('\n');

    const records = parse(dataLines, {
      columns: [
        'survey_date', 'state_fips', 'county_fips', 'region_code', 'division_code', 'county_name',
        'sf_buildings', 'sf_units', 'sf_value',
        'duplex_buildings', 'duplex_units', 'duplex_value',
        'small_multi_buildings', 'small_multi_units', 'small_multi_value',
        'large_multi_buildings', 'large_multi_units', 'large_multi_value',
        // Skip the "reported" columns - we use the main data columns
        'sf_buildings_rep', 'sf_units_rep', 'sf_value_rep',
        'duplex_buildings_rep', 'duplex_units_rep', 'duplex_value_rep',
        'small_multi_buildings_rep', 'small_multi_units_rep', 'small_multi_value_rep',
        'large_multi_buildings_rep', 'large_multi_units_rep', 'large_multi_value_rep'
      ],
      skip_empty_lines: true,
      relax_column_count: true,
      trim: true
    }) as RawPermitRecord[];

    return records;
  } catch (error) {
    console.warn(`  Error fetching ${filename}: ${error}`);
    return null;
  }
}

/**
 * Parse raw records into typed permit records
 */
function parsePermitRecords(rawRecords: RawPermitRecord[]): PermitRecord[] {
  const results: PermitRecord[] = [];

  for (const raw of rawRecords) {
    // Skip if missing required fields
    if (!raw.state_fips || !raw.county_fips || !raw.survey_date) continue;

    // Build 5-digit FIPS code
    const stateFips = raw.state_fips.padStart(2, '0');
    const countyFips = raw.county_fips.padStart(3, '0');
    const fipsCode = stateFips + countyFips;

    // Convert survey date (YYYYMM) to period_date (YYYY-MM-01)
    const year = raw.survey_date.slice(0, 4);
    const month = raw.survey_date.slice(4, 6);
    const periodDate = `${year}-${month}-01`;

    // Parse numeric values
    const sfBuildings = parseInteger(raw.sf_buildings);
    const sfUnits = parseInteger(raw.sf_units);
    const sfValue = parseInteger(raw.sf_value);
    const duplexBuildings = parseInteger(raw.duplex_buildings);
    const duplexUnits = parseInteger(raw.duplex_units);
    const duplexValue = parseInteger(raw.duplex_value);
    const smallMultiBuildings = parseInteger(raw.small_multi_buildings);
    const smallMultiUnits = parseInteger(raw.small_multi_units);
    const smallMultiValue = parseInteger(raw.small_multi_value);
    const largeMultiBuildings = parseInteger(raw.large_multi_buildings);
    const largeMultiUnits = parseInteger(raw.large_multi_units);
    const largeMultiValue = parseInteger(raw.large_multi_value);

    // Calculate totals
    const totalBuildings = [sfBuildings, duplexBuildings, smallMultiBuildings, largeMultiBuildings]
      .filter(v => v !== null)
      .reduce((sum, v) => sum + (v ?? 0), 0);
    const totalUnits = [sfUnits, duplexUnits, smallMultiUnits, largeMultiUnits]
      .filter(v => v !== null)
      .reduce((sum, v) => sum + (v ?? 0), 0);
    const totalValue = [sfValue, duplexValue, smallMultiValue, largeMultiValue]
      .filter(v => v !== null)
      .reduce((sum, v) => sum + (v ?? 0), 0);

    results.push({
      period_date: periodDate,
      fips_code: fipsCode,
      county_name: raw.county_name || '',
      state_fips: stateFips,
      region_code: raw.region_code || '',
      division_code: raw.division_code || '',
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
      total_buildings: totalBuildings || null,
      total_units: totalUnits || null,
      total_value: totalValue || null
    });
  }

  return results;
}

/**
 * Calculate year-over-year growth for permits
 */
function calculateYoY(records: PermitRecord[]): PermitRecordWithYoY[] {
  // Sort by fips_code and period_date
  const sorted = [...records].sort((a, b) => {
    const fipsCompare = a.fips_code.localeCompare(b.fips_code);
    if (fipsCompare !== 0) return fipsCompare;
    return a.period_date.localeCompare(b.period_date);
  });

  // Create lookup for previous year values
  const lookup = new Map<string, PermitRecord>();
  for (const record of sorted) {
    const key = `${record.fips_code}|${record.period_date}`;
    lookup.set(key, record);
  }

  // Calculate YoY
  return sorted.map(record => {
    const currentDate = new Date(record.period_date);
    const prevDate = new Date(currentDate);
    prevDate.setFullYear(prevDate.getFullYear() - 1);
    const prevKey = `${record.fips_code}|${prevDate.toISOString().slice(0, 10)}`;
    const prevRecord = lookup.get(prevKey);

    let sfUnitsYoY: number | null = null;
    let totalUnitsYoY: number | null = null;

    if (prevRecord) {
      if (prevRecord.sf_units && prevRecord.sf_units > 0 && record.sf_units !== null) {
        sfUnitsYoY = ((record.sf_units - prevRecord.sf_units) / prevRecord.sf_units) * 100;
        sfUnitsYoY = Math.round(sfUnitsYoY * 100) / 100;
      }
      if (prevRecord.total_units && prevRecord.total_units > 0 && record.total_units !== null) {
        totalUnitsYoY = ((record.total_units - prevRecord.total_units) / prevRecord.total_units) * 100;
        totalUnitsYoY = Math.round(totalUnitsYoY * 100) / 100;
      }
    }

    return {
      ...record,
      sf_units_yoy: sfUnitsYoY,
      total_units_yoy: totalUnitsYoY
    };
  });
}

/**
 * Aggregate county data to state level
 */
function aggregateToState(countyRecords: PermitRecordWithYoY[]): PermitRecordWithYoY[] {
  // Group by state_fips and period_date
  const stateMap = new Map<string, PermitRecord>();

  for (const record of countyRecords) {
    const key = `${record.state_fips}|${record.period_date}`;
    const existing = stateMap.get(key);

    if (!existing) {
      stateMap.set(key, {
        period_date: record.period_date,
        fips_code: record.state_fips,
        county_name: '', // Will be state name
        state_fips: record.state_fips,
        region_code: record.region_code,
        division_code: record.division_code,
        sf_buildings: record.sf_buildings ?? 0,
        sf_units: record.sf_units ?? 0,
        sf_value: record.sf_value ?? 0,
        duplex_buildings: record.duplex_buildings ?? 0,
        duplex_units: record.duplex_units ?? 0,
        duplex_value: record.duplex_value ?? 0,
        small_multi_buildings: record.small_multi_buildings ?? 0,
        small_multi_units: record.small_multi_units ?? 0,
        small_multi_value: record.small_multi_value ?? 0,
        large_multi_buildings: record.large_multi_buildings ?? 0,
        large_multi_units: record.large_multi_units ?? 0,
        large_multi_value: record.large_multi_value ?? 0,
        total_buildings: record.total_buildings ?? 0,
        total_units: record.total_units ?? 0,
        total_value: record.total_value ?? 0
      });
    } else {
      existing.sf_buildings = (existing.sf_buildings ?? 0) + (record.sf_buildings ?? 0);
      existing.sf_units = (existing.sf_units ?? 0) + (record.sf_units ?? 0);
      existing.sf_value = (existing.sf_value ?? 0) + (record.sf_value ?? 0);
      existing.duplex_buildings = (existing.duplex_buildings ?? 0) + (record.duplex_buildings ?? 0);
      existing.duplex_units = (existing.duplex_units ?? 0) + (record.duplex_units ?? 0);
      existing.duplex_value = (existing.duplex_value ?? 0) + (record.duplex_value ?? 0);
      existing.small_multi_buildings = (existing.small_multi_buildings ?? 0) + (record.small_multi_buildings ?? 0);
      existing.small_multi_units = (existing.small_multi_units ?? 0) + (record.small_multi_units ?? 0);
      existing.small_multi_value = (existing.small_multi_value ?? 0) + (record.small_multi_value ?? 0);
      existing.large_multi_buildings = (existing.large_multi_buildings ?? 0) + (record.large_multi_buildings ?? 0);
      existing.large_multi_units = (existing.large_multi_units ?? 0) + (record.large_multi_units ?? 0);
      existing.large_multi_value = (existing.large_multi_value ?? 0) + (record.large_multi_value ?? 0);
      existing.total_buildings = (existing.total_buildings ?? 0) + (record.total_buildings ?? 0);
      existing.total_units = (existing.total_units ?? 0) + (record.total_units ?? 0);
      existing.total_value = (existing.total_value ?? 0) + (record.total_value ?? 0);
    }
  }

  // Convert to array and calculate YoY
  const stateRecords = Array.from(stateMap.values());
  return calculateYoY(stateRecords);
}

/**
 * Save records to CSV
 */
function saveToCSV(records: PermitRecordWithYoY[], filename: string): void {
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const headers = [
    'period_date', 'fips_code', 'county_name', 'state_fips', 'region_code', 'division_code',
    'sf_buildings', 'sf_units', 'sf_value',
    'duplex_buildings', 'duplex_units', 'duplex_value',
    'small_multi_buildings', 'small_multi_units', 'small_multi_value',
    'large_multi_buildings', 'large_multi_units', 'large_multi_value',
    'total_buildings', 'total_units', 'total_value',
    'sf_units_yoy', 'total_units_yoy'
  ];

  const csvLines = [
    headers.join(','),
    ...records.map(r => headers.map(h => {
      const val = (r as any)[h];
      if (val === null || val === undefined) return '';
      if (typeof val === 'string' && val.includes(',')) return `"${val}"`;
      return val;
    }).join(','))
  ];

  const path = join(OUTPUT_DIR, filename);
  writeFileSync(path, csvLines.join('\n'));
  console.log(`Saved ${records.length} records to ${filename}`);
}

async function main() {
  console.log('='.repeat(60));
  console.log('Census Bureau Building Permits Survey (BPS) Download');
  console.log('='.repeat(60));

  // Parse CLI arguments
  const args = process.argv.slice(2);
  let startYear = DEFAULT_START_YEAR;
  let endYear = DEFAULT_END_YEAR;
  let singleYear: number | null = null;

  for (const arg of args) {
    if (arg.startsWith('--start-year=')) {
      startYear = parseInt(arg.split('=')[1], 10);
    } else if (arg.startsWith('--end-year=')) {
      endYear = parseInt(arg.split('=')[1], 10);
    } else if (arg.startsWith('--year=')) {
      singleYear = parseInt(arg.split('=')[1], 10);
      startYear = singleYear;
      endYear = singleYear;
    }
  }

  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;

  // Don't fetch future data
  if (endYear > currentYear) {
    endYear = currentYear;
  }

  console.log(`\nDownloading data from ${startYear} to ${endYear}`);
  console.log(`Rate limiting: ${DELAY_MS}ms between requests\n`);

  const allCountyRecords: PermitRecord[] = [];
  let fetchCount = 0;

  // Fetch monthly county data
  for (let year = startYear; year <= endYear; year++) {
    const maxMonth = (year === currentYear) ? currentMonth - 1 : 12;

    for (let month = 1; month <= maxMonth; month++) {
      process.stdout.write(`Fetching ${year}-${String(month).padStart(2, '0')}... `);

      const rawRecords = await fetchMonthlyCountyData(year, month);
      if (rawRecords) {
        const parsed = parsePermitRecords(rawRecords);
        allCountyRecords.push(...parsed);
        console.log(`${parsed.length} counties`);
      } else {
        console.log('no data');
      }

      fetchCount++;
      await sleep(DELAY_MS);
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Total fetches: ${fetchCount}`);
  console.log(`Total county records: ${allCountyRecords.length}`);

  // Calculate YoY for county data
  console.log('\nCalculating year-over-year growth...');
  const countyWithYoY = calculateYoY(allCountyRecords);

  // Aggregate to state level
  console.log('Aggregating to state level...');
  const stateRecords = aggregateToState(countyWithYoY);

  // Save results
  console.log('\nSaving CSV files...');
  saveToCSV(countyWithYoY, 'permits_county.csv');
  saveToCSV(stateRecords, 'permits_state.csv');

  // Summary stats
  const uniqueCounties = new Set(countyWithYoY.map(r => r.fips_code)).size;
  const uniqueStates = new Set(stateRecords.map(r => r.state_fips)).size;
  const dateRange = countyWithYoY.length > 0
    ? `${countyWithYoY[0].period_date} to ${countyWithYoY[countyWithYoY.length - 1].period_date}`
    : 'N/A';

  console.log(`\n${'='.repeat(60)}`);
  console.log('Download Complete!');
  console.log(`${'='.repeat(60)}`);
  console.log(`Unique counties: ${uniqueCounties}`);
  console.log(`Unique states: ${uniqueStates}`);
  console.log(`Date range: ${dateRange}`);
  console.log(`\nOutput files:`);
  console.log(`  - data/permits/permits_county.csv`);
  console.log(`  - data/permits/permits_state.csv`);
  console.log(`\nRun: npx tsx scripts/import-building-permits.ts to import to database`);
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
