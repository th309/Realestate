#!/usr/bin/env npx tsx
/**
 * Import ZORDI (Renter Demand Index) All Homes, SFR, and MFR datasets to zillow_metro
 *
 * ZORDI URLs:
 * - All Homes: Metro_zordi_uc_sfrcondomfr_month.csv -> zordi
 * - SFR: Metro_zordi_uc_sfr_month.csv -> zordi_sfr
 * - MFR: Metro_zordi_uc_mfr_month.csv -> zordi_mfr
 */

import { join } from 'path';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { parse as parseSync } from 'csv-parse/sync';
import { refreshCalculatedMetrics } from './utils/refresh-calculated-metrics';

// Load environment variables
config({ path: join(__dirname, '../packages/backend/.env') });
config({ path: join(__dirname, '../web/.env.local') });
config({ path: join(__dirname, '../.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const ZILLOW_CSV_BASE = 'https://files.zillowstatic.com/research/public_csvs';

interface DatasetConfig {
  id: string;
  url: string;
  metricName: string;
  description: string;
}

const ZORDI_DATASETS: DatasetConfig[] = [
  {
    id: 'zordi-all-metro',
    url: `${ZILLOW_CSV_BASE}/zordi/Metro_zordi_uc_sfrcondomfr_month.csv`,
    metricName: 'zordi',
    description: 'ZORDI - All Homes (Renter Demand Index)'
  },
  {
    id: 'zordi-sfr-metro',
    url: `${ZILLOW_CSV_BASE}/zordi/Metro_zordi_uc_sfr_month.csv`,
    metricName: 'zordi_sfr',
    description: 'ZORDI - Single Family (Renter Demand Index)'
  },
  {
    id: 'zordi-mfr-metro',
    url: `${ZILLOW_CSV_BASE}/zordi/Metro_zordi_uc_mfr_month.csv`,
    metricName: 'zordi_mfr',
    description: 'ZORDI - Multifamily (Renter Demand Index)'
  }
];

// CBSA crosswalk
const cbsaCrosswalkMap: Map<string, string> = new Map();
const cbsaNameMap: Map<string, string> = new Map();

function normalizeMetroName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[,\-]/g, ' ')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function loadCbsaCrosswalk() {
  console.log('Loading CBSA crosswalk...');

  const { data, error } = await supabase
    .from('zillow_metro_crosswalk')
    .select('zillow_region_id, cbsa_code, zillow_region_name, cbsa_title');

  if (error) {
    console.error('Error loading crosswalk:', error.message);
    return;
  }

  for (const row of data || []) {
    if (row.zillow_region_id && row.cbsa_code) {
      cbsaCrosswalkMap.set(String(row.zillow_region_id), row.cbsa_code);
      cbsaNameMap.set(String(row.zillow_region_id), row.cbsa_title || row.zillow_region_name);
    }
    if (row.zillow_region_name && row.cbsa_code) {
      const normalized = normalizeMetroName(row.zillow_region_name);
      cbsaCrosswalkMap.set(normalized, row.cbsa_code);
      cbsaNameMap.set(normalized, row.cbsa_title || row.zillow_region_name);
    }
  }

  console.log(`  Loaded ${cbsaCrosswalkMap.size} crosswalk entries`);
}

function getCbsaCode(regionId: string, regionName: string): string | null {
  // Try by region ID first
  if (cbsaCrosswalkMap.has(regionId)) {
    return cbsaCrosswalkMap.get(regionId)!;
  }
  // Try by normalized name
  const normalized = normalizeMetroName(regionName);
  if (cbsaCrosswalkMap.has(normalized)) {
    return cbsaCrosswalkMap.get(normalized)!;
  }
  return null;
}

async function downloadCSV(url: string): Promise<string | null> {
  try {
    console.log(`  Downloading: ${url.split('/').pop()}`);
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`  HTTP error: ${response.status}`);
      return null;
    }
    return await response.text();
  } catch (error) {
    console.error(`  Download error:`, error);
    return null;
  }
}

function parseCSV(csvContent: string): any[] {
  return parseSync(csvContent, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true
  });
}

