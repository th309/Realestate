#!/usr/bin/env npx tsx
/**
 * Run Migration 035: Create zillow_metro_crosswalk table and import data
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
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

async function runMigration() {
  console.log('=== Migration 035: Create zillow_metro_crosswalk ===\n');

  // Read migration SQL
  const migrationPath = join(__dirname, 'migrations/035-create-zillow-metro-crosswalk.sql');
  const sql = readFileSync(migrationPath, 'utf-8');

  // Split into individual statements
  const statements = sql
    .split(/;(?=\s*(?:--|CREATE|DROP|TRUNCATE|ALTER|GRANT|BEGIN|COMMIT|DO))/gi)
    .map(s => s.trim())
    .filter(s => s && !s.startsWith('--') && s.length > 5);

  console.log(`Executing ${statements.length} SQL statements...\n`);

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    const preview = stmt.substring(0, 60).replace(/\n/g, ' ');

    try {
      const { error } = await supabase.rpc('exec_sql', { sql_query: stmt });
      if (error) {
        console.log(`[${i + 1}/${statements.length}] ${preview}... (RPC unavailable)`);
      } else {
        console.log(`[${i + 1}/${statements.length}] OK: ${preview}...`);
      }
    } catch (err: any) {
      console.log(`[${i + 1}/${statements.length}] ${preview}... (${err.message})`);
    }
  }
}

async function importCrosswalk() {
  console.log('\n=== Importing Crosswalk Data ===\n');

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

  // Insert in batches
  const records = Array.from(uniqueMetros.values());
  const batchSize = 500;
  let inserted = 0;
  let errors = 0;

  console.log(`\nInserting ${records.length} records...`);

  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);

    const { error } = await supabase
      .from('zillow_metro_crosswalk')
      .upsert(batch, { onConflict: 'zillow_region_id' });

    if (error) {
      console.error(`\nBatch error at ${i}:`, error.message);
      errors++;
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
  if (errors > 0) {
    console.log(`Errors: ${errors} batches failed`);
  }
}

async function main() {
  await runMigration();
  await importCrosswalk();
  console.log('\n=== Migration 035 Complete ===');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
