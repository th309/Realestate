/**
 * Import Affordability Zillow Datasets
 *
 * Imports the 4 core affordability datasets into zillow_metro:
 * - homeowner_income (Income Needed to Buy)
 * - renter_income (Income Needed to Rent)
 * - affordable_price (Affordable Home Price)
 * - years_to_save (Years to Save)
 *
 * Usage:
 *   npx tsx scripts/import-affordability-datasets.ts
 */

import { mkdirSync, existsSync, createWriteStream } from 'fs';
import { join } from 'path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { parse as parseSync } from 'csv-parse/sync';
import https from 'https';
import { refreshCalculatedMetrics } from './utils/refresh-calculated-metrics';

const DATA_DIR = join(__dirname, '../data/zillow');
if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

// Load environment variables
config({ path: join(__dirname, '../.env.local') });
config({ path: join(__dirname, '../packages/frontend/.env.local') });
config({ path: join(__dirname, '../packages/backend/.env') });

// ============================================================================
// DATASET CONFIGURATIONS
// ============================================================================

interface DatasetConfig {
  id: string;
  datasetType: string;
  metricName: string;  // What we store in zillow_metro.metric_name
  downloadUrl: string;
  description: string;
}

const AFFORDABILITY_DATASETS: DatasetConfig[] = [
  {
    id: 'affordability-homeowner-income-metro',
    datasetType: 'new_homeowner_income_needed',
    metricName: 'homeowner_income',
    downloadUrl: 'https://files.zillowstatic.com/research/public_csvs/new_homeowner_income_needed/Metro_new_homeowner_income_needed_downpayment_0.20_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv',
    description: 'Income Needed to Buy - Metro areas'
  },
  {
    id: 'affordability-renter-income-metro',
    datasetType: 'new_renter_income_needed',
    metricName: 'renter_income',
    downloadUrl: 'https://files.zillowstatic.com/research/public_csvs/new_renter_income_needed/Metro_new_renter_income_needed_uc_sfrcondomfr_sm_sa_month.csv',
    description: 'Income Needed to Rent - Metro areas'
  },
  {
    id: 'affordability-home-price-metro',
    datasetType: 'affordable_home_price',
    metricName: 'affordable_price',
    downloadUrl: 'https://files.zillowstatic.com/research/public_csvs/affordable_price/Metro_affordable_price_downpayment_0.20_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv',
    description: 'Affordable Home Price - Metro areas'
  },
  {
    id: 'affordability-years-to-save-metro',
    datasetType: 'years_to_save',
    metricName: 'years_to_save',
    downloadUrl: 'https://files.zillowstatic.com/research/public_csvs/years_to_save/Metro_years_to_save_downpayment_0.20_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv',
    description: 'Years to Save - Metro areas'
  }
];

// ============================================================================
// HELPERS
// ============================================================================

function getSupabaseClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('Missing Supabase credentials. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_KEY');
  }

  return createClient(url, key);
}

async function downloadFile(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(destPath);
    https.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        // Handle redirect
        const redirectUrl = response.headers.location;
        if (redirectUrl) {
          https.get(redirectUrl, (redirectResponse) => {
            redirectResponse.pipe(file);
            file.on('finish', () => {
              file.close();
              resolve();
            });
          }).on('error', reject);
        } else {
          reject(new Error('Redirect without location header'));
        }
      } else if (response.statusCode === 200) {
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
      } else {
        reject(new Error(`HTTP ${response.statusCode}`));
      }
    }).on('error', reject);
  });
}

// State name to code mapping
const STATE_NAME_TO_CODE: Record<string, string> = {
  "Alabama": "AL", "Alaska": "AK", "Arizona": "AZ", "Arkansas": "AR", "California": "CA",
  "Colorado": "CO", "Connecticut": "CT", "Delaware": "DE", "Florida": "FL", "Georgia": "GA",
  "Hawaii": "HI", "Idaho": "ID", "Illinois": "IL", "Indiana": "IN", "Iowa": "IA",
  "Kansas": "KS", "Kentucky": "KY", "Louisiana": "LA", "Maine": "ME", "Maryland": "MD",
  "Massachusetts": "MA", "Michigan": "MI", "Minnesota": "MN", "Mississippi": "MS", "Missouri": "MO",
  "Montana": "MT", "Nebraska": "NE", "Nevada": "NV", "New Hampshire": "NH", "New Jersey": "NJ",
  "New Mexico": "NM", "New York": "NY", "North Carolina": "NC", "North Dakota": "ND", "Ohio": "OH",
  "Oklahoma": "OK", "Oregon": "OR", "Pennsylvania": "PA", "Rhode Island": "RI", "South Carolina": "SC",
  "South Dakota": "SD", "Tennessee": "TN", "Texas": "TX", "Utah": "UT", "Vermont": "VT",
  "Virginia": "VA", "Washington": "WA", "West Virginia": "WV", "Wisconsin": "WI", "Wyoming": "WY",
  "District of Columbia": "DC", "Puerto Rico": "PR"
};

// ============================================================================
// IMPORT LOGIC
// ============================================================================

