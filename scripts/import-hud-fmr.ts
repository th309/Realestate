/**
 * Import HUD Fair Market Rent Data
 *
 * Imports HUD FMR data from Excel file to improve cap rate coverage.
 * HUD FMR provides 100% county coverage (unlike ZORI which is limited to major metros).
 *
 * Usage:
 *   npx tsx scripts/import-hud-fmr.ts
 *
 * Data source:
 *   https://www.huduser.gov/portal/datasets/fmr.html
 *   Download FY25_FMRs_revised.xlsx to data/hud/
 */

import * as XLSX from 'xlsx';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { createIngestionLogger } from './utils/ingestion-logger';

// Load environment variables
dotenv.config({ path: './packages/backend/.env' });
dotenv.config({ path: '.env.local' });

const DATA_DIR = join(__dirname, '../data/hud');
const FMR_FILE = 'FY25_FMRs.xlsx';
const BATCH_SIZE = 100;
const FISCAL_YEAR = 2025;

interface HudFmrRecord {
  year: number;
  fips_code: string;
  county_name: string;
  state_fips: string;
  state_name: string;
  metro_code: string | null;
  metro_name: string | null;
  fmr_0br: number | null;
  fmr_1br: number | null;
  fmr_2br: number | null;
  fmr_3br: number | null;
  fmr_4br: number | null;
}

interface ImportResult {
  processed: number;
  inserted: number;
  errors: string[];
}

// State FIPS to name mapping
const STATE_NAMES: Record<string, string> = {
  '01': 'Alabama', '02': 'Alaska', '04': 'Arizona', '05': 'Arkansas', '06': 'California',
  '08': 'Colorado', '09': 'Connecticut', '10': 'Delaware', '11': 'District of Columbia',
  '12': 'Florida', '13': 'Georgia', '15': 'Hawaii', '16': 'Idaho', '17': 'Illinois',
  '18': 'Indiana', '19': 'Iowa', '20': 'Kansas', '21': 'Kentucky', '22': 'Louisiana',
  '23': 'Maine', '24': 'Maryland', '25': 'Massachusetts', '26': 'Michigan', '27': 'Minnesota',
  '28': 'Mississippi', '29': 'Missouri', '30': 'Montana', '31': 'Nebraska', '32': 'Nevada',
  '33': 'New Hampshire', '34': 'New Jersey', '35': 'New Mexico', '36': 'New York',
  '37': 'North Carolina', '38': 'North Dakota', '39': 'Ohio', '40': 'Oklahoma', '41': 'Oregon',
  '42': 'Pennsylvania', '44': 'Rhode Island', '45': 'South Carolina', '46': 'South Dakota',
  '47': 'Tennessee', '48': 'Texas', '49': 'Utah', '50': 'Vermont', '51': 'Virginia',
  '53': 'Washington', '54': 'West Virginia', '55': 'Wisconsin', '56': 'Wyoming',
  '72': 'Puerto Rico', '78': 'Virgin Islands'
};

function parseHudFmrExcel(filePath: string): HudFmrRecord[] {
  console.log(`Reading HUD FMR data from: ${filePath}`);

  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawData = XLSX.utils.sheet_to_json(sheet) as any[];

  console.log(`  Raw rows: ${rawData.length}`);

  const records: HudFmrRecord[] = [];
  const seenFips = new Set<string>();

  for (const row of rawData) {
    // Skip rows without FIPS or FMR data
    if (!row.fips || !row.fmr_2) continue;

    // Extract 5-digit FIPS code from 10-digit HUD format
    const fipsStr = String(row.fips).padStart(10, '0');
    const fips5 = fipsStr.slice(0, 5);

    // Skip duplicates (HUD has multiple rows per county for different areas)
    // Keep the first one which typically represents the primary FMR
    if (seenFips.has(fips5)) continue;
    seenFips.add(fips5);

    const stateFips = fips5.slice(0, 2);

    // Extract metro code if present
    let metroCode: string | null = null;
    if (row.hud_area_code && row.hud_area_code.startsWith('METRO')) {
      // Format: METRO33860M33860 -> extract 33860
      const match = row.hud_area_code.match(/METRO(\d+)/);
      if (match) metroCode = match[1];
    }

    records.push({
      year: FISCAL_YEAR,
      fips_code: fips5,
      county_name: row.countyname || '',
      state_fips: stateFips,
      state_name: STATE_NAMES[stateFips] || row.stusps || '',
      metro_code: metroCode,
      metro_name: row.metro === '1' ? (row.hud_area_name || null) : null,
      fmr_0br: typeof row.fmr_0 === 'number' ? row.fmr_0 : null,
      fmr_1br: typeof row.fmr_1 === 'number' ? row.fmr_1 : null,
      fmr_2br: typeof row.fmr_2 === 'number' ? row.fmr_2 : null,
      fmr_3br: typeof row.fmr_3 === 'number' ? row.fmr_3 : null,
      fmr_4br: typeof row.fmr_4 === 'number' ? row.fmr_4 : null,
    });
  }

  console.log(`  Parsed ${records.length} unique county records`);
  return records;
}

