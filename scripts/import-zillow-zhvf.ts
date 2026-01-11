/**
 * Import Zillow Home Value Forecast (ZHVF) Data
 *
 * Downloads ZHVF (Home Value Forecast) data from Zillow Research
 * and imports into zillow_zhvf table.
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
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

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

interface ZHVFRecord {
  region_id: string;
  date: string;
  forecast_1m: number | null;
  forecast_3m: number | null;
  forecast_12m: number | null;
  geography: string;
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

function parseZHVFData(csvContent: string, geography: string): ZHVFRecord[] {
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

  const zhvfRecords: ZHVFRecord[] = [];

  // Map RegionType to our geography naming
  const geoMap: Record<string, string> = {
    'msa': 'Metro',
    'country': 'US',
    'zip': 'Zip',
    'state': 'State'
  };

  for (const record of records) {
    const regionId = record.RegionID;
    const baseDate = record.BaseDate;
    const regionType = record.RegionType;

    if (!regionId || !baseDate) continue;

    // Parse forecast values
    const forecast1m = col1m && record[col1m] !== '' ? parseFloat(record[col1m]) : null;
    const forecast3m = col3m && record[col3m] !== '' ? parseFloat(record[col3m]) : null;
    const forecast12m = col12m && record[col12m] !== '' ? parseFloat(record[col12m]) : null;

    // Skip if all forecasts are null
    if (forecast1m === null && forecast3m === null && forecast12m === null) continue;

    zhvfRecords.push({
      region_id: String(regionId),
      date: baseDate,
      forecast_1m: isNaN(forecast1m!) ? null : forecast1m,
      forecast_3m: isNaN(forecast3m!) ? null : forecast3m,
      forecast_12m: isNaN(forecast12m!) ? null : forecast12m,
      geography: geoMap[regionType] || geography.charAt(0).toUpperCase() + geography.slice(1)
    });
  }

  return zhvfRecords;
}

async function importZHVF(geography: string): Promise<number> {
  const url = ZHVF_URLS[geography];
  if (!url) {
    console.error(`Unknown geography: ${geography}`);
    return 0;
  }

  console.log(`\n${'='.repeat(70)}`);
  console.log(`IMPORTING ZHVF: ${geography.toUpperCase()}`);
  console.log('='.repeat(70));

  try {
    const csvContent = await downloadCSV(url);
    console.log(`Downloaded ${(csvContent.length / 1024).toFixed(1)} KB`);

    const records = parseZHVFData(csvContent, geography);
    console.log(`\nPrepared ${records.length} ZHVF records for insertion`);

    if (records.length === 0) {
      console.log('No records to insert');
      return 0;
    }

    // Show sample
    console.log('\nSample records:');
    records.slice(0, 3).forEach(r => {
      console.log(`  ${r.region_id} (${r.geography}): 1m=${r.forecast_1m}%, 3m=${r.forecast_3m}%, 12m=${r.forecast_12m}%`);
    });

    // Insert in batches using upsert
    const batchSize = 500;
    let inserted = 0;

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);

      const { error } = await supabase
        .from('zillow_zhvf')
        .upsert(batch, {
          onConflict: 'region_id,date,geography',
          ignoreDuplicates: false
        });

      if (error) {
        console.error(`\nBatch error at ${i}:`, error.message);
        // Continue with next batch
      } else {
        inserted += batch.length;
      }

      process.stdout.write(`\rInserted ${inserted}/${records.length} records...`);
    }

    console.log(`\n\nCompleted ${geography}: ${inserted} records inserted`);
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

  // Verify data
  const { data: sample, error: sampleError } = await supabase
    .from('zillow_zhvf')
    .select('region_id, date, forecast_1m, forecast_3m, forecast_12m, geography')
    .order('date', { ascending: false })
    .limit(10);

  if (sample && sample.length > 0) {
    console.log('\nSample data in database:');
    console.table(sample);
  } else if (sampleError) {
    console.log('\nCould not verify:', sampleError.message);
  }

  // Show summary by geography
  const { data: summary } = await supabase
    .from('zillow_zhvf')
    .select('geography')
    .order('geography');

  if (summary) {
    const counts = summary.reduce((acc: Record<string, number>, r) => {
      acc[r.geography] = (acc[r.geography] || 0) + 1;
      return acc;
    }, {});
    console.log('\nRecords by geography:');
    Object.entries(counts).forEach(([geo, count]) => {
      console.log(`  ${geo}: ${count}`);
    });
  }
}

main().catch(console.error);
