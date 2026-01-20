/**
 * Combine and Calculate Economic Data
 *
 * Combines separate CSV files into unified format and calculates YoY metrics:
 * - Census: population_yoy, income_yoy from multi-year data
 * - Economic: gdp_yoy from BEA multi-year GDP data
 * - Economic: unemployment_rate_yoy from FRED monthly data
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { parse } from 'csv-parse/sync';
import { STATE_FIPS_TO_NAME, STATE_FIPS_TO_ABBREV } from './census-economic-import/types';

const DATA_DIR = join(__dirname, '../data/economic');

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function readCSV(filename: string): any[] {
  const path = join(DATA_DIR, filename);
  if (!existsSync(path)) {
    console.log(`  File not found: ${filename}`);
    return [];
  }
  const content = readFileSync(path, 'utf-8');
  return parse(content, { columns: true, skip_empty_lines: true });
}

function writeCSV(filename: string, data: any[]): void {
  if (data.length === 0) {
    console.log(`  No data to write for ${filename}`);
    return;
  }

  const headers = Object.keys(data[0]);
  const rows = data.map(row =>
    headers.map(h => {
      const val = row[h];
      if (val === null || val === undefined) return '';
      if (typeof val === 'string' && (val.includes(',') || val.includes('"'))) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    }).join(',')
  );

  const csv = [headers.join(','), ...rows].join('\n');
  const path = join(DATA_DIR, filename);
  writeFileSync(path, csv);
  console.log(`  Wrote ${data.length} records to ${filename}`);
}

function calculateYoY(currentValue: number | null, previousValue: number | null): number | null {
  if (!currentValue || !previousValue || previousValue === 0) return null;
  return ((currentValue - previousValue) / previousValue) * 100;
}

/**
 * Safely parse a numeric value, returning null for empty/invalid values
 * This prevents converting missing data to 0
 */
function parseNumericOrNull(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : parseFloat(value);
  return isNaN(parsed) ? null : parsed;
}

// ============================================================================
// CENSUS YOY CALCULATIONS
// ============================================================================

function addCensusYoY(records: any[], keyField: string): any[] {
  // Sort by year descending for each geographic unit
  const sorted = [...records].sort((a, b) => {
    const keyCompare = String(a[keyField] || '').localeCompare(String(b[keyField] || ''));
    if (keyCompare !== 0) return keyCompare;
    return Number(b.year) - Number(a.year);
  });

  // Create lookup by key+year
  const lookup = new Map<string, any>();
  for (const row of sorted) {
    const key = `${row[keyField]}|${row.year}`;
    lookup.set(key, row);
  }

  // Calculate YoY for each record
  return sorted.map(row => {
    const prevYear = Number(row.year) - 1;
    const prevKey = `${row[keyField]}|${prevYear}`;
    const prevRow = lookup.get(prevKey);

    const currentPop = parseInt(row.total_population) || null;
    const prevPop = prevRow ? parseInt(prevRow.total_population) || null : null;

    const currentIncome = parseInt(row.median_household_income) || null;
    const prevIncome = prevRow ? parseInt(prevRow.median_household_income) || null : null;

    return {
      ...row,
      population_yoy: calculateYoY(currentPop, prevPop)?.toFixed(2) || null,
      income_yoy: calculateYoY(currentIncome, prevIncome)?.toFixed(2) || null,
    };
  });
}