async function importHudFmrRecords(
  supabase: ReturnType<typeof createClient>,
  records: HudFmrRecord[]
): Promise<ImportResult> {
  const result: ImportResult = {
    processed: records.length,
    inserted: 0,
    errors: []
  };

  console.log(`  Importing ${records.length} HUD FMR records in batches of ${BATCH_SIZE}...`);

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);

    const { data, error } = await supabase
      .from('hud_fmr')
      .upsert(batch, {
        onConflict: 'year,fips_code',
        ignoreDuplicates: false
      })
      .select();

    if (error) {
      result.errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}`);
      console.error(`  Error in batch ${Math.floor(i / BATCH_SIZE) + 1}:`, error.message);
    } else {
      result.inserted += data?.length || 0;
    }

    // Progress indicator
    if ((i + BATCH_SIZE) % 500 === 0 || i + BATCH_SIZE >= records.length) {
      console.log(`    Processed ${Math.min(i + BATCH_SIZE, records.length)}/${records.length} records...`);
    }
  }

  return result;
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('         IMPORT HUD FAIR MARKET RENT DATA');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Create Supabase client
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Create ingestion logger
  const logger = createIngestionLogger(supabase, {
    source: 'hud',
    tableName: 'hud_fmr',
    datasetId: `hud-fmr-fy${FISCAL_YEAR}`
  });

  try {
    // Parse Excel file
    const filePath = join(DATA_DIR, FMR_FILE);
    const records = parseHudFmrExcel(filePath);

    if (records.length === 0) {
      console.error('No records parsed from HUD FMR file');
      await logger.fail('No records parsed from HUD FMR file');
      process.exit(1);
    }

    // Start ingestion log
    await logger.start(records.length);

    // Import records
    console.log('\n📊 Importing HUD FMR data...');
    const result = await importHudFmrRecords(supabase, records);

    // Complete ingestion log
    await logger.complete({
      recordsProcessed: result.processed,
      recordsSuccess: result.inserted,
      recordsError: result.errors.length,
      errors: result.errors
    });

    // Summary
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('                       SUMMARY');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`  Processed: ${result.processed}`);
    console.log(`  Inserted:  ${result.inserted}`);
    if (result.errors.length > 0) {
      console.log(`  Errors:    ${result.errors.length}`);
      result.errors.slice(0, 5).forEach(e => console.log(`    - ${e}`));
    }
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Verify data
    console.log('📋 Verifying imported data...');
    const { count } = await supabase
      .from('hud_fmr')
      .select('*', { count: 'exact', head: true })
      .eq('year', FISCAL_YEAR);

    console.log(`  Total HUD FMR records for FY${FISCAL_YEAR}: ${count}`);

    // Sample data
    const { data: sample } = await supabase
      .from('hud_fmr')
      .select('fips_code, county_name, state_name, fmr_2br')
      .eq('year', FISCAL_YEAR)
      .order('fmr_2br', { ascending: false })
      .limit(5);

    console.log('\n  Top 5 counties by 2BR FMR:');
    sample?.forEach(r => {
      console.log(`    ${r.county_name}, ${r.state_name}: $${r.fmr_2br}/month`);
    });

    console.log('\n✓ HUD FMR import complete!\n');
  } catch (error: any) {
    await logger.fail(error.message);
    throw error;
  }
}

main().catch(console.error);
