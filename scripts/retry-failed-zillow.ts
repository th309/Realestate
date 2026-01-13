/**
 * Retry Failed Zillow Datasets
 *
 * Quick script to retry just the 2 failed datasets with corrected URLs:
 * - new-construction-sale-price-metro
 * - affordability-home-price-metro
 */

import { join } from 'path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { parse as parseSync } from 'csv-parse/sync';

config({ path: join(__dirname, '../.env.local') });
config({ path: join(__dirname, '../packages/frontend/.env.local') });
config({ path: join(__dirname, '../packages/backend/.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

const FAILED_DATASETS = [
  {
    id: 'new-construction-sale-price-metro',
    url: 'https://files.zillowstatic.com/research/public_csvs/new_con_median_sale_price/Metro_new_con_median_sale_price_uc_sfrcondo_month.csv?t=1768221332',
    metricName: 'new_con_price',
    table: 'zillow_metro'
  },
  {
    id: 'affordability-home-price-metro',
    url: 'https://files.zillowstatic.com/research/public_csvs/affordable_price/Metro_affordable_price_downpayment_0.20_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv?t=1768221332',
    metricName: 'affordable_price',
    table: 'zillow_metro'
  }
];

async function downloadCSV(url: string): Promise<string> {
  console.log(`  Downloading from ${url}`);
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  return response.text();
}

async function importDataset(
  supabase: SupabaseClient,
  dataset: typeof FAILED_DATASETS[0]
): Promise<number> {
  console.log(`\nProcessing: ${dataset.id}`);

  const csvContent = await downloadCSV(dataset.url);
  const records: any[] = parseSync(csvContent, { columns: true, skip_empty_lines: true });

  console.log(`  Parsed ${records.length} regions`);

  const allData: any[] = [];

  for (const record of records) {
    const regionId = parseInt(record.RegionID, 10);
    const regionName = record.RegionName || '';
    if (isNaN(regionId) || !regionName) continue;

    const stateCode = record.State || record.StateName || null;
    const cbsaCode = record.CBSACode || null;

    const dateColumns = Object.keys(record).filter(key => /^\d{4}-\d{2}-\d{2}$/.test(key));

    for (const dateCol of dateColumns) {
      const value = parseFloat(record[dateCol]);
      if (isNaN(value)) continue;

      allData.push({
        region_id: regionId,
        region_name: regionName,
        state_code: stateCode,
        cbsa_code: cbsaCode,
        period_date: dateCol,
        metric_name: dataset.metricName,
        value: value
      });
    }
  }

  console.log(`  Total time series records: ${allData.length.toLocaleString()}`);

  // Batch upsert with optimized batch size
  const batchSize = 10000;
  let inserted = 0;

  for (let i = 0; i < allData.length; i += batchSize) {
    const batch = allData.slice(i, i + batchSize);

    const { error } = await supabase
      .from(dataset.table)
      .upsert(batch, { onConflict: 'region_id,period_date,metric_name' });

    if (error) {
      console.error(`  Error at batch ${i}: ${error.message}`);
    } else {
      inserted += batch.length;
    }

    // Progress update every 10000 records
    if (i % 10000 === 0 && i > 0) {
      console.log(`  Progress: ${inserted.toLocaleString()} / ${allData.length.toLocaleString()}`);
    }
  }

  console.log(`  COMPLETED: ${inserted.toLocaleString()} records`);
  return inserted;
}

async function main() {
  console.log('='.repeat(60));
  console.log('RETRY FAILED ZILLOW DATASETS');
  console.log('='.repeat(60));

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  let totalInserted = 0;

  for (const dataset of FAILED_DATASETS) {
    try {
      const count = await importDataset(supabase, dataset);
      totalInserted += count;
    } catch (error: any) {
      console.error(`  FAILED: ${error.message}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`TOTAL RECORDS INSERTED: ${totalInserted.toLocaleString()}`);
  console.log('='.repeat(60));
}

main().catch(console.error);
