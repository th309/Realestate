/**
 * CSV processing for Census and Economic data imports
 */

import { parse } from 'csv-parse/sync';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  CensusNationalRecord,
  CensusStateRecord,
  CensusMetroRecord,
  CensusCountyRecord,
  CensusCityRecord,
  CensusZipRecord,
  EconomicNationalRecord,
  EconomicStateRecord,
  EconomicMetroRecord,
  EconomicCountyRecord,
  ImportResult
} from './types';
import { STATE_FIPS_TO_ABBREV, STATE_FIPS_TO_NAME } from './types';
import { normalizeZipKey } from '../utils/zip';

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Upsert a batch with retry logic and rate limiting
 */
async function upsertBatchWithRetry(
  supabase: SupabaseClient,
  table: string,
  batch: any[],
  onConflict: string,
  maxRetries: number = 3,
  delayMs: number = 50
): Promise<{ inserted: number; errors: number }> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const { error, data } = await supabase
        .from(table)
        .upsert(batch, {
          onConflict,
          ignoreDuplicates: false
        })
        .select();

      if (error) {
        if (attempt < maxRetries) {
          const backoff = delayMs * Math.pow(2, attempt);
          console.error(`  Batch error (attempt ${attempt + 1}/${maxRetries + 1}): ${error.message} - retrying in ${backoff}ms`);
          await sleep(backoff);
          continue;
        }
        console.error(`  Batch error (final attempt): ${error.message}`);
        return { inserted: 0, errors: batch.length };
      }

      // Small delay between successful batches to avoid overwhelming Supabase
      if (delayMs > 0) await sleep(delayMs);
      return { inserted: data?.length || 0, errors: 0 };
    } catch (err: any) {
      if (attempt < maxRetries) {
        const backoff = delayMs * Math.pow(2, attempt + 1);
        console.error(`  Network error (attempt ${attempt + 1}/${maxRetries + 1}): ${err.message} - retrying in ${backoff}ms`);
        await sleep(backoff);
        continue;
      }
      console.error(`  Network error (final attempt): ${err.message}`);
      return { inserted: 0, errors: batch.length };
    }
  }
  return { inserted: 0, errors: batch.length };
}

/**
 * Parse a numeric value, returning null for empty/invalid values
 */
function parseNumeric(value: string | undefined): number | null {
  if (!value || value === '' || value === 'null' || value === 'undefined' || value === 'NA') {
    return null;
  }
  const num = parseFloat(value);
  return isNaN(num) ? null : num;
}

/**
 * Parse an integer value, returning null for empty/invalid values
 */
function parseInteger(value: string | undefined): number | null {
  const num = parseNumeric(value);
  return num !== null ? Math.round(num) : null;
}

/**
 * Parse a bigint value (for large numbers like payroll)
 */
function parseBigInt(value: string | undefined): number | null {
  const num = parseNumeric(value);
  return num !== null ? Math.round(num) : null;
}

/**
 * Parse date string to Date object
 */
function parseDate(value: string): Date {
  return new Date(value);
}

// ============================================================================
// CENSUS CSV PARSERS
// ============================================================================

/**
 * Parse Census national CSV
 */
export function parseCensusNationalCSV(csvContent: string): CensusNationalRecord[] {
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });

  return records.map((row: any) => ({
    year: parseInt(row.year),
    total_population: parseBigInt(row.total_population),
    population_yoy: parseNumeric(row.population_yoy),
    median_age: parseNumeric(row.median_age),
    median_household_income: parseInteger(row.median_household_income),
    income_yoy: parseNumeric(row.income_yoy),
    per_capita_income: parseInteger(row.per_capita_income),
    total_housing_units: parseInteger(row.total_housing_units),
    owner_occupied_units: parseInteger(row.owner_occupied_units),
    renter_occupied_units: parseInteger(row.renter_occupied_units),
    homeownership_rate: parseNumeric(row.homeownership_rate),
    median_home_value: parseInteger(row.median_home_value),
    median_gross_rent: parseInteger(row.median_gross_rent),
    rent_as_pct_of_income: parseNumeric(row.rent_as_pct_of_income),
    total_employment: parseBigInt(row.total_employment),
    total_establishments: parseInteger(row.total_establishments),
    annual_payroll: parseBigInt(row.annual_payroll)
  }));
}

/**
 * Parse Census state CSV
 */