async function loadCrosswalks(supabase: SupabaseClient): Promise<Map<number, string>> {
  console.log('Loading CBSA crosswalk from database...');
  const { data, error } = await supabase
    .from('zillow_metro_crosswalk')
    .select('zillow_region_id, cbsa_code');

  if (error) {
    console.error('Error loading crosswalk:', error.message);
    return new Map();
  }

  const map = new Map<number, string>();
  data?.forEach(row => {
    map.set(row.zillow_region_id, row.cbsa_code);
  });

  console.log(`Loaded ${map.size} CBSA crosswalk entries`);
  return map;
}

async function importDataset(
  supabase: SupabaseClient,
  dataset: DatasetConfig,
  cbsaCrosswalk: Map<number, string>
): Promise<{ inserted: number; errors: number }> {
  const filePath = join(DATA_DIR, `${dataset.id}.csv`);

  console.log(`\n--- ${dataset.description} ---`);
  console.log(`Downloading from: ${dataset.downloadUrl}`);

  // Download CSV
  await downloadFile(dataset.downloadUrl, filePath);
  console.log('Download complete');

  // Read and parse CSV
  const { readFileSync } = await import('fs');
  const csvContent = readFileSync(filePath, 'utf-8');
  const records = parseSync(csvContent, { columns: true, skip_empty_lines: true });

  console.log(`Parsed ${records.length} records`);

  // Get date columns (columns that look like dates: YYYY-MM-DD)
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  const firstRecord = records[0];
  const dateColumns = Object.keys(firstRecord).filter(col => datePattern.test(col));

  console.log(`Found ${dateColumns.length} date columns (importing ALL historical data)`);

  // Build records for upsert
  const dbRecords: any[] = [];
  let skipped = 0;
  let missingCbsa = 0;

  for (const record of records) {
    const regionId = parseInt(record.RegionID, 10);
    const regionName = record.RegionName;
    const stateName = record.StateName;

    // Skip US aggregate (RegionType = 'country')
    if (record.RegionType === 'country') continue;

    // Only include Metro areas
    if (record.RegionType !== 'msa') {
      skipped++;
      continue;
    }

    // Look up CBSA code from crosswalk (Zillow CSV doesn't have it)
    const cbsaCode = cbsaCrosswalk.get(regionId) || null;
    if (!cbsaCode) {
      missingCbsa++;
    }

    const stateCode = stateName ? STATE_NAME_TO_CODE[stateName] || null : null;

    for (const dateCol of dateColumns) {
      const value = record[dateCol];
      if (value === '' || value === null || value === undefined) continue;

      const numValue = parseFloat(value);
      if (isNaN(numValue)) continue;

      dbRecords.push({
        region_id: regionId,
        region_name: regionName,
        state_code: stateCode,
        cbsa_code: cbsaCode,
        period_date: dateCol,
        metric_name: dataset.metricName,
        value: numValue
      });
    }
  }

  if (missingCbsa > 0) {
    console.log(`Warning: ${missingCbsa} metros missing CBSA code in crosswalk`);
  }

  console.log(`Built ${dbRecords.length} database records (skipped ${skipped} non-metro)`);

  // Delete existing data for this metric (to avoid duplicates)
  console.log(`Deleting existing ${dataset.metricName} data...`);
  const { error: deleteError } = await supabase
    .from('zillow_metro')
    .delete()
    .eq('metric_name', dataset.metricName);

  if (deleteError) {
    console.error(`Delete error: ${deleteError.message}`);
  }

  // Batch upsert
  const batchSize = 5000;
  let inserted = 0;
  let errors = 0;

  for (let i = 0; i < dbRecords.length; i += batchSize) {
    const batch = dbRecords.slice(i, i + batchSize);

    const { error } = await supabase
      .from('zillow_metro')
      .upsert(batch, { onConflict: 'region_id,period_date,metric_name' });

    if (error) {
      console.error(`Batch error: ${error.message}`);
      errors += batch.length;
    } else {
      inserted += batch.length;
    }

    process.stdout.write(`\rInserted: ${inserted}/${dbRecords.length}`);
  }

  console.log(`\nComplete: ${inserted} inserted, ${errors} errors`);

  return { inserted, errors };
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('='.repeat(60));
  console.log('AFFORDABILITY DATASETS IMPORT');
  console.log('='.repeat(60));

  const supabase = getSupabaseClient();

  // Load CBSA crosswalk once for all datasets
  const cbsaCrosswalk = await loadCrosswalks(supabase);

  let totalInserted = 0;
  let totalErrors = 0;

  for (const dataset of AFFORDABILITY_DATASETS) {
    try {
      const result = await importDataset(supabase, dataset, cbsaCrosswalk);
      totalInserted += result.inserted;
      totalErrors += result.errors;
    } catch (error) {
      console.error(`Failed to import ${dataset.id}:`, error);
      totalErrors++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('IMPORT COMPLETE');
  console.log(`Total inserted: ${totalInserted}`);
  console.log(`Total errors: ${totalErrors}`);
  console.log('='.repeat(60));

  // Refresh calculated metrics after successful import
  if (totalInserted > 0) {
    await refreshCalculatedMetrics(supabase);
  }
}

main().catch(console.error);
