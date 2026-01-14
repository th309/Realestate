/**
 * Import Zillow Home Value Forecast (ZHVF) Data
 *
 * Downloads ZHVF (Home Value Forecast) data from Zillow Research
 * and imports into zillow_zip and zillow_metro tables.
 *
 * ZHVF provides month-ahead, quarter-ahead and year-ahead forecasts
 * of the Zillow Home Value Index (percentage growth).
 *
 * CSV Structure:
 * - RegionID, SizeRank, RegionName, RegionType, StateName, BaseDate
 * - {1-month-date}: 1-month forecast (% change)
 * - {3-month-date}: 3-month forecast (% change)
 * - {12-month-date}: 12-month forecast (% change)
 *
 * Inserts records with metric_name: 'zhvf_1m', 'zhvf_3m', 'zhvf_12m'
 *
 * Usage:
 *   npx tsx scripts/import-zillow-zhvf.ts [--geography=metro|zip|all]
 *
 * Default: imports all geographies (metro and zip)
 */

import axios from 'axios';
import { parse as parseSync } from 'csv-parse/sync';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { join } from 'path';

// Load environment variables
config({ path: join(__dirname, '../packages/backend/.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// ZHVF CSV URLs from Zillow Research
const ZHVF_URLS: Record<string, string> = {
  metro: 'https://files.zillowstatic.com/research/public_csvs/zhvf_growth/Metro_zhvf_growth_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv',
  zip: 'https://files.zillowstatic.com/research/public_csvs/zhvf_growth/Zip_zhvf_growth_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv',
};

// Target tables by geography
const TARGET_TABLES: Record<string, string> = {
  metro: 'zillow_metro',
  zip: 'zillow_zip',
};

// Forecast metrics
type ForecastMetric = 'zhvf_1m' | 'zhvf_3m' | 'zhvf_12m';

interface ZillowForecastRecord {
  region_id: number;
  region_name: string;
  state_code: string | null;
  cbsa_code?: string | null;
  period_date: string;
  metric_name: ForecastMetric;
  value: number;
}

async function downloadCSV(url: string): Promise<string> {
  console.log(`Downloading: ${url}`);
  const response = await axios.get(url, {
    timeout: 120000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });
  return response.data;
}

function parseZHVFData(csvContent: string, geography: string): ZillowForecastRecord[] {
  const records: any[] = parseSync(csvContent, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true
  });

  console.log(`Parsed ${records.length} ${geography} records`);

  if (records.length === 0) return [];

  // Inspect columns
  const sampleRecord = records[0];
  const columns = Object.keys(sampleRecord);

  // Find date columns (format: YYYY-MM-DD) - these are forecast target dates
  const dateColumns = columns.filter(col => /^\d{4}-\d{2}-\d{2}$/.test(col)).sort();

  console.log(`BaseDate: ${sampleRecord.BaseDate}`);
  console.log(`Forecast date columns: ${dateColumns.join(', ')}`);

  // The date columns are:
  // - dateColumns[0]: ~1-month forecast
  // - dateColumns[1]: ~3-month forecast
  // - dateColumns[2]: ~12-month forecast
  const col1m = dateColumns[0];
  const col3m = dateColumns[1];
  const col12m = dateColumns[2];

  console.log(`Using: 1m=${col1m}, 3m=${col3m}, 12m=${col12m}`);

  const forecastRecords: ZillowForecastRecord[] = [];

  for (const record of records) {
    const regionId = parseInt(record.RegionID, 10);
    const regionName = record.RegionName || '';
    const baseDate = record.BaseDate;
    const stateName = record.StateName || null;

    if (!regionId || isNaN(regionId) || !baseDate) continue;

    // Parse forecast values
    const forecast1m = col1m && record[col1m] !== '' ? parseFloat(record[col1m]) : null;
    const forecast3m = col3m && record[col3m] !== '' ? parseFloat(record[col3m]) : null;
    const forecast12m = col12m && record[col12m] !== '' ? parseFloat(record[col12m]) : null;

    // Create separate records for each forecast horizon (like other metrics)
    // This matches the pattern: region_id + period_date + metric_name
    if (forecast1m !== null && !isNaN(forecast1m)) {
      forecastRecords.push({
        region_id: regionId,
        region_name: regionName,
        state_code: stateName,
        period_date: baseDate,
        metric_name: 'zhvf_1m',
        value: forecast1m,
      });
    }

    if (forecast3m !== null && !isNaN(forecast3m)) {
      forecastRecords.push({
        region_id: regionId,
        region_name: regionName,
        state_code: stateName,
        period_date: baseDate,
        metric_name: 'zhvf_3m',
        value: forecast3m,
      });
    }

    if (forecast12m !== null && !isNaN(forecast12m)) {
      forecastRecords.push({
        region_id: regionId,
        region_name: regionName,
        state_code: stateName,
        period_date: baseDate,
        metric_name: 'zhvf_12m',
        value: forecast12m,
      });
    }
  }

  return forecastRecords;
}

async function importZHVF(geography: string): Promise<number> {
  const url = ZHVF_URLS[geography];
  const tableName = TARGET_TABLES[geography];

  if (!url || !tableName) {
    console.error(`Unknown geography: ${geography}`);
    return 0;
  }

  console.log(`\n${'='.repeat(70)}`);
  console.log(`IMPORTING ZHVF: ${geography.toUpperCase()} -> ${tableName}`);
  console.log('='.repeat(70));

  try {
    const csvContent = await downloadCSV(url);
    console.log(`Downloaded ${(csvContent.length / 1024).toFixed(1)} KB`);

    const records = parseZHVFData(csvContent, geography);
    console.log(`\nPrepared ${records.length} forecast records for insertion`);

    if (records.length === 0) {
      console.log('No records to insert');
      return 0;
    }

    // For metro, look up CBSA codes from the crosswalk table (authoritative source)
    if (geography === 'metro') {
      console.log('\nLooking up CBSA codes from zillow_metro_crosswalk...');
      const { data: crosswalkData, error: crosswalkError } = await supabase
        .from('zillow_metro_crosswalk')
        .select('zillow_region_id, cbsa_code');

      if (crosswalkError) {
        console.error('Error loading crosswalk:', crosswalkError.message);
      } else if (crosswalkData && crosswalkData.length > 0) {
        const codeMap = new Map<number, string>();
        for (const row of crosswalkData) {
          codeMap.set(row.zillow_region_id, row.cbsa_code);
        }
        console.log(`Loaded ${codeMap.size} CBSA mappings from crosswalk`);

        // Apply cbsa_codes to records
        let matched = 0;
        for (const record of records) {
          const cbsa = codeMap.get(record.region_id);
          if (cbsa) {
            record.cbsa_code = cbsa;
            matched++;
          }
        }
        console.log(`Matched ${matched} of ${records.length} records with CBSA codes`);
      }
    }

    // Show sample
    console.log('\nSample records:');
    records.slice(0, 6).forEach(r => {
      console.log(`  ${r.region_id} "${r.region_name}" ${r.metric_name}=${r.value}%`);
    });

    // Insert in batches using upsert
    const batchSize = 1000;
    let inserted = 0;
    let errors = 0;

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);

      const { error } = await supabase
        .from(tableName)
        .upsert(batch, {
          onConflict: 'region_id,period_date,metric_name',
          ignoreDuplicates: false
        });

      if (error) {
        console.error(`\nBatch error at ${i}:`, error.message);
        errors++;
        // Continue with next batch
      } else {
        inserted += batch.length;
      }

      process.stdout.write(`\rProgress: ${inserted}/${records.length} records (${errors} errors)...`);
    }

    console.log(`\n\nCompleted ${geography}: ${inserted} records inserted into ${tableName}`);
    return inserted;

  } catch (error: any) {
    if (error.response?.status === 404) {
      console.error(`\nZHVF file not found for ${geography}. URL may have changed.`);
      console.error('Check https://www.zillow.com/research/data/ for updated URLs.');
    } else {
      console.error(`\nFailed to import ${geography}:`, error.message);
    }
    return 0;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const geographyArg = args.find(a => a.startsWith('--geography='));
  const geography = geographyArg?.split('=')[1] || 'all';

  console.log('='.repeat(70));
  console.log('ZILLOW HOME VALUE FORECAST (ZHVF) IMPORT');
  console.log('='.repeat(70));
  console.log(`Supabase URL: ${supabaseUrl}`);
  console.log(`Geography: ${geography}`);
  console.log(`Target tables: metro -> zillow_metro, zip -> zillow_zip`);
  console.log('');

  let totalInserted = 0;

  if (geography === 'all') {
    for (const geo of Object.keys(ZHVF_URLS)) {
      totalInserted += await importZHVF(geo);
    }
  } else {
    totalInserted = await importZHVF(geography);
  }

  console.log('\n' + '='.repeat(70));
  console.log(`IMPORT COMPLETE: ${totalInserted} total records`);
  console.log('='.repeat(70));

  // Verify ZIP data
  console.log('\n--- Verifying zillow_zip forecast data ---');
  const { data: zipSample, error: zipError } = await supabase
    .from('zillow_zip')
    .select('region_id, region_name, metric_name, value, period_date')
    .in('metric_name', ['zhvf_1m', 'zhvf_3m', 'zhvf_12m'])
    .order('period_date', { ascending: false })
    .limit(10);

  if (zipSample && zipSample.length > 0) {
    console.log('Sample ZIP forecast data:');
    console.table(zipSample);
  } else if (zipError) {
    console.log('Could not verify ZIP data:', zipError.message);
  } else {
    console.log('No ZIP forecast data found');
  }

  // Verify Metro data
  console.log('\n--- Verifying zillow_metro forecast data ---');
  const { data: metroSample, error: metroError } = await supabase
    .from('zillow_metro')
    .select('region_id, region_name, metric_name, value, period_date')
    .in('metric_name', ['zhvf_1m', 'zhvf_3m', 'zhvf_12m'])
    .order('period_date', { ascending: false })
    .limit(10);

  if (metroSample && metroSample.length > 0) {
    console.log('Sample Metro forecast data:');
    console.table(metroSample);
  } else if (metroError) {
    console.log('Could not verify Metro data:', metroError.message);
  } else {
    console.log('No Metro forecast data found');
  }

  // Count forecast records by table
  console.log('\n--- Forecast record counts ---');
  for (const [geo, table] of Object.entries(TARGET_TABLES)) {
    const { count } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true })
      .in('metric_name', ['zhvf_1m', 'zhvf_3m', 'zhvf_12m']);

    console.log(`  ${table}: ${count?.toLocaleString() || 0} forecast records`);
  }
}

main().catch(console.error);