export function parseCensusStateCSV(csvContent: string): CensusStateRecord[] {
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });

  return records.map((row: any) => {
    const stateFips = row.state_fips?.padStart(2, '0');
    return {
      year: parseInt(row.year),
      state_fips: stateFips,
      state_name: row.state_name || STATE_FIPS_TO_NAME[stateFips] || null,
      state_abbrev: row.state_abbrev || STATE_FIPS_TO_ABBREV[stateFips] || null,
      total_population: parseInteger(row.total_population),
      population_yoy: parseNumeric(row.population_yoy),
      median_age: parseNumeric(row.median_age),
      median_household_income: parseInteger(row.median_household_income),
      income_yoy: parseNumeric(row.income_yoy),
      per_capita_income: parseInteger(row.per_capita_income),
      total_housing_units: parseInteger(row.total_housing_units),
      owner_occupied_units: parseInteger(row.owner_occupied_units),
      renter_occupied_units: parseInteger(row.renter_occupied_units),
      homeownership_rate: parseNumeric(row.homeownership_rate),
      median_home_value: parseInteger(row.median_home_value),
      median_gross_rent: parseInteger(row.median_gross_rent),
      rent_as_pct_of_income: parseNumeric(row.rent_as_pct_of_income),
      total_employment: parseInteger(row.total_employment),
      total_establishments: parseInteger(row.total_establishments),
      annual_payroll: parseBigInt(row.annual_payroll)
    };
  });
}

/**
 * Parse Census metro CSV
 */
export function parseCensusMetroCSV(csvContent: string): CensusMetroRecord[] {
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });

  return records.map((row: any) => ({
    year: parseInt(row.year),
    cbsa_code: row.cbsa_code,
    cbsa_title: row.cbsa_title || null,
    state_fips: row.state_fips || null,
    total_population: parseInteger(row.total_population),
    population_yoy: parseNumeric(row.population_yoy),
    median_age: parseNumeric(row.median_age),
    median_household_income: parseInteger(row.median_household_income),
    income_yoy: parseNumeric(row.income_yoy),
    per_capita_income: parseInteger(row.per_capita_income),
    total_housing_units: parseInteger(row.total_housing_units),
    owner_occupied_units: parseInteger(row.owner_occupied_units),
    renter_occupied_units: parseInteger(row.renter_occupied_units),
    homeownership_rate: parseNumeric(row.homeownership_rate),
    median_home_value: parseInteger(row.median_home_value),
    median_gross_rent: parseInteger(row.median_gross_rent),
    rent_as_pct_of_income: parseNumeric(row.rent_as_pct_of_income),
    total_employment: parseInteger(row.total_employment),
    total_establishments: parseInteger(row.total_establishments),
    annual_payroll: parseBigInt(row.annual_payroll)
  }));
}

/**
 * Parse Census county CSV
 */
export function parseCensusCountyCSV(csvContent: string): CensusCountyRecord[] {
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });

  return records.map((row: any) => {
    const stateFips = row.state_fips?.padStart(2, '0') || row.fips_code?.substring(0, 2);
    return {
      year: parseInt(row.year),
      fips_code: row.fips_code,
      county_name: row.county_name || null,
      state_fips: stateFips || null,
      state_name: row.state_name || STATE_FIPS_TO_NAME[stateFips] || null,
      total_population: parseInteger(row.total_population),
      population_yoy: parseNumeric(row.population_yoy),
      median_age: parseNumeric(row.median_age),
      median_household_income: parseInteger(row.median_household_income),
      income_yoy: parseNumeric(row.income_yoy),
      per_capita_income: parseInteger(row.per_capita_income),
      total_housing_units: parseInteger(row.total_housing_units),
      owner_occupied_units: parseInteger(row.owner_occupied_units),
      renter_occupied_units: parseInteger(row.renter_occupied_units),
      homeownership_rate: parseNumeric(row.homeownership_rate),
      median_home_value: parseInteger(row.median_home_value),
      median_gross_rent: parseInteger(row.median_gross_rent),
      rent_as_pct_of_income: parseNumeric(row.rent_as_pct_of_income),
      total_employment: parseInteger(row.total_employment),
      total_establishments: parseInteger(row.total_establishments),
      annual_payroll: parseBigInt(row.annual_payroll)
    };
  });
}

/**
 * Parse Census city/place CSV
 */
