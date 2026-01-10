/**
 * Import Zillow ZHVI State-Level Data
 *
 * Downloads ZHVI All Homes (smoothed, seasonally adjusted) for US States
 * and imports into zillow_metrics table.
 *
 * Usage:
 *   npx tsx scripts/import-zillow-state-zhvi.ts
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

console.log('Using Supabase URL:', supabaseUrl);
console.log('Service key (first 20 chars):', supabaseServiceKey.substring(0, 20) + '...');

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  },
  db: {
    schema: 'public'
  }
});

// Zillow State ZHVI URL
const ZHVI_STATE_URL = 'https://files.zillowstatic.com/research/public_csvs/zhvi/State_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv';

// State name to FIPS code mapping
const STATE_FIPS: Record<string, string> = {
  'Alabama': '01', 'Alaska': '02', 'Arizona': '04', 'Arkansas': '05', 'California': '06',
  'Colorado': '08', 'Connecticut': '09', 'Delaware': '10', 'District of Columbia': '11', 'Florida': '12',
  'Georgia': '13', 'Hawaii': '15', 'Idaho': '16', 'Illinois': '17', 'Indiana': '18',
  'Iowa': '19', 'Kansas': '20', 'Kentucky': '21', 'Louisiana': '22', 'Maine': '23',
  'Maryland': '24', 'Massachusetts': '25', 'Michigan': '26', 'Minnesota': '27', 'Mississippi': '28',
  'Missouri': '29', 'Montana': '30', 'Nebraska': '31', 'Nevada': '32', 'New Hampshire': '33',
  'New Jersey': '34', 'New Mexico': '35', 'New York': '36', 'North Carolina': '37', 'North Dakota': '38',
  'Ohio': '39', 'Oklahoma': '40', 'Oregon': '41', 'Pennsylvania': '42', 'Rhode Island': '44',
  'South Carolina': '45', 'South Dakota': '46', 'Tennessee': '47', 'Texas': '48', 'Utah': '49',
  'Vermont': '50', 'Virginia': '51', 'Washington': '53', 'West Virginia': '54', 'Wisconsin': '55',
  'Wyoming': '56', 'Puerto Rico': '72'
};

async function importStateZHVI() {
  console.log('Downloading Zillow State ZHVI data...');
  console.log(`URL: ${ZHVI_STATE_URL}\n`);

  try {
    // Download CSV
    const response = await axios.get(ZHVI_STATE_URL, {
      timeout: 60000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const csvContent = response.data;
    console.log(`Downloaded ${(csvContent.length / 1024).toFixed(1)} KB`);

    // Parse CSV
    const records: any[] = parseSync(csvContent, {
      columns: true,
      skip_empty_lines: true
    });

    console.log(`Parsed ${records.length} state records\n`);

    // Inspect columns
    const sampleRecord = records[0];
    const allColumns = Object.keys(sampleRecord);
    const metadataColumns = allColumns.filter(key => !/^\d{4}-\d{2}-\d{2}$/.test(key));
    console.log('Metadata columns:', metadataColumns);
    console.log('Sample record metadata:', Object.fromEntries(
      metadataColumns.map(k => [k, sampleRecord[k]])
    ));

    // Find date columns (they look like "2024-01-31")
    const dateColumns = allColumns.filter(key => /^\d{4}-\d{2}-\d{2}$/.test(key));

    console.log(`\nFound ${dateColumns.length} monthly data points`);
    console.log(`Date range: ${dateColumns[0]} to ${dateColumns[dateColumns.length - 1]}\n`);

    // Get most recent 12 months of data
    const recentDates = dateColumns.slice(-12);
    console.log(`Importing last 12 months: ${recentDates[0]} to ${recentDates[recentDates.length - 1]}\n`);

    // First, ensure states exist in markets table
    console.log('Ensuring state records exist in markets table...');
    const marketsToInsert: any[] = [];

    for (const record of records) {
      const regionId = record.RegionID;
      const regionName = record.RegionName;

      if (regionId && regionName) {
        marketsToInsert.push({
          region_id: regionId,
          region_name: regionName,
          region_type: 'state',
          state_name: regionName,
          state_code: Object.entries(STATE_FIPS).find(([name]) => name === regionName)?.[1] || null
        });
      }
    }

    // Upsert markets
    const { error: marketsError } = await supabase
      .from('markets')
      .upsert(marketsToInsert, { onConflict: 'region_id' });

    if (marketsError) {
      console.error('Error upserting markets:', marketsError.message);
    } else {
      console.log(`Upserted ${marketsToInsert.length} state market records`);
    }

    // Prepare ZHVI records for insertion into zillow_zhvi table
    const zhviToInsert: any[] = [];

    for (const record of records) {
      const regionId = record.RegionID;
      const regionName = record.RegionName;

      if (!regionId || !regionName) continue;

      for (const dateCol of recentDates) {
        const value = record[dateCol];
        if (value && !isNaN(parseFloat(value))) {
          zhviToInsert.push({
            region_id: regionId,
            date: dateCol,
            value: parseFloat(value),
            property_type: 'all_homes',
            tier: 'middle',
            geography: 'state'
          });
        }
      }
    }

    console.log(`Prepared ${zhviToInsert.length} ZHVI records for insertion`);

    // Insert in batches into zillow_zhvi
    const batchSize = 100;
    let inserted = 0;

    for (let i = 0; i < zhviToInsert.length; i += batchSize) {
      const batch = zhviToInsert.slice(i, i + batchSize);

      const { error } = await supabase
        .from('zillow_zhvi')
        .upsert(batch, { onConflict: 'region_id,date,property_type,tier' });

      if (error) {
        console.error(`Batch error at ${i}:`, error.message);
      } else {
        inserted += batch.length;
      }

      process.stdout.write(`\rInserted ${inserted}/${zhviToInsert.length} records...`);
    }

    console.log(`\n\nImport complete! Inserted ${inserted} ZHVI records for ${records.length} states`);

    // Verify
    const { data: sample, error: sampleError } = await supabase
      .from('zillow_zhvi')
      .select('region_id, date, value')
      .eq('geography', 'state')
      .order('date', { ascending: false })
      .limit(5);

    if (sample) {
      console.log('\nSample data:');
      console.table(sample);
    }

  } catch (error: any) {
    console.error('Import failed:', error.message);
    process.exit(1);
  }
}

importStateZHVI();