function processCensusFiles(): void {
  console.log('\nProcessing Census files with YoY calculations...');

  // Census National
  const national = readCSV('census_national.csv');
  if (national.length > 0) {
    // For national, use a dummy key field
    const withYoY = national.map((r, i, arr) => {
      const prevRow = arr.find(p => Number(p.year) === Number(r.year) - 1);
      const currentPop = parseInt(r.total_population) || null;
      const prevPop = prevRow ? parseInt(prevRow.total_population) || null : null;
      const currentIncome = parseInt(r.median_household_income) || null;
      const prevIncome = prevRow ? parseInt(prevRow.median_household_income) || null : null;

      return {
        ...r,
        population_yoy: calculateYoY(currentPop, prevPop)?.toFixed(2) || null,
        income_yoy: calculateYoY(currentIncome, prevIncome)?.toFixed(2) || null,
      };
    });
    writeCSV('census_national.csv', withYoY);
  }

  // Census State
  const state = readCSV('census_state.csv');
  if (state.length > 0) {
    const withYoY = addCensusYoY(state, 'state_fips');
    writeCSV('census_state.csv', withYoY);
  }

  // Census Metro
  const metro = readCSV('census_metro.csv');
  if (metro.length > 0) {
    const withYoY = addCensusYoY(metro, 'cbsa_code');
    writeCSV('census_metro.csv', withYoY);
  }

  // Census County
  const county = readCSV('census_county.csv');
  if (county.length > 0) {
    const withYoY = addCensusYoY(county, 'fips_code');
    writeCSV('census_county.csv', withYoY);
  }

  // Census City
  const city = readCSV('census_city.csv');
  if (city.length > 0) {
    const withYoY = addCensusYoY(city, 'place_fips');
    writeCSV('census_city.csv', withYoY);
  }

  // Census ZIP (ZCTA)
  const zip = readCSV('census_zip.csv');
  if (zip.length > 0) {
    const withYoY = addCensusYoY(zip, 'zcta');
    writeCSV('census_zip.csv', withYoY);
  }
}

// ============================================================================
// ECONOMIC DATA COMBINING + YOY
// ============================================================================

interface StateEconomicData {
  period_date: string;
  state_fips: string;
  state_name: string;
  state_abbrev: string;
  unemployment_rate?: number | null;
  unemployment_rate_yoy?: number | null;
  total_nonfarm_employment?: number | null;
  employment_yoy?: number | null;
  gdp_millions?: number | null;
  real_gdp_millions?: number | null;
  gdp_yoy?: number | null;
  rpp_all_items?: number | null;
}

interface MetroEconomicData {
  period_date: string;
  cbsa_code: string;
  cbsa_title: string;
  unemployment_rate?: number | null;
  unemployment_rate_yoy?: number | null;
  total_nonfarm_employment?: number | null;
  employment_yoy?: number | null;
  gdp_millions?: number | null;
  gdp_yoy?: number | null;
  rpp_all_items?: number | null;
}

interface CountyEconomicData {
  period_date: string;
  fips_code: string;
  county_name: string;
  state_fips: string;
  unemployment_rate?: number | null;
  unemployment_rate_yoy?: number | null;
  gdp_millions?: number | null;
  gdp_yoy?: number | null;
}