export function parseCensusCityCSV(csvContent: string): CensusCityRecord[] {
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });

  return records.map((row: any) => {
    const stateFips = row.state_fips?.padStart(2, '0') || row.place_fips?.substring(0, 2);
    return {
      year: parseInt(row.year),
      place_fips: row.place_fips,
      place_name: row.place_name || null,
      state_fips: stateFips || null,
      state_name: row.state_name || STATE_FIPS_TO_NAME[stateFips] || null,
      total_population: parseInteger(row.total_population),
      population_yoy: parseNumeric(row.population_yoy),
      median_age: parseNumeric(row.median_age),
      median_household_income: parseInteger(row.median_household_income),
      income_yoy: parseNumeric(row.income_yoy),
      per_capita_income: parseInteger(row.per_capita_income),
      total_housing_units: parseInteger(row.total_housing_units),
      owner_occupied_units: parseInteger(row.owner_occupied_units),
      renter_occupied_units: parseInteger(row.renter_occupied_units),
      homeownership_rate: parseNumeric(row.homeownership_rate),
      median_home_value: parseInteger(row.median_home_value),
      median_gross_rent: parseInteger(row.median_gross_rent),
      rent_as_pct_of_income: parseNumeric(row.rent_as_pct_of_income)
    };
  });
}

/**
 * Parse Census ZIP/ZCTA CSV
 */
export function parseCensusZipCSV(csvContent: string): CensusZipRecord[] {
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });

  return records.map((row: any) => {
    const raw = row.zcta ?? row.zip_code ?? '';
    return {
    year: parseInt(row.year),
    zcta: raw ? normalizeZipKey(String(raw)) : '',
    state_fips: row.state_fips || null,
    state_name: row.state_name || null,
    total_population: parseInteger(row.total_population),
    population_yoy: parseNumeric(row.population_yoy),
    median_age: parseNumeric(row.median_age),
    median_household_income: parseInteger(row.median_household_income),
    income_yoy: parseNumeric(row.income_yoy),
    per_capita_income: parseInteger(row.per_capita_income),
    total_housing_units: parseInteger(row.total_housing_units),
    owner_occupied_units: parseInteger(row.owner_occupied_units),
    renter_occupied_units: parseInteger(row.renter_occupied_units),
    homeownership_rate: parseNumeric(row.homeownership_rate),
    median_home_value: parseInteger(row.median_home_value),
    median_gross_rent: parseInteger(row.median_gross_rent),
    rent_as_pct_of_income: parseNumeric(row.rent_as_pct_of_income),
    total_employment: parseInteger(row.total_employment),
    total_establishments: parseInteger(row.total_establishments),
    annual_payroll: parseBigInt(row.annual_payroll)
  };
  });
}

// ============================================================================
// ECONOMIC CSV PARSERS
// ============================================================================

/**
 * Parse Economic national CSV
 */
export function parseEconomicNationalCSV(csvContent: string): EconomicNationalRecord[] {
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });

  return records.map((row: any) => ({
    period_date: parseDate(row.period_date || row.date),
    unemployment_rate: parseNumeric(row.unemployment_rate),
    unemployment_rate_yoy: parseNumeric(row.unemployment_rate_yoy),
    total_nonfarm_employment: parseBigInt(row.total_nonfarm_employment),
    employment_yoy: parseNumeric(row.employment_yoy),
    gdp_millions: parseNumeric(row.gdp_millions),
    real_gdp_millions: parseNumeric(row.real_gdp_millions),
    gdp_yoy: parseNumeric(row.gdp_yoy)
  }));
}

/**
 * Parse Economic state CSV
 */
export function parseEconomicStateCSV(csvContent: string): EconomicStateRecord[] {
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });

  return records.map((row: any) => {
    const stateFips = row.state_fips?.padStart(2, '0');
    return {
      period_date: parseDate(row.period_date || row.date),
      state_fips: stateFips,
      state_name: row.state_name || STATE_FIPS_TO_NAME[stateFips] || null,
      state_abbrev: row.state_abbrev || STATE_FIPS_TO_ABBREV[stateFips] || null,
      unemployment_rate: parseNumeric(row.unemployment_rate),
      unemployment_rate_yoy: parseNumeric(row.unemployment_rate_yoy),
      total_nonfarm_employment: parseInteger(row.total_nonfarm_employment),
      employment_yoy: parseNumeric(row.employment_yoy),
      gdp_millions: parseNumeric(row.gdp_millions),
      real_gdp_millions: parseNumeric(row.real_gdp_millions),
      gdp_yoy: parseNumeric(row.gdp_yoy),
      rpp_all_items: parseNumeric(row.rpp_all_items),
      rpp_goods: parseNumeric(row.rpp_goods),
      rpp_housing: parseNumeric(row.rpp_housing),
      rpp_utilities: parseNumeric(row.rpp_utilities),
      rpp_other_services: parseNumeric(row.rpp_other_services)
    };
  });
}

