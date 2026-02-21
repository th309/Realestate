/**
 * Test Pipeline Reporting End-to-End
 *
 * Downloads a small real Zillow dataset (ZHVI state-level), imports it,
 * and writes detail rows to data_ingestion_details to verify the full
 * pipeline reporting flow.
 *
 * Usage:
 *   npx tsx scripts/test-pipeline-reporting.ts
 */

import { join } from 'path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { parse as parseSync } from 'csv-parse/sync';
import { logIngestionDetail } from './utils/log-ingestion-detail';

// Load environment variables
config({ path: join(__dirname, '../packages/backend/.env.local') });
config({ path: join(__dirname, '../packages/backend/.env') });
config({ path: join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Small state-level datasets for quick testing
const TEST_DATASETS = [
  {
    id: 'zhvi-state',
    url: 'https://files.zillowstatic.com/research/public_csvs/zhvi/State_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv',
    metricName: 'zhvi',
    geography: 'state',
    description: 'ZHVI (Home Value Index) - State',
  },
  {
    id: 'zori-state',
    url: 'https://files.zillowstatic.com/research/public_csvs/zori/State_zori_uc_sfrcondomfr_sm_sa_month.csv',
    metricName: 'zori',
    geography: 'state',
    description: 'ZORI (Rent Index) - State',
  },
  {
    id: 'inventory-state',
    url: 'https://files.zillowstatic.com/research/public_csvs/invt_fs/State_invt_fs_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv',
    metricName: 'inventory',
    geography: 'state',
    description: 'For-Sale Inventory - State',
  },
];

const STATE_NAME_TO_CODE: Record<string, string> = {
  Alabama: 'AL', Alaska: 'AK', Arizona: 'AZ', Arkansas: 'AR', California: 'CA',
  Colorado: 'CO', Connecticut: 'CT', Delaware: 'DE', Florida: 'FL', Georgia: 'GA',
  Hawaii: 'HI', Idaho: 'ID', Illinois: 'IL', Indiana: 'IN', Iowa: 'IA',
  Kansas: 'KS', Kentucky: 'KY', Louisiana: 'LA', Maine: 'ME', Maryland: 'MD',
  Massachusetts: 'MA', Michigan: 'MI', Minnesota: 'MN', Mississippi: 'MS', Missouri: 'MO',
  Montana: 'MT', Nebraska: 'NE', Nevada: 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ',
  'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND', Ohio: 'OH',
  Oklahoma: 'OK', Oregon: 'OR', Pennsylvania: 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
  'South Dakota': 'SD', Tennessee: 'TN', Texas: 'TX', Utah: 'UT', Vermont: 'VT',
  Virginia: 'VA', Washington: 'WA', 'West Virginia': 'WV', Wisconsin: 'WI', Wyoming: 'WY',
  'District of Columbia': 'DC',
};

async function importDataset(
  runId: string,
  dataset: typeof TEST_DATASETS[0],
): Promise<void> {
  const startMs = Date.now();
  console.log(`\n  [${dataset.id}] Downloading...`);

  let csvContent: string;
  try {
    const res = await fetch(dataset.url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    csvContent = await res.text();
  } catch (err: any) {
    console.log(`  [${dataset.id}] Download FAILED: ${err.message}`);
    await logIngestionDetail(supabase, runId, dataset.metricName, dataset.geography, 'failed', 0, 0, Date.now() - startMs, err.message);
    return;
  }

  console.log(`  [${dataset.id}] Parsing CSV...`);
  const records: any[] = parseSync(csvContent, { columns: true, skip_empty_lines: true });

  // Build time-series rows (only last 12 months to keep it fast)
  const rows: any[] = [];
  for (const record of records) {
    const regionId = parseInt(record.RegionID, 10);
    const regionName = record.RegionName || '';
    if (isNaN(regionId) || !regionName) continue;

    const stateCode = record.State || STATE_NAME_TO_CODE[regionName] || null;
    const dateColumns = Object.keys(record)
      .filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k))
      .sort()
      .slice(-12); // last 12 months only

    for (const dateCol of dateColumns) {
      const value = parseFloat(record[dateCol]);
      if (isNaN(value)) continue;
      rows.push({
        region_id: regionId,
        region_name: regionName,
        state_code: stateCode,
        period_date: dateCol,
        metric_name: dataset.metricName,
        value,
      });
    }
  }

  // Upsert in batches
  console.log(`  [${dataset.id}] Upserting ${rows.length} rows...`);
  let inserted = 0;
  let failed = 0;
  const batchSize = 5000;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabase
      .from('zillow_state')
      .upsert(batch, { onConflict: 'region_id,period_date,metric_name' });

    if (error) {
      console.log(`  [${dataset.id}] Batch error: ${error.message}`);
      failed += batch.length;
    } else {
      inserted += batch.length;
    }
  }

  const durationMs = Date.now() - startMs;
  const status = failed === 0 ? 'success' : 'failed';
  console.log(`  [${dataset.id}] ${status.toUpperCase()}: ${inserted} inserted, ${failed} failed (${durationMs}ms)`);

  await logIngestionDetail(
    supabase, runId, dataset.metricName, dataset.geography,
    status, inserted, failed, durationMs,
    failed > 0 ? `${failed} rows failed` : undefined,
  );
}

async function main() {
  console.log('=== Pipeline Reporting E2E Test ===');
  console.log(`Datasets: ${TEST_DATASETS.map((d) => d.id).join(', ')}`);

  // Create parent ingestion log row
  const { data: logRow, error: logError } = await supabase
    .from('data_ingestion_log')
    .insert({
      source: 'zillow',
      table_name: 'zillow_state',
      status: 'running',
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (logError || !logRow) {
    console.error('Failed to create ingestion log row:', logError?.message);
    process.exit(1);
  }

  const runId = logRow.id;
  console.log(`Run ID: ${runId}`);

  const startTime = Date.now();

  // Process each dataset
  for (const dataset of TEST_DATASETS) {
    await importDataset(runId, dataset);
  }

  // Update parent log
  const totalDurationMs = Date.now() - startTime;
  await supabase
    .from('data_ingestion_log')
    .update({
      status: 'success',
      completed_at: new Date().toISOString(),
      duration_ms: totalDurationMs,
    })
    .eq('id', runId);

  console.log(`\n=== Done in ${(totalDurationMs / 1000).toFixed(1)}s ===`);
  console.log(`Run ID: ${runId}`);
  console.log('Check /admin/data Pipeline Runs tab and click this run to see the drill-down.');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
