/**
 * Migration: Import Market Heat Index data from CSV into zillow_metro table
 * Run with: npx ts-node scripts/run-market-heat-migration.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load env from backend first, then root
dotenv.config({ path: './packages/backend/.env' });
dotenv.config({ path: './.env.local' });

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// CSV file path
const CSV_PATH = './data/zillow/Metro_market_temp_index_uc_sfrcondo_month.csv';

interface CSVRow {
  RegionID: string;
  SizeRank: string;
  RegionName: string;
  RegionType: string;
  StateName: string;
  [date: string]: string; // Date columns like "2018-01-31"
}

function parseCSV(content: string): CSVRow[] {
  const lines = content.trim().split('\n');
  const headers = lines[0].split(',');

  return lines.slice(1).map(line => {
    // Handle quoted fields with commas
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current);

    const row: any = {};
    headers.forEach((header, i) => {
      row[header] = values[i];
    });
    return row;
  });
}

async function migrateMarketHeat() {
  console.log('Starting Market Heat Index migration to zillow_metro...\n');

  // Step 1: Read CSV file
  console.log(`Reading CSV from ${CSV_PATH}...`);
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`CSV file not found: ${CSV_PATH}`);
    return;
  }

  const csvContent = fs.readFileSync(CSV_PATH, 'utf-8');
  const rows = parseCSV(csvContent);
  console.log(`Parsed ${rows.length} regions from CSV\n`);

  // Step 2: Get date columns (all columns after StateName)
  const headers = csvContent.split('\n')[0].split(',');
  const dateColumns = headers.filter(h => h.match(/^\d{4}-\d{2}-\d{2}$/));
  console.log(`Found ${dateColumns.length} date columns (${dateColumns[0]} to ${dateColumns[dateColumns.length - 1]})\n`);

  // Only import metros (skip country/national row)
  const metroRows = rows.filter(row => row.RegionType === 'msa');
  console.log(`Processing ${metroRows.length} metro areas...\n`);

  // Step 3: Get CBSA mappings from zillow_metro_crosswalk
  console.log('Fetching CBSA mappings...');
  const { data: crosswalk } = await supabase
    .from('zillow_metro_crosswalk')
    .select('zillow_region_id, cbsa_code');

  const cbsaMap = new Map(crosswalk?.map(c => [String(c.zillow_region_id), c.cbsa_code]) || []);
  console.log(`Found ${cbsaMap.size} CBSA mappings\n`);

  // Step 4: Transform and batch insert
  const batchSize = 500;
  let totalInserted = 0;
  let totalSkipped = 0;

  // Build all records for all dates
  const allRecords: any[] = [];

  for (const row of metroRows) {
    const regionId = parseInt(row.RegionID, 10);
    if (isNaN(regionId)) continue;

    const cbsaCode = cbsaMap.get(row.RegionID);
    const stateCode = row.StateName?.length === 2 ? row.StateName : null;

    for (const date of dateColumns) {
      const value = parseFloat(row[date]);
      if (isNaN(value)) continue;

      allRecords.push({
        region_id: regionId,
        region_name: row.RegionName.replace(/"/g, ''),
        cbsa_code: cbsaCode || null,
        state_code: stateCode,
        period_date: date,
        metric_name: 'market_heat',
        value: value,
      });
    }
  }

  console.log(`Total records to insert: ${allRecords.length}`);

  // Insert in batches
  for (let i = 0; i < allRecords.length; i += batchSize) {
    const batch = allRecords.slice(i, i + batchSize);

    const { error: insertError } = await supabase
      .from('zillow_metro')
      .upsert(batch, { onConflict: 'region_id,period_date,metric_name' });

    if (insertError) {
      console.error(`Error inserting batch ${i}-${i + batch.length}:`, insertError.message);
      totalSkipped += batch.length;
    } else {
      totalInserted += batch.length;
      process.stdout.write(`\rInserted ${totalInserted} / ${allRecords.length} records...`);
    }
  }

  console.log(`\n\nMigration complete!`);
  console.log(`- Inserted/Updated: ${totalInserted} records`);
  console.log(`- Skipped: ${totalSkipped} records`);

  // Step 5: Verify
  console.log('\nVerifying migration...');
  const { count } = await supabase
    .from('zillow_metro')
    .select('*', { count: 'exact', head: true })
    .eq('metric_name', 'market_heat');

  console.log(`Total market_heat records in zillow_metro: ${count}`);

  // Show latest date
  const { data: latestData } = await supabase
    .from('zillow_metro')
    .select('period_date')
    .eq('metric_name', 'market_heat')
    .order('period_date', { ascending: false })
    .limit(1)
    .single();

  console.log(`Latest date available: ${latestData?.period_date}`);
}

migrateMarketHeat().catch(console.error);
