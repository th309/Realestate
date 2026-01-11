/**
 * Individual importers for each normalization CSV file
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { parse } from 'csv-parse/sync';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ImportResult } from './types';
import { normalizeFIPS, convertLSAD, cleanCountyName, parsePercentage } from './helpers';
import { batchUpsert } from './db-client';

const DATA_DIR = join(__dirname, '../../data/Normalization');

/**
 * Import States.csv into tiger_states
 */
export async function importStates(supabase: SupabaseClient): Promise<ImportResult> {
  console.log('\n📊 Importing States.csv...');
  const filePath = join(DATA_DIR, 'States.csv');
  const csvContent = readFileSync(filePath, 'utf-8');

  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });

  const states = records.map((row: any) => ({
    geoid: normalizeFIPS(row['FIPS code'], 2),
    name: row['State Name'],
    state_abbreviation: row['State Abbreviation'],
    population: row['Population'] ? parseInt(row['Population']) : null,
    name_fragment: row['State Name Fragment']
  })).filter((s: any) => s.geoid);

  console.log(`   Found ${states.length} states to import`);

  const { inserted, errors } = await batchUpsert(supabase, 'tiger_states', states, 'geoid');

  return {
    file: 'States.csv',
    rowsProcessed: records.length,
    rowsInserted: inserted,
    errors,
    skipped: records.length - states.length
  };
}

/**
 * Import County to State.csv into tiger_counties
 */
export async function importCounties(supabase: SupabaseClient): Promise<ImportResult> {
  console.log('\n📊 Importing County to State.csv...');
  const filePath = join(DATA_DIR, 'County to State.csv');
  const csvContent = readFileSync(filePath, 'utf-8');

  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });

  const counties = records.map((row: any) => {
    const fips = normalizeFIPS(row['FIPS - County Code'], 5);
    return {
      geoid: fips,
      name: cleanCountyName(row['County']),
      state_fips: fips.substring(0, 2),
      population: row['County Population'] ? parseInt(row['County Population']) : null,
      county_name_fragment: row['County Name Fragment'],
      pct_of_state_population: parsePercentage(row['County % of State Population'])
    };
  }).filter((c: any) => c.geoid && c.geoid.length === 5);

  console.log(`   Found ${counties.length} counties to import`);

  const { inserted, errors } = await batchUpsert(supabase, 'tiger_counties', counties, 'geoid');

  return {
    file: 'County to State.csv',
    rowsProcessed: records.length,
    rowsInserted: inserted,
    errors,
    skipped: records.length - counties.length
  };
}

/**
 * Import Metro Areas.csv into tiger_cbsa
 */
export async function importCBSA(supabase: SupabaseClient): Promise<ImportResult> {
  console.log('\n📊 Importing Metro Areas.csv...');
  const filePath = join(DATA_DIR, 'Metro Areas.csv');
  const csvContent = readFileSync(filePath, 'utf-8');

  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });

  const cbsas = records.map((row: any) => ({
    geoid: normalizeFIPS(row['CBSA Code'], 5),
    name: row['Name (CSBA)'],
    lsad: convertLSAD(row['Metropolitan/Micropolitan Statistical Area']),
    population: row['Population'] ? parseInt(row['Population']) : null
  })).filter((c: any) => c.geoid && c.lsad);

  console.log(`   Found ${cbsas.length} CBSAs to import`);

  const { inserted, errors } = await batchUpsert(supabase, 'tiger_cbsa', cbsas, 'geoid');

  return {
    file: 'Metro Areas.csv',
    rowsProcessed: records.length,
    rowsInserted: inserted,
    errors,
    skipped: records.length - cbsas.length
  };
}

/**
 * Import ZIP to State, Town, Metro.csv into tiger_zcta
 */
