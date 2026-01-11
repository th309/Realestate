/**
 * Import Zillow Observed Renter Demand Index (ZORDI) Data
 *
 * Downloads ZORDI data from Zillow Research and imports into zillow_zordi table.
 *
 * ZORDI measures relative demand for rentals in a given area.
 * Higher values indicate stronger renter demand.
 * This is DIFFERENT from ZORI which measures actual rent prices.
 *
 * CSV Structure:
 * - RegionID, SizeRank, RegionName, RegionType, StateName
 * - {date columns}: Monthly index values
 *
 * Usage:
 *   npx tsx scripts/import-zillow-zordi.ts [--geography=metro|zip|all] [--property-type=all|sfr|mfr]
 *
 * Default: imports all geographies with 'All Homes Plus Multifamily' property type
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

// ZORDI CSV URLs from Zillow Research
// URL pattern: https://files.zillowstatic.com/research/public_csvs/zordi/{Geo}_zordi_{type}_sm_sa_month.csv
// Types: uc_sfrcondo (all homes), uc_sfr (single family), uc_mf (multifamily)
const ZORDI_URLS: Record<string, Record<string, string>> = {
  metro: {
    all: 'https://files.zillowstatic.com/research/public_csvs/zordi/Metro_zordi_uc_sfrcondo_sm_sa_month.csv',
    sfr: 'https://files.zillowstatic.com/research/public_csvs/zordi/Metro_zordi_uc_sfr_sm_sa_month.csv',
    mfr: 'https://files.zillowstatic.com/research/public_csvs/zordi/Metro_zordi_uc_mf_sm_sa_month.csv',
  },
  zip: {
    all: 'https://files.zillowstatic.com/research/public_csvs/zordi/Zip_zordi_uc_sfrcondo_sm_sa_month.csv',
    sfr: 'https://files.zillowstatic.com/research/public_csvs/zordi/Zip_zordi_uc_sfr_sm_sa_month.csv',
    mfr: 'https://files.zillowstatic.com/research/public_csvs/zordi/Zip_zordi_uc_mf_sm_sa_month.csv',
  },
};

// Property type mapping
const PROPERTY_TYPE_MAP: Record<string, string> = {
  all: 'All Homes Plus Multifamily',
  sfr: 'SFR',
  mfr: 'Multifamily',
};

interface ZORDIRecord {
  region_id: string;
  date: string;
  value: number;
  property_type: string;
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

function parseZORDIData(csvContent: string, geography: string, propertyType: string): ZORDIRecord[] {
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

  // Find date columns (format: YYYY-MM-DD)
  const dateColumns = columns.filter(col => /^\d{4}-\d{2}-\d{2}$/.test(col)).sort();

  console.log(`Found ${dateColumns.length} date columns`);
  if (dateColumns.length > 0) {
    console.log(`Date range: ${dateColumns[0]} to ${dateColumns[dateColumns.length - 1]}`);
  }

  // Map RegionType to our geography naming
  const geoMap: Record<string, string> = {
    'msa': 'Metro',
    'country': 'US',
    'zip': 'Zip',
    'state': 'State'
  };

  const dbPropertyType = PROPERTY_TYPE_MAP[propertyType] || 'All Homes Plus Multifamily';
  const zordiRecords: ZORDIRecord[] = [];

  // Use only the most recent date to avoid inserting too much historical data
  // (can be changed to import all dates if needed)
  const recentDates = dateColumns.slice(-1); // Just the most recent date
  console.log(`Importing data for dates: ${recentDates.join(', ')}`);

  for (const record of records) {
    const regionId = record.RegionID;
    const regionType = record.RegionType;

    if (!regionId) continue;

    for (const dateCol of recentDates) {
      const value = record[dateCol];
      if (value === '' || value === undefined || value === null) continue;

      const numValue = parseFloat(value);
      if (isNaN(numValue)) continue;

      zordiRecords.push({
        region_id: String(regionId),
        date: dateCol,
        value: numValue,
        property_type: dbPropertyType,
        geography: geoMap[regionType] || geography.charAt(0).toUpperCase() + geography.slice(1)
      });
    }
  }

  return zordiRecords;
}

async function importZORDI(geography: string, propertyType: string): Promise<number> {
  const urls = ZORDI_URLS[geography];
  if (!urls) {
    console.error(`Unknown geography: ${geography}`);
    return 0;
  }

  const url = urls[propertyType];
  if (!url) {
    console.error(`Unknown property type: ${propertyType}`);
    return 0;
  }

  console.log(`\n${'='.repeat(70)}`);
  console.log(`IMPORTING ZORDI: ${geography.toUpperCase()} - ${PROPERTY_TYPE_MAP[propertyType]}`);
  console.log('='.repeat(70));

  try {
    const csvContent = await downloadCSV(url);
    console.log(`Downloaded ${(csvContent.length / 1024).toFixed(1)} KB`);

    const records = parseZORDIData(csvContent, geography, propertyType);
    console.log(`\nPrepared ${records.length} ZORDI records for insertion`);

    if (records.length === 0) {
      console.log('No records to insert');
      return 0;
    }

    // Show sample
    console.log('\nSample records:');
    records.slice(0, 5).forEach(r => {
      console.log(`  ${r.region_id} (${r.geography}): ${r.value.toFixed(2)} on ${r.date}`);
    });

    // Insert in batches using upsert
    const batchSize = 500;
    let inserted = 0;

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);

      const { error } = await supabase
        .from('zillow_zordi')
        .upsert(batch, {
          onConflict: 'region_id,date,property_type,geography',
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

    console.log(`\n\nCompleted ${geography} ${propertyType}: ${inserted} records inserted`);
    return inserted;

  } catch (error: any) {
    if (error.response?.status === 404) {
      console.error(`\nZORDI file not found for ${geography}/${propertyType}. URL may have changed.`);
      console.error('Check https://www.zillow.com/research/data/ for updated URLs.');
    } else {
      console.error(`\nFailed to import ${geography}/${propertyType}:`, error.message);
    }
    return 0;
  }
}

async function main() {
  const args = process.argv.slice(2);

  const geographyArg = args.find(a => a.startsWith('--geography='));
  const geography = geographyArg?.split('=')[1] || 'all';

  const propertyTypeArg = args.find(a => a.startsWith('--property-type='));
  const propertyType = propertyTypeArg?.split('=')[1] || 'all';

  console.log('='.repeat(70));
  console.log('ZILLOW OBSERVED RENTER DEMAND INDEX (ZORDI) IMPORT');
  console.log('='.repeat(70));
  console.log(`Supabase URL: ${supabaseUrl}`);
  console.log(`Geography: ${geography}`);
  console.log(`Property Type: ${propertyType}`);
  console.log('');

  let totalInserted = 0;

  const geos = geography === 'all' ? Object.keys(ZORDI_URLS) : [geography];
  const propTypes = propertyType === 'all' ? ['all', 'sfr', 'mfr'] : [propertyType];

  for (const geo of geos) {
    for (const pt of propTypes) {
      totalInserted += await importZORDI(geo, pt);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log(`IMPORT COMPLETE: ${totalInserted} total records`);
  console.log('='.repeat(70));

  // Verify data
  const { data: sample, error: sampleError } = await supabase
    .from('zillow_zordi')
    .select('region_id, date, value, property_type, geography')
    .order('date', { ascending: false })
    .limit(10);

  if (sample && sample.length > 0) {
    console.log('\nSample data in database:');
    console.table(sample);
  } else if (sampleError) {
    console.log('\nCould not verify:', sampleError.message);
  }

  // Show summary by geography and property type
  const { data: summary } = await supabase
    .from('zillow_zordi')
    .select('geography, property_type')
    .order('geography');

  if (summary) {
    const counts = summary.reduce((acc: Record<string, number>, r) => {
      const key = `${r.geography} - ${r.property_type}`;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    console.log('\nRecords by geography/property type:');
    Object.entries(counts).forEach(([key, count]) => {
      console.log(`  ${key}: ${count}`);
    });
  }
}

main().catch(console.error);