function combineStateData(): void {
  console.log('\nCombining state economic data with YoY calculations...');

  // Read all source files
  const unemployment = readCSV('fred_state_unemployment.csv');
  const employment = readCSV('fred_state_employment.csv');
  const gdp = readCSV('bea_state_gdp.csv');
  const realGdp = readCSV('bea_state_real_gdp.csv');
  const rpp = readCSV('bea_state_rpp.csv');

  console.log(`  Unemployment records: ${unemployment.length}`);
  console.log(`  Employment records: ${employment.length}`);
  console.log(`  GDP records: ${gdp.length}`);
  console.log(`  Real GDP records: ${realGdp.length}`);
  console.log(`  RPP records: ${rpp.length}`);

  // Create lookup maps
  const gdpMap = new Map<string, number>();
  const gdpByStateYear = new Map<string, number>(); // For YoY calc
  for (const row of gdp) {
    const key = `${row.period_date}|${row.state_fips}`;
    const gdpVal = parseFloat(row.gdp_millions) || 0;
    gdpMap.set(key, gdpVal);

    const year = row.period_date?.substring(0, 4);
    const yearKey = `${year}|${row.state_fips}`;
    gdpByStateYear.set(yearKey, gdpVal);
  }

  const realGdpMap = new Map<string, number>();
  for (const row of realGdp) {
    const key = `${row.period_date}|${row.state_fips}`;
    realGdpMap.set(key, parseFloat(row.real_gdp_millions) || 0);
  }

  const rppMap = new Map<string, number>();
  for (const row of rpp) {
    const key = `${row.period_date}|${row.state_fips}`;
    rppMap.set(key, parseFloat(row.rpp_all_items) || 0);
  }

  // Calculate unemployment YoY (compare same month previous year)
  const unempByStateMonth = new Map<string, number | null>();
  for (const row of unemployment) {
    const key = `${row.period_date}|${row.state_fips}`;
    unempByStateMonth.set(key, parseNumericOrNull(row.unemployment_rate));
  }

  // Employment data by state+date
  const empByStateMonth = new Map<string, number | null>();
  for (const row of employment) {
    const key = `${row.period_date}|${row.state_fips}`;
    empByStateMonth.set(key, parseNumericOrNull(row.total_nonfarm_employment));
  }

  // Combine data
  const combined: StateEconomicData[] = [];
  const seenKeys = new Set<string>();

  // Process unemployment records (monthly)
  for (const row of unemployment) {
    const key = `${row.period_date}|${row.state_fips}`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);

    const currentUnemp = parseNumericOrNull(row.unemployment_rate);

    // YoY for unemployment - same month previous year
    const prevDate = getPreviousYearDate(row.period_date);
    const prevKey = `${prevDate}|${row.state_fips}`;
    const prevUnemp = unempByStateMonth.get(prevKey) ?? null;
    const unempYoY = (currentUnemp && prevUnemp)
      ? (currentUnemp - prevUnemp).toFixed(2)
      : null;

    // GDP YoY (annual data, same year)
    const year = row.period_date?.substring(0, 4);
    const prevYear = String(parseInt(year) - 1);
    const currentGdp = gdpByStateYear.get(`${year}|${row.state_fips}`) || null;
    const prevGdp = gdpByStateYear.get(`${prevYear}|${row.state_fips}`) || null;
    const gdpYoY = calculateYoY(currentGdp, prevGdp);

    // Employment YoY (same month previous year)
    const currentEmp = empByStateMonth.get(key) ?? null;
    const prevEmp = empByStateMonth.get(prevKey) ?? null;
    const empYoY = calculateYoY(currentEmp, prevEmp);

    combined.push({
      period_date: row.period_date,
      state_fips: row.state_fips,
      state_name: row.state_name || STATE_FIPS_TO_NAME[row.state_fips] || '',
      state_abbrev: row.state_abbrev || STATE_FIPS_TO_ABBREV[row.state_fips] || '',
      unemployment_rate: currentUnemp,
      unemployment_rate_yoy: unempYoY ? parseFloat(unempYoY) : null,
      total_nonfarm_employment: currentEmp,
      employment_yoy: empYoY ? parseFloat(empYoY.toFixed(2)) : null,
      gdp_millions: gdpMap.get(key) || null,
      real_gdp_millions: realGdpMap.get(key) || null,
      gdp_yoy: gdpYoY ? parseFloat(gdpYoY.toFixed(2)) : null,
      rpp_all_items: rppMap.get(key) || null
    });
  }

  // Add any GDP/RPP records not covered by unemployment (annual dates)
  for (const row of [...gdp, ...rpp]) {
    const key = `${row.period_date}|${row.state_fips}`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);

    const year = row.period_date?.substring(0, 4);
    const prevYear = String(parseInt(year) - 1);
    const currentGdp = gdpByStateYear.get(`${year}|${row.state_fips}`) || null;
    const prevGdp = gdpByStateYear.get(`${prevYear}|${row.state_fips}`) || null;
    const gdpYoY = calculateYoY(currentGdp, prevGdp);

    combined.push({
      period_date: row.period_date,
      state_fips: row.state_fips,
      state_name: row.state_name || STATE_FIPS_TO_NAME[row.state_fips] || '',
      state_abbrev: STATE_FIPS_TO_ABBREV[row.state_fips] || '',
      gdp_millions: gdpMap.get(key) || null,
      real_gdp_millions: realGdpMap.get(key) || null,
      gdp_yoy: gdpYoY ? parseFloat(gdpYoY.toFixed(2)) : null,
      rpp_all_items: rppMap.get(key) || null
    });
  }

  // Sort by date desc, then state
  combined.sort((a, b) => {
    const dateCompare = b.period_date.localeCompare(a.period_date);
    if (dateCompare !== 0) return dateCompare;
    return a.state_fips.localeCompare(b.state_fips);
  });

  writeCSV('economic_state.csv', combined);
}