export async function importZIPPrimary(supabase: SupabaseClient): Promise<ImportResult> {
  console.log('\n📊 Importing ZIP to State, Town, Metro.csv...');
  const filePath = join(DATA_DIR, 'ZIP to State, Town, Metro.csv');
  const csvContent = readFileSync(filePath, 'utf-8');

  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });

  const zips = records.map((row: any) => ({
    geoid: normalizeFIPS(row['ZIP Code'], 5),
    population: row['ZIP Code Population'] ? parseInt(row['ZIP Code Population']) : null,
    default_city: row['USPS Default City for ZIP'],
    default_state: row['USPS Default State for ZIP'],
    cbsa_code: row['CBSA Code'] ? normalizeFIPS(row['CBSA Code'], 5) : null
  })).filter((z: any) => z.geoid && z.geoid.length === 5);

  console.log(`   Found ${zips.length} ZIP codes to import`);

  const { inserted, errors } = await batchUpsert(supabase, 'tiger_zcta', zips, 'geoid');

  return {
    file: 'ZIP to State, Town, Metro.csv',
    rowsProcessed: records.length,
    rowsInserted: inserted,
    errors,
    skipped: records.length - zips.length
  };
}

/**
 * Import Zip to County.csv into geo_zip_county
 */
export async function importZIPCounty(supabase: SupabaseClient): Promise<ImportResult> {
  console.log('\n📊 Importing Zip to County.csv...');
  const filePath = join(DATA_DIR, 'Zip to County.csv');
  const csvContent = readFileSync(filePath, 'utf-8');

  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });

  const relationships = records.map((row: any) => {
    const zipGeoid = normalizeFIPS(row['ZIP'], 5);
    const countyGeoid = normalizeFIPS(row['COUNTY Code'], 5);
    const overlapPct = parsePercentage(row['% of ZIP Residents in County']);

    return {
      zip_geoid: zipGeoid,
      county_geoid: countyGeoid,
      overlap_percentage: overlapPct,
      is_primary: overlapPct !== null && overlapPct > 0.5
    };
  }).filter((r: any) => r.zip_geoid && r.county_geoid && r.overlap_percentage !== null);

  console.log(`   Found ${relationships.length} ZIP-County relationships to import`);

  const { inserted, errors } = await batchUpsert(
    supabase,
    'geo_zip_county',
    relationships,
    'zip_geoid,county_geoid'
  );

  return {
    file: 'Zip to County.csv',
    rowsProcessed: records.length,
    rowsInserted: inserted,
    errors,
    skipped: records.length - relationships.length
  };
}

/**
 * Import Metro to ZIP Code.csv into geo_zip_cbsa
 */
export async function importZIPCBSA(supabase: SupabaseClient): Promise<ImportResult> {
  console.log('\n📊 Importing Metro to ZIP Code.csv...');
  const filePath = join(DATA_DIR, 'Metro to ZIP Code.csv');
  const csvContent = readFileSync(filePath, 'utf-8');

  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });

  const relationships = records.map((row: any) => {
    const zipGeoid = normalizeFIPS(row['ZIP'], 5);
    const cbsaGeoid = normalizeFIPS(row['CBSA Code'], 5);
    const overlapPct = parsePercentage(row['% of Metro Residents in ZIP']);

    return {
      zip_geoid: zipGeoid,
      cbsa_geoid: cbsaGeoid,
      overlap_percentage: overlapPct,
      is_primary: overlapPct !== null && overlapPct > 0.5
    };
  }).filter((r: any) => r.zip_geoid && r.cbsa_geoid && r.overlap_percentage !== null);

  console.log(`   Found ${relationships.length} ZIP-CBSA relationships to import`);

  const { inserted, errors } = await batchUpsert(
    supabase,
    'geo_zip_cbsa',
    relationships,
    'zip_geoid,cbsa_geoid'
  );

  return {
    file: 'Metro to ZIP Code.csv',
    rowsProcessed: records.length,
    rowsInserted: inserted,
    errors,
    skipped: records.length - relationships.length
  };
}
