/**
 * Import Geographic Normalization CSV Files
 * 
 * Imports all 8 CSV files from data/Normalization/ into Supabase tables:
 * 1. Metro Areas.csv → tiger_cbsa
 * 2. States.csv → tiger_states
 * 3. County to State.csv → tiger_counties
 * 4. County to ZIP.csv → geo_zip_county
 * 5. Metro to ZIP Code.csv → geo_zip_cbsa
 * 6. ZIP Code Demographics.csv → census_demographics (or skip for now)
 * 7. Zip to County.csv → geo_zip_county (alternative perspective)
 * 8. ZIP to State, Town, Metro.csv → tiger_zcta + relationships
 * 
 * Usage:
 *   npx tsx scripts/import-normalization-csvs.ts
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { parse } from 'csv-parse/sync';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables
config({ path: join(__dirname, '../web/.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: Missing Supabase credentials');
  console.error('   Required: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL');
  console.error('   Required: SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const DATA_DIR = join(__dirname, '../data/Normalization');
const BATCH_SIZE = 1000;

interface ImportResult {
  file: string;
  rowsProcessed: number;
  rowsInserted: number;
  errors: string[];
  skipped: number;
}

// Helper: Normalize FIPS code (ensure proper zero-padding)
function normalizeFIPS(fips: string, length: number): string {
  if (!fips) return '';
  return fips.toString().padStart(length, '0');
}

// Helper: Convert LSAD type
function convertLSAD(type: string): string | null {
  if (type === 'Metropolitan Statistical Area') return 'M1';
  if (type === 'Micropolitan Statistical Area') return 'M2';
  return null;
}

// Helper: Clean county name (remove "County" suffix)
function cleanCountyName(name: string): string {
  if (!name) return '';
  return name.replace(/\s+County$/i, '').trim();
}

// Helper: Parse percentage (handle both decimal and percentage formats)
function parsePercentage(value: string | number): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return value;
  const num = parseFloat(value.toString());
  if (isNaN(num)) return null;
  // If > 1, assume it's a percentage (e.g., 50.5) and convert to decimal
  return num > 1 ? num / 100 : num;
}

// Helper: Escape SQL string
function escapeSQL(value: any): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return value.toString();
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  // Escape single quotes and backslashes
  return `'${value.toString().replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;
}

// Helper: Batch insert with upsert using exec_sql RPC
async function batchUpsert(
  table: string,
  records: any[],
  conflictColumn: string,
  batchSize: number = BATCH_SIZE
): Promise<{ inserted: number; errors: string[] }> {
  const errors: string[] = [];
  let inserted = 0;

  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    
    try {
      // Build SQL INSERT with ON CONFLICT
      const columns = Object.keys(batch[0]);
      const values = batch.map(record => {
        const vals = columns.map(col => escapeSQL(record[col]));
        return `(${vals.join(', ')})`;
      });

      // Handle conflict column (can be single or composite)
      const conflictCols = conflictColumn.split(',').map(c => c.trim());
      const conflictClause = conflictCols.length > 1
        ? conflictCols.join(', ')
        : conflictColumn;

      // Build UPDATE clause for ON CONFLICT
      const updateColumns = columns.filter(col => !conflictCols.includes(col));
      const updateClause = updateColumns.length > 0
        ? `DO UPDATE SET ${updateColumns.map(col => `${col} = EXCLUDED.${col}`).join(', ')}`
        : 'DO NOTHING';

      const sql = `
        INSERT INTO ${table} (${columns.join(', ')})
        VALUES ${values.join(', ')}
        ON CONFLICT (${conflictClause}) ${updateClause}
      `;

      // Execute via exec_sql RPC
      const { error } = await supabase.rpc('exec_sql', { query: sql });

      if (error) {
        errors.push(`Batch ${batchNum}: ${error.message}`);
        console.error(`   ❌ Error inserting batch ${batchNum}: ${error.message}`);
      } else {
        inserted += batch.length;
        if (batchNum % 10 === 0) {
          console.log(`   ✅ Inserted ${inserted.toLocaleString()} records...`);
        }
      }
    } catch (err: any) {
      errors.push(`Batch ${batchNum}: ${err.message}`);
      console.error(`   ❌ Exception in batch ${batchNum}: ${err.message}`);
    }
  }

  return { inserted, errors };
}

// 1. Import States
async function importStates(): Promise<ImportResult> {
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
  })).filter((s: any) => s.geoid); // Filter out invalid rows

  console.log(`   Found ${states.length} states to import`);
  
  const { inserted, errors } = await batchUpsert('tiger_states', states, 'geoid');
  
  return {
    file: 'States.csv',
    rowsProcessed: records.length,
    rowsInserted: inserted,
    errors,
    skipped: records.length - states.length
  };
}

// 2. Import Counties
async function importCounties(): Promise<ImportResult> {
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
  
  const { inserted, errors } = await batchUpsert('tiger_counties', counties, 'geoid');
  
  return {
    file: 'County to State.csv',
    rowsProcessed: records.length,
    rowsInserted: inserted,
    errors,
    skipped: records.length - counties.length
  };
}

// 3. Import CBSA (Metro Areas)
async function importCBSA(): Promise<ImportResult> {
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
  
  const { inserted, errors } = await batchUpsert('tiger_cbsa', cbsas, 'geoid');
  
  return {
    file: 'Metro Areas.csv',
    rowsProcessed: records.length,
    rowsInserted: inserted,
    errors,
    skipped: records.length - cbsas.length
  };
}

// 4. Import ZIP to State, Town, Metro (for tiger_zcta)
async function importZIPPrimary(): Promise<ImportResult> {
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
  
  const { inserted, errors } = await batchUpsert('tiger_zcta', zips, 'geoid');
  
  return {
    file: 'ZIP to State, Town, Metro.csv',
    rowsProcessed: records.length,
    rowsInserted: inserted,
    errors,
    skipped: records.length - zips.length
  };
}

// 5. Import ZIP to County relationships
async function importZIPCounty(): Promise<ImportResult> {
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

// 6. Import ZIP to CBSA relationships
async function importZIPCBSA(): Promise<ImportResult> {
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

// Main import function
async function main() {
  console.log('🚀 Starting CSV Import Process...');
  console.log(`   Data directory: ${DATA_DIR}`);
  console.log(`   Supabase URL: ${supabaseUrl}`);
  console.log('');

  const results: ImportResult[] = [];

  try {
    // Import in order: States → Counties → CBSA → ZIPs → Relationships
    results.push(await importStates());
    results.push(await importCounties());
    results.push(await importCBSA());
    results.push(await importZIPPrimary());
    results.push(await importZIPCounty());
    results.push(await importZIPCBSA());

    // Summary
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('📊 IMPORT SUMMARY');
    console.log('═══════════════════════════════════════════════════════════');
    
    let totalProcessed = 0;
    let totalInserted = 0;
    let totalSkipped = 0;
    let totalErrors = 0;

    results.forEach(result => {
      totalProcessed += result.rowsProcessed;
      totalInserted += result.rowsInserted;
      totalSkipped += result.skipped;
      totalErrors += result.errors.length;
      
      const status = result.errors.length === 0 ? '✅' : '⚠️';
      console.log(`\n${status} ${result.file}:`);
      console.log(`   Processed: ${result.rowsProcessed.toLocaleString()}`);
      console.log(`   Inserted:  ${result.rowsInserted.toLocaleString()}`);
      console.log(`   Skipped:   ${result.skipped.toLocaleString()}`);
      if (result.errors.length > 0) {
        console.log(`   Errors:    ${result.errors.length}`);
        result.errors.slice(0, 3).forEach(err => {
          console.log(`      - ${err}`);
        });
        if (result.errors.length > 3) {
          console.log(`      ... and ${result.errors.length - 3} more`);
        }
      }
    });

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('📈 TOTALS');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`   Total Processed: ${totalProcessed.toLocaleString()}`);
    console.log(`   Total Inserted:  ${totalInserted.toLocaleString()}`);
    console.log(`   Total Skipped:   ${totalSkipped.toLocaleString()}`);
    console.log(`   Total Errors:    ${totalErrors}`);
    console.log('');

    if (totalErrors === 0) {
      console.log('✅ All imports completed successfully!');
    } else {
      console.log('⚠️  Imports completed with some errors. Review the details above.');
    }

  } catch (error: any) {
    console.error('\n❌ Fatal error during import:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run the import
main().catch(error => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
});

