#!/usr/bin/env npx tsx
/**
 * Import Zillow Metro Crosswalk to Database
 *
 * Creates the zillow_metro_crosswalk table and imports data from CSV.
 * This table maps Zillow RegionIDs to Census CBSA codes.
 *
 * Usage:
 *   npx tsx scripts/import-metro-crosswalk.ts
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parse } from 'csv-parse/sync';

config({ path: join(__dirname, '../packages/backend/.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

interface CrosswalkRecord {
  zillow_region_id: number;
  zillow_region_name: string;
  zillow_state_name: string | null;
  cbsa_code: string;
  cbsa_title: string | null;
  cbsa_type: string | null;
}

async function main() {
  console.log('=== Import Zillow Metro Crosswalk ===\n');

  // Load CSV
  const csvPath = join(__dirname, '../data/normalization/Zillow_Census_Metro_Crosswalk.csv');
  console.log('Loading crosswalk from:', csvPath);

  const csvContent = readFileSync(csvPath, 'utf-8');
  const rawRecords = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
  });

  console.log(`Parsed ${rawRecords.length} rows from CSV`);

  // Deduplicate - file has multiple rows per metro (one per county)
  const uniqueMetros = new Map<number, CrosswalkRecord>();

  for (const record of rawRecords) {
    const regionId = parseInt(record.Zillow_RegionID, 10);
    if (isNaN(regionId) || !record['CBSA Code']) continue;

    if (!uniqueMetros.has(regionId)) {
      uniqueMetros.set(regionId, {
        zillow_region_id: regionId,
        zillow_region_name: record.Zillow_RegionName || '',
        zillow_state_name: record.Zillow_StateName || null,
        cbsa_code: record['CBSA Code'],
        cbsa_title: record['CBSA Title'] || null,
        cbsa_type: record['Metropolitan/Micropolitan Statistical Area'] || null,
      });
    }
  }

  console.log(`Found ${uniqueMetros.size} unique metros with CBSA codes`);

  // Clear existing data
  console.log('\nClearing existing crosswalk data...');
  const { error: deleteError } = await supabase
    .from('zillow_metro_crosswalk')
    .delete()
    .neq('zillow_region_id', 0); // Delete all

  if (deleteError) {
    // Table might not exist, try to create it
    console.log('Table may not exist, attempting to insert anyway...');
  }

  // Insert in batches
  const records = Array.from(uniqueMetros.values());
  const batchSize = 500;
  let inserted = 0;

  console.log(`\nInserting ${records.length} records...`);

  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);

    const { error } = await supabase
      .from('zillow_metro_crosswalk')
      .upsert(batch, { onConflict: 'zillow_region_id' });

    if (error) {
      console.error(`Batch error at ${i}:`, error.message);
      continue;
    }

    inserted += batch.length;
    process.stdout.write(`\rProgress: ${inserted}/${records.length}`);
  }

  console.log('\n');

  // Verify
  const { count } = await supabase
    .from('zillow_metro_crosswalk')
    .select('*', { count: 'exact', head: true });

  console.log(`Done! Total records in table: ${count}`);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