/**
 * Parse Economic metro CSV
 */
export function parseEconomicMetroCSV(csvContent: string): EconomicMetroRecord[] {
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });

  return records.map((row: any) => ({
    period_date: parseDate(row.period_date || row.date),
    cbsa_code: row.cbsa_code,
    cbsa_title: row.cbsa_title || null,
    state_fips: row.state_fips || null,
    unemployment_rate: parseNumeric(row.unemployment_rate),
    unemployment_rate_yoy: parseNumeric(row.unemployment_rate_yoy),
    total_nonfarm_employment: parseInteger(row.total_nonfarm_employment),
    employment_yoy: parseNumeric(row.employment_yoy),
    gdp_millions: parseNumeric(row.gdp_millions),
    real_gdp_millions: parseNumeric(row.real_gdp_millions),
    gdp_yoy: parseNumeric(row.gdp_yoy),
    rpp_all_items: parseNumeric(row.rpp_all_items),
    rpp_goods: parseNumeric(row.rpp_goods),
    rpp_housing: parseNumeric(row.rpp_housing),
    rpp_utilities: parseNumeric(row.rpp_utilities),
    rpp_other_services: parseNumeric(row.rpp_other_services)
  }));
}

/**
 * Parse Economic county CSV
 */
export function parseEconomicCountyCSV(csvContent: string): EconomicCountyRecord[] {
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });

  return records.map((row: any) => {
    const stateFips = row.state_fips?.padStart(2, '0') || row.fips_code?.substring(0, 2);
    return {
      period_date: parseDate(row.period_date || row.date),
      fips_code: row.fips_code,
      county_name: row.county_name || null,
      state_fips: stateFips || null,
      state_name: row.state_name || STATE_FIPS_TO_NAME[stateFips] || null,
      unemployment_rate: parseNumeric(row.unemployment_rate),
      unemployment_rate_yoy: parseNumeric(row.unemployment_rate_yoy),
      total_nonfarm_employment: parseInteger(row.total_nonfarm_employment),
      employment_yoy: parseNumeric(row.employment_yoy),
      gdp_millions: parseNumeric(row.gdp_millions),
      real_gdp_millions: parseNumeric(row.real_gdp_millions),
      gdp_yoy: parseNumeric(row.gdp_yoy)
    };
  });
}

// ============================================================================
// CENSUS DATABASE IMPORT FUNCTIONS
// ============================================================================

/**
 * Import Census national records
 */
export async function importCensusNationalRecords(
  supabase: SupabaseClient,
  records: CensusNationalRecord[],
  batchSize: number = 1000
): Promise<ImportResult> {
  let recordsInserted = 0;
  let errors = 0;

  console.log(`  Importing ${records.length} census_national records...`);

  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);

    const { error, data } = await supabase
      .from('census_national')
      .upsert(batch, {
        onConflict: 'year',
        ignoreDuplicates: false
      })
      .select();

    if (error) {
      console.error(`  Batch error: ${error.message}`);
      errors += batch.length;
    } else {
      recordsInserted += data?.length || 0;
    }
  }

  return {
    datasetId: 'census-national',
    success: errors === 0,
    recordsInserted,
    recordsUpdated: 0,
    errors
  };
}

/**
 * Import Census state records
 */
export async function importCensusStateRecords(
  supabase: SupabaseClient,
  records: CensusStateRecord[],
  batchSize: number = 1000
): Promise<ImportResult> {
  let recordsInserted = 0;
  let errors = 0;

  console.log(`  Importing ${records.length} census_state records...`);

  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);

    const { error, data } = await supabase
      .from('census_state')
      .upsert(batch, {
        onConflict: 'year,state_fips',
        ignoreDuplicates: false
      })
      .select();

    if (error) {
      console.error(`  Batch error: ${error.message}`);
      errors += batch.length;
    } else {
      recordsInserted += data?.length || 0;
    }

    if ((i + batchSize) % 500 === 0 || i + batchSize >= records.length) {
      console.log(`  Progress: ${Math.min(i + batchSize, records.length)}/${records.length} records`);
    }
  }

  return {
    datasetId: 'census-state',
    success: errors === 0,
    recordsInserted,
    recordsUpdated: 0,
    errors
  };
}