function combineMetroData(): void {
  console.log('\nCombining metro economic data with YoY calculations...');

  // Use BLS metro unemployment (all metros) instead of FRED (limited metros)
  const unemployment = readCSV('bls_metro_unemployment.csv');
  const employment = readCSV('fred_metro_employment.csv');
  const gdp = readCSV('bea_metro_gdp.csv');
  const rpp = readCSV('bea_metro_rpp.csv');

  console.log(`  Unemployment records: ${unemployment.length}`);
  console.log(`  Employment records: ${employment.length}`);
  console.log(`  GDP records: ${gdp.length}`);
  console.log(`  RPP records: ${rpp.length}`);

  // Unemployment by CBSA+date
  const unempByCbsaMonth = new Map<string, number | null>();
  for (const row of unemployment) {
    const key = `${row.period_date}|${row.cbsa_code}`;
    unempByCbsaMonth.set(key, parseNumericOrNull(row.unemployment_rate));
  }

  // Employment by CBSA+date for YoY
  const empByCbsaMonth = new Map<string, number | null>();
  for (const row of employment) {
    const key = `${row.period_date}|${row.cbsa_code}`;
    empByCbsaMonth.set(key, parseNumericOrNull(row.total_nonfarm_employment));
  }

  // GDP by CBSA+year for YoY
  const gdpByCbsaYear = new Map<string, { gdp: number; title: string }>();
  // Master lookup for CBSA titles (cbsa_code -> title)
  const cbsaTitleLookup = new Map<string, string>();
  for (const row of gdp) {
    const year = row.period_date?.substring(0, 4);
    const key = `${year}|${row.cbsa_code}`;
    gdpByCbsaYear.set(key, {
      gdp: parseFloat(row.gdp_millions) || 0,
      title: row.cbsa_title || ''
    });
    // Store title by cbsa_code for fallback lookup
    if (row.cbsa_title && !cbsaTitleLookup.has(row.cbsa_code)) {
      cbsaTitleLookup.set(row.cbsa_code, row.cbsa_title);
    }
  }

  const rppMap = new Map<string, { rpp: number; title: string }>();
  for (const row of rpp) {
    const key = `${row.period_date}|${row.cbsa_code}`;
    rppMap.set(key, {
      rpp: parseFloat(row.rpp_all_items) || 0,
      title: row.cbsa_title || ''
    });
  }

  const combined: MetroEconomicData[] = [];
  const seenKeys = new Set<string>();

  // Process unemployment records first (monthly data)
  for (const row of unemployment) {
    const key = `${row.period_date}|${row.cbsa_code}`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);

    const prevDate = getPreviousYearDate(row.period_date);
    const prevKey = `${prevDate}|${row.cbsa_code}`;

    const currentUnemp = parseNumericOrNull(row.unemployment_rate);
    const prevUnemp = unempByCbsaMonth.get(prevKey) ?? null;
    const unempYoY = (currentUnemp && prevUnemp)
      ? (currentUnemp - prevUnemp).toFixed(2)
      : null;

    const currentEmp = empByCbsaMonth.get(key) ?? null;
    const prevEmp = empByCbsaMonth.get(prevKey) ?? null;
    const empYoY = calculateYoY(currentEmp, prevEmp);

    const year = row.period_date?.substring(0, 4);
    const prevYear = String(parseInt(year) - 1);
    const currentGdp = gdpByCbsaYear.get(`${year}|${row.cbsa_code}`)?.gdp || null;
    const prevGdp = gdpByCbsaYear.get(`${prevYear}|${row.cbsa_code}`)?.gdp || null;
    const gdpYoY = calculateYoY(currentGdp, prevGdp);

    const gdpKey = `${year}-01-01|${row.cbsa_code}`;
    const rppData = rppMap.get(gdpKey);

    combined.push({
      period_date: row.period_date,
      cbsa_code: row.cbsa_code,
      cbsa_title: gdpByCbsaYear.get(`${year}|${row.cbsa_code}`)?.title || rppData?.title || cbsaTitleLookup.get(row.cbsa_code) || '',
      unemployment_rate: currentUnemp,
      unemployment_rate_yoy: unempYoY ? parseFloat(unempYoY) : null,
      total_nonfarm_employment: currentEmp,
      employment_yoy: empYoY ? parseFloat(empYoY.toFixed(2)) : null,
      gdp_millions: currentGdp,
      gdp_yoy: gdpYoY ? parseFloat(gdpYoY.toFixed(2)) : null,
      rpp_all_items: rppData?.rpp || null
    });
  }

  // Add employment records not covered by unemployment
  for (const row of employment) {
    const key = `${row.period_date}|${row.cbsa_code}`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);

    const prevDate = getPreviousYearDate(row.period_date);
    const prevKey = `${prevDate}|${row.cbsa_code}`;

    const currentEmp = empByCbsaMonth.get(key) ?? null;
    const prevEmp = empByCbsaMonth.get(prevKey) ?? null;
    const empYoY = calculateYoY(currentEmp, prevEmp);

    const year = row.period_date?.substring(0, 4);
    const prevYear = String(parseInt(year) - 1);
    const currentGdp = gdpByCbsaYear.get(`${year}|${row.cbsa_code}`)?.gdp ?? null;
    const prevGdp = gdpByCbsaYear.get(`${prevYear}|${row.cbsa_code}`)?.gdp ?? null;
    const gdpYoY = calculateYoY(currentGdp, prevGdp);

    const gdpKey = `${year}-01-01|${row.cbsa_code}`;
    const rppData = rppMap.get(gdpKey);

    combined.push({
      period_date: row.period_date,
      cbsa_code: row.cbsa_code,
      cbsa_title: gdpByCbsaYear.get(`${year}|${row.cbsa_code}`)?.title || rppData?.title || cbsaTitleLookup.get(row.cbsa_code) || '',
      total_nonfarm_employment: currentEmp,
      employment_yoy: empYoY ? parseFloat(empYoY.toFixed(2)) : null,
      gdp_millions: currentGdp,
      gdp_yoy: gdpYoY ? parseFloat(gdpYoY.toFixed(2)) : null,
      rpp_all_items: rppData?.rpp ?? null
    });
  }

  // Add GDP records not covered by unemployment or employment
  for (const row of gdp) {
    const key = `${row.period_date}|${row.cbsa_code}`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);

    const year = row.period_date?.substring(0, 4);
    const prevYear = String(parseInt(year) - 1);
    const currentGdp = gdpByCbsaYear.get(`${year}|${row.cbsa_code}`)?.gdp || null;
    const prevGdp = gdpByCbsaYear.get(`${prevYear}|${row.cbsa_code}`)?.gdp || null;
    const gdpYoY = calculateYoY(currentGdp, prevGdp);

    const rppData = rppMap.get(key);

    combined.push({
      period_date: row.period_date,
      cbsa_code: row.cbsa_code,
      cbsa_title: row.cbsa_title || rppData?.title || '',
      gdp_millions: currentGdp,
      gdp_yoy: gdpYoY ? parseFloat(gdpYoY.toFixed(2)) : null,
      rpp_all_items: rppData?.rpp || null
    });
  }

  // Add any RPP records not covered
  for (const row of rpp) {
    const key = `${row.period_date}|${row.cbsa_code}`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);

    combined.push({
      period_date: row.period_date,
      cbsa_code: row.cbsa_code,
      cbsa_title: row.cbsa_title || '',
      rpp_all_items: parseFloat(row.rpp_all_items) || null
    });
  }

  combined.sort((a, b) => {
    const dateCompare = b.period_date.localeCompare(a.period_date);
    if (dateCompare !== 0) return dateCompare;
    return a.cbsa_code.localeCompare(b.cbsa_code);
  });

  writeCSV('economic_metro.csv', combined);
}