async function importDataset(dataset: DatasetConfig): Promise<{ recordsInserted: number; errors: number }> {
  console.log(`\nImporting: ${dataset.description}`);

  const csvContent = await downloadCSV(dataset.url);
  if (!csvContent) {
    return { recordsInserted: 0, errors: 1 };
  }

  const rows = parseCSV(csvContent);
  console.log(`  Parsed ${rows.length} rows`);

  if (rows.length === 0) {
    return { recordsInserted: 0, errors: 0 };
  }

  // Find date columns (YYYY-MM-DD format)
  const sampleRow = rows[0];
  const dateColumns = Object.keys(sampleRow).filter(col => /^\d{4}-\d{2}-\d{2}$/.test(col));
  console.log(`  Found ${dateColumns.length} date columns`);

  // Transform to long format
  const records: any[] = [];
  let skippedNoCbsa = 0;

  for (const row of rows) {
    const regionId = row['RegionID'] || row['region_id'];
    const regionName = row['RegionName'] || row['region_name'];

    if (!regionId || !regionName) continue;

    const cbsaCode = getCbsaCode(regionId, regionName);
    if (!cbsaCode) {
      skippedNoCbsa++;
      continue;
    }

    for (const dateCol of dateColumns) {
      const value = row[dateCol];
      if (value === '' || value === null || value === undefined) continue;

      const numValue = parseFloat(value);
      if (isNaN(numValue)) continue;

      records.push({
        region_id: parseInt(regionId, 10),
        region_name: regionName,
        cbsa_code: cbsaCode,
        period_date: dateCol,
        metric_name: dataset.metricName,
        value: numValue
      });
    }
  }

  console.log(`  Prepared ${records.length} records (skipped ${skippedNoCbsa} without CBSA)`);

  if (records.length === 0) {
    return { recordsInserted: 0, errors: 0 };
  }

  // Insert in batches
  const BATCH_SIZE = 1000;
  let totalInserted = 0;
  let totalErrors = 0;

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);

    const { error } = await supabase
      .from('zillow_metro')
      .upsert(batch, {
        onConflict: 'region_id,period_date,metric_name',
        ignoreDuplicates: false
      });

    if (error) {
      console.error(`  Batch error at ${i}:`, error.message);
      totalErrors++;
    } else {
      totalInserted += batch.length;
    }

    // Progress
    if ((i + BATCH_SIZE) % 10000 === 0 || i + BATCH_SIZE >= records.length) {
      console.log(`  Progress: ${Math.min(i + BATCH_SIZE, records.length)}/${records.length}`);
    }
  }

  console.log(`  Inserted ${totalInserted} records`);
  return { recordsInserted: totalInserted, errors: totalErrors };
}

async function main() {
  console.log('='.repeat(60));
  console.log('ZORDI (RENTER DEMAND INDEX) IMPORT');
  console.log('='.repeat(60));
  console.log(`Start Time: ${new Date().toISOString()}`);
  console.log('');

  await loadCbsaCrosswalk();

  let totalInserted = 0;
  let totalErrors = 0;
  const startTime = Date.now();

  for (const dataset of ZORDI_DATASETS) {
    const result = await importDataset(dataset);
    totalInserted += result.recordsInserted;
    totalErrors += result.errors;
  }

  const elapsed = Date.now() - startTime;
  const minutes = Math.floor(elapsed / 60000);
  const seconds = Math.floor((elapsed % 60000) / 1000);

  console.log('\n' + '='.repeat(60));
  console.log('IMPORT COMPLETE');
  console.log('='.repeat(60));
  console.log(`Total records inserted: ${totalInserted.toLocaleString()}`);
  console.log(`Total errors: ${totalErrors}`);
  console.log(`Duration: ${minutes}m ${seconds}s`);
  console.log(`End Time: ${new Date().toISOString()}`);

  // Verify counts
  console.log('\nVerifying counts:');
  for (const metricName of ['zordi', 'zordi_sfr', 'zordi_mfr']) {
    const { count } = await supabase
      .from('zillow_metro')
      .select('*', { count: 'exact', head: true })
      .eq('metric_name', metricName);
    console.log(`  ${metricName}: ${count?.toLocaleString()} records`);
  }

  // Refresh calculated metrics after successful import
  if (totalInserted > 0) {
    await refreshCalculatedMetrics(supabase);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