/**
 * Import Census metro records
 */
export async function importCensusMetroRecords(
  supabase: SupabaseClient,
  records: CensusMetroRecord[],
  batchSize: number = 1000
): Promise<ImportResult> {
  let recordsInserted = 0;
  let errors = 0;

  console.log(`  Importing ${records.length} census_metro records...`);

  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    const result = await upsertBatchWithRetry(supabase, 'census_metro', batch, 'year,cbsa_code');
    recordsInserted += result.inserted;
    errors += result.errors;

    if ((i + batchSize) % 1000 === 0 || i + batchSize >= records.length) {
      console.log(`  Progress: ${Math.min(i + batchSize, records.length)}/${records.length} records (${recordsInserted} inserted, ${errors} errors)`);
    }
  }

  return {
    datasetId: 'census-metro',
    success: errors === 0,
    recordsInserted,
    recordsUpdated: 0,
    errors
  };
}

/**
 * Import Census county records
 */
export async function importCensusCountyRecords(
  supabase: SupabaseClient,
  records: CensusCountyRecord[],
  batchSize: number = 1000
): Promise<ImportResult> {
  let recordsInserted = 0;
  let errors = 0;

  console.log(`  Importing ${records.length} census_county records...`);

  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    const result = await upsertBatchWithRetry(supabase, 'census_county', batch, 'year,fips_code');
    recordsInserted += result.inserted;
    errors += result.errors;

    if ((i + batchSize) % 5000 === 0 || i + batchSize >= records.length) {
      console.log(`  Progress: ${Math.min(i + batchSize, records.length)}/${records.length} records (${recordsInserted} inserted, ${errors} errors)`);
    }
  }

  return {
    datasetId: 'census-county',
    success: errors === 0,
    recordsInserted,
    recordsUpdated: 0,
    errors
  };
}

/**
 * Import Census city records
 */
export async function importCensusCityRecords(
  supabase: SupabaseClient,
  records: CensusCityRecord[],
  batchSize: number = 1000
): Promise<ImportResult> {
  let recordsInserted = 0;
  let errors = 0;

  console.log(`  Importing ${records.length} census_city records...`);

  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    const result = await upsertBatchWithRetry(supabase, 'census_city', batch, 'year,place_fips');
    recordsInserted += result.inserted;
    errors += result.errors;

    if ((i + batchSize) % 10000 === 0 || i + batchSize >= records.length) {
      console.log(`  Progress: ${Math.min(i + batchSize, records.length)}/${records.length} records (${recordsInserted} inserted, ${errors} errors)`);
    }
  }

  return {
    datasetId: 'census-city',
    success: errors === 0,
    recordsInserted,
    recordsUpdated: 0,
    errors
  };
}

/**
 * Import Census ZIP records
 */
export async function importCensusZipRecords(
  supabase: SupabaseClient,
  records: CensusZipRecord[],
  batchSize: number = 1000
): Promise<ImportResult> {
  let recordsInserted = 0;
  let errors = 0;

  console.log(`  Importing ${records.length} census_zip records...`);

  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    const result = await upsertBatchWithRetry(supabase, 'census_zip', batch, 'year,zcta');
    recordsInserted += result.inserted;
    errors += result.errors;

    if ((i + batchSize) % 10000 === 0 || i + batchSize >= records.length) {
      console.log(`  Progress: ${Math.min(i + batchSize, records.length)}/${records.length} records (${recordsInserted} inserted, ${errors} errors)`);
    }
  }

  return {
    datasetId: 'census-zip',
    success: errors === 0,
    recordsInserted,
    recordsUpdated: 0,
    errors
  };
}

// ============================================================================
// ECONOMIC DATABASE IMPORT FUNCTIONS
// ============================================================================

/**
 * Import Economic national records
 */