function combineCountyData(): void {
  console.log('\nCombining county economic data with YoY calculations...');

  const unemployment = readCSV('fred_county_unemployment.csv');
  const gdp = readCSV('bea_county_gdp.csv');

  console.log(`  Unemployment records: ${unemployment.length}`);
  console.log(`  GDP records: ${gdp.length}`);

  // Unemployment by FIPS+date for YoY
  const unempByFipsMonth = new Map<string, { rate: number | null; countyName: string }>();
  for (const row of unemployment) {
    const key = `${row.period_date}|${row.fips_code}`;
    unempByFipsMonth.set(key, {
      rate: parseNumericOrNull(row.unemployment_rate),
      countyName: row.county_name || ''
    });
  }

  // GDP by FIPS+year for YoY
  const gdpByFipsYear = new Map<string, { gdp: number; countyName: string }>();
  for (const row of gdp) {
    const year = row.period_date?.substring(0, 4);
    const key = `${year}|${row.fips_code}`;
    gdpByFipsYear.set(key, {
      gdp: parseFloat(row.gdp_millions) || 0,
      countyName: row.county_name || ''
    });
  }

  const combined: CountyEconomicData[] = [];
  const seenKeys = new Set<string>();

  // Process unemployment records first (monthly data)
  for (const row of unemployment) {
    const key = `${row.period_date}|${row.fips_code}`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);

    const prevDate = getPreviousYearDate(row.period_date);
    const prevKey = `${prevDate}|${row.fips_code}`;

    const currentUnemp = parseNumericOrNull(row.unemployment_rate);
    const prevUnemp = unempByFipsMonth.get(prevKey)?.rate ?? null;
    const unempYoY = (currentUnemp && prevUnemp)
      ? (currentUnemp - prevUnemp).toFixed(2)
      : null;

    const year = row.period_date?.substring(0, 4);
    const prevYear = String(parseInt(year) - 1);
    const currentGdp = gdpByFipsYear.get(`${year}|${row.fips_code}`)?.gdp || null;
    const prevGdp = gdpByFipsYear.get(`${prevYear}|${row.fips_code}`)?.gdp || null;
    const gdpYoY = calculateYoY(currentGdp, prevGdp);

    combined.push({
      period_date: row.period_date,
      fips_code: row.fips_code,
      county_name: row.county_name || gdpByFipsYear.get(`${year}|${row.fips_code}`)?.countyName || '',
      state_fips: row.state_fips || row.fips_code?.substring(0, 2) || '',
      unemployment_rate: currentUnemp,
      unemployment_rate_yoy: unempYoY ? parseFloat(unempYoY) : null,
      gdp_millions: currentGdp,
      gdp_yoy: gdpYoY ? parseFloat(gdpYoY.toFixed(2)) : null
    });
  }

  // Add GDP records not covered by unemployment (annual dates)
  for (const row of gdp) {
    const key = `${row.period_date}|${row.fips_code}`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);

    const year = row.period_date?.substring(0, 4);
    const prevYear = String(parseInt(year) - 1);
    const currentGdp = gdpByFipsYear.get(`${year}|${row.fips_code}`)?.gdp || null;
    const prevGdp = gdpByFipsYear.get(`${prevYear}|${row.fips_code}`)?.gdp || null;
    const gdpYoY = calculateYoY(currentGdp, prevGdp);

    combined.push({
      period_date: row.period_date,
      fips_code: row.fips_code,
      county_name: row.county_name || '',
      state_fips: row.state_fips || row.fips_code?.substring(0, 2) || '',
      gdp_millions: currentGdp,
      gdp_yoy: gdpYoY ? parseFloat(gdpYoY.toFixed(2)) : null
    });
  }

  combined.sort((a, b) => {
    const dateCompare = b.period_date.localeCompare(a.period_date);
    if (dateCompare !== 0) return dateCompare;
    return a.fips_code.localeCompare(b.fips_code);
  });

  writeCSV('economic_county.csv', combined);
}