export async function importEconomicNationalRecords(
  supabase: SupabaseClient,
  records: EconomicNationalRecord[],
  batchSize: number = 1000
): Promise<ImportResult> {
  let recordsInserted = 0;
  let errors = 0;

  console.log(`  Importing ${records.length} economic_national records...`);

  // Format dates for Supabase
  const formattedRecords = records.map(r => ({
    ...r,
    period_date: r.period_date.toISOString().split('T')[0]
  }));

  for (let i = 0; i < formattedRecords.length; i += batchSize) {
    const batch = formattedRecords.slice(i, i + batchSize);

    const { error, data } = await supabase
      .from('economic_national')
      .upsert(batch, {
        onConflict: 'period_date',
        ignoreDuplicates: false
      })
      .select();

    if (error) {
      console.error(`  Batch error: ${error.message}`);
      errors += batch.length;
    } else {
      recordsInserted += data?.length || 0;
    }
  }

  return {
    datasetId: 'economic-national',
    success: errors === 0,
    recordsInserted,
    recordsUpdated: 0,
    errors
  };
}

/**
 * Import Economic state records
 */
export async function importEconomicStateRecords(
  supabase: SupabaseClient,
  records: EconomicStateRecord[],
  batchSize: number = 1000
): Promise<ImportResult> {
  let recordsInserted = 0;
  let errors = 0;

  console.log(`  Importing ${records.length} economic_state records...`);

  // Format dates for Supabase
  const formattedRecords = records.map(r => ({
    ...r,
    period_date: r.period_date.toISOString().split('T')[0]
  }));

  for (let i = 0; i < formattedRecords.length; i += batchSize) {
    const batch = formattedRecords.slice(i, i + batchSize);

    const { error, data } = await supabase
      .from('economic_state')
      .upsert(batch, {
        onConflict: 'period_date,state_fips',
        ignoreDuplicates: false
      })
      .select();

    if (error) {
      console.error(`  Batch error: ${error.message}`);
      errors += batch.length;
    } else {
      recordsInserted += data?.length || 0;
    }

    if ((i + batchSize) % 1000 === 0 || i + batchSize >= formattedRecords.length) {
      console.log(`  Progress: ${Math.min(i + batchSize, formattedRecords.length)}/${formattedRecords.length} records`);
    }
  }

  return {
    datasetId: 'economic-state',
    success: errors === 0,
    recordsInserted,
    recordsUpdated: 0,
    errors
  };
}

/**
 * Import Economic metro records
 */
export async function importEconomicMetroRecords(
  supabase: SupabaseClient,
  records: EconomicMetroRecord[],
  batchSize: number = 1000
): Promise<ImportResult> {
  let recordsInserted = 0;
  let errors = 0;

  console.log(`  Importing ${records.length} economic_metro records...`);

  // Format dates for Supabase
  const formattedRecords = records.map(r => ({
    ...r,
    period_date: r.period_date.toISOString().split('T')[0]
  }));

  for (let i = 0; i < formattedRecords.length; i += batchSize) {
    const batch = formattedRecords.slice(i, i + batchSize);
    const result = await upsertBatchWithRetry(supabase, 'economic_metro', batch, 'period_date,cbsa_code');
    recordsInserted += result.inserted;
    errors += result.errors;

    if ((i + batchSize) % 5000 === 0 || i + batchSize >= formattedRecords.length) {
      console.log(`  Progress: ${Math.min(i + batchSize, formattedRecords.length)}/${formattedRecords.length} records (${recordsInserted} inserted, ${errors} errors)`);
    }
  }

  return {
    datasetId: 'economic-metro',
    success: errors === 0,
    recordsInserted,
    recordsUpdated: 0,
    errors
  };
}

/**
 * Import Economic county records
 */
export async function importEconomicCountyRecords(
  supabase: SupabaseClient,
  records: EconomicCountyRecord[],
  batchSize: number = 1000
): Promise<ImportResult> {
  let recordsInserted = 0;
  let errors = 0;

  console.log(`  Importing ${records.length} economic_county records...`);

  // Format dates for Supabase
  const formattedRecords = records.map(r => ({
    ...r,
    period_date: r.period_date.toISOString().split('T')[0]
  }));

  for (let i = 0; i < formattedRecords.length; i += batchSize) {
    const batch = formattedRecords.slice(i, i + batchSize);
    const result = await upsertBatchWithRetry(supabase, 'economic_county', batch, 'period_date,fips_code');
    recordsInserted += result.inserted;
    errors += result.errors;

    if ((i + batchSize) % 10000 === 0 || i + batchSize >= formattedRecords.length) {
      console.log(`  Progress: ${Math.min(i + batchSize, formattedRecords.length)}/${formattedRecords.length} records (${recordsInserted} inserted, ${errors} errors)`);
    }
  }

  return {
    datasetId: 'economic-county',
    success: errors === 0,
    recordsInserted,
    recordsUpdated: 0,
    errors
  };
}