function getPreviousYearDate(dateStr: string): string {
  const date = new Date(dateStr);
  date.setFullYear(date.getFullYear() - 1);
  return date.toISOString().split('T')[0];
}

interface NationalEconomicData {
  period_date: string;
  unemployment_rate?: number | null;
  unemployment_rate_yoy?: number | null;
  total_nonfarm_employment?: number | null;
  employment_yoy?: number | null;
}

function combineNationalData(): void {
  console.log('\nCombining national economic data with YoY calculations...');

  const unemployment = readCSV('economic_national.csv');
  const employment = readCSV('fred_national_employment.csv');

  console.log(`  Unemployment records: ${unemployment.length}`);
  console.log(`  Employment records: ${employment.length}`);

  // Employment by date
  const empByDate = new Map<string, number | null>();
  for (const row of employment) {
    empByDate.set(row.period_date, parseNumericOrNull(row.total_nonfarm_employment));
  }

  // Unemployment by date for YoY
  const unempByDate = new Map<string, number | null>();
  for (const row of unemployment) {
    unempByDate.set(row.period_date, parseNumericOrNull(row.unemployment_rate));
  }

  const combined: NationalEconomicData[] = [];
  const seenDates = new Set<string>();

  // Process unemployment records
  for (const row of unemployment) {
    const date = row.period_date;
    if (seenDates.has(date)) continue;
    seenDates.add(date);

    const currentUnemp = parseNumericOrNull(row.unemployment_rate);
    const prevDate = getPreviousYearDate(date);
    const prevUnemp = unempByDate.get(prevDate) ?? null;
    const unempYoY = (currentUnemp && prevUnemp)
      ? (currentUnemp - prevUnemp).toFixed(2)
      : null;

    const currentEmp = empByDate.get(date) ?? null;
    const prevEmp = empByDate.get(prevDate) ?? null;
    const empYoY = calculateYoY(currentEmp, prevEmp);

    combined.push({
      period_date: date,
      unemployment_rate: currentUnemp,
      unemployment_rate_yoy: unempYoY ? parseFloat(unempYoY) : null,
      total_nonfarm_employment: currentEmp,
      employment_yoy: empYoY ? parseFloat(empYoY.toFixed(2)) : null
    });
  }

  // Add any employment-only dates
  for (const row of employment) {
    const date = row.period_date;
    if (seenDates.has(date)) continue;
    seenDates.add(date);

    const currentEmp = parseNumericOrNull(row.total_nonfarm_employment);
    const prevDate = getPreviousYearDate(date);
    const prevEmp = empByDate.get(prevDate) ?? null;
    const empYoY = calculateYoY(currentEmp, prevEmp);

    combined.push({
      period_date: date,
      total_nonfarm_employment: currentEmp,
      employment_yoy: empYoY ? parseFloat(empYoY.toFixed(2)) : null
    });
  }

  combined.sort((a, b) => b.period_date.localeCompare(a.period_date));
  writeCSV('economic_national.csv', combined);
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('Combining and Calculating Economic Data');
  console.log('='.repeat(60));

  // Process Census files (add YoY calculations)
  processCensusFiles();

  // Combine and process Economic files
  combineNationalData();
  combineStateData();
  combineMetroData();
  combineCountyData();

  console.log('\n' + '='.repeat(60));
  console.log('Done! Now run: npx tsx scripts/import-census-data.ts && npx tsx scripts/import-economic-data.ts');
}

main().catch(console.error);
