/**
 * Ingest Remaining Zillow Datasets
 *
 * Processes only the incomplete datasets with optimized batch size of 10000
 */

import { writeFileSync } from 'fs';
import { join } from 'path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { parse as parseSync } from 'csv-parse/sync';

config({ path: join(__dirname, '../.env.local') });
config({ path: join(__dirname, '../packages/frontend/.env.local') });
config({ path: join(__dirname, '../packages/backend/.env') });

const STATUS_FILE = join(__dirname, '../zillow-import-status.txt');
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

// Remaining datasets to process
const REMAINING_DATASETS = [
  {
    id: 'zhvi-city-all-homes-sm-sa',
    url: 'https://files.zillowstatic.com/research/public_csvs/zhvi/City_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv',
    metricName: 'zhvi',
    table: 'zillow_city',
    geography: 'City'
  },
  {
    id: 'zori-city-all-homes-sm',
    url: 'https://files.zillowstatic.com/research/public_csvs/zori/City_zori_uc_sfrcondomfr_sm_month.csv',
    metricName: 'zori',
    table: 'zillow_city',
    geography: 'City'
  },
  {
    id: 'zhvi-zip-all-homes-sm-sa',
    url: 'https://files.zillowstatic.com/research/public_csvs/zhvi/Zip_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv',
    metricName: 'zhvi',
    table: 'zillow_zip',
    geography: 'ZIP'
  },
  {
    id: 'zori-zip-all-homes-sm',
    url: 'https://files.zillowstatic.com/research/public_csvs/zori/Zip_zori_uc_sfrcondomfr_sm_month.csv',
    metricName: 'zori',
    table: 'zillow_zip',
    geography: 'ZIP'
  },
  {
    id: 'zhvf-zip-growth',
    url: 'https://files.zillowstatic.com/research/public_csvs/zhvf_growth/Zip_zhvf_growth_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv',
    metricName: 'zhvf',
    table: 'zillow_zip',
    geography: 'ZIP'
  },
  {
    id: 'new-construction-sale-price-metro',
    url: 'https://files.zillowstatic.com/research/public_csvs/new_con_median_sale_price/Metro_new_con_median_sale_price_uc_sfrcondo_month.csv?t=1768221332',
    metricName: 'new_con_price',
    table: 'zillow_metro',
    geography: 'Metro'
  },
  {
    id: 'affordability-home-price-metro',
    url: 'https://files.zillowstatic.com/research/public_csvs/affordable_price/Metro_affordable_price_downpayment_0.20_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv?t=1768221332',
    metricName: 'affordable_price',
    table: 'zillow_metro',
    geography: 'Metro'
  }
];

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
  "District of Columbia": "DC"
};

interface DatasetStatus {
  id: string;
  status: 'pending' | 'downloading' | 'importing' | 'completed' | 'failed';
  records: number;
  startTime?: number;
  error?: string;
}

const statuses: Map<string, DatasetStatus> = new Map();
let startTime = Date.now();

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

function writeStatus() {
  const now = Date.now();
  const lines: string[] = [
    '='.repeat(70),
    `REMAINING ZILLOW IMPORT - ${new Date().toISOString()}`,
    `Elapsed: ${formatDuration(now - startTime)}`,
    '='.repeat(70),
    ''
  ];

  for (const [id, s] of statuses) {
    const icon = s.status === 'completed' ? '[OK]' : s.status === 'failed' ? '[FAIL]' : s.status === 'importing' ? '[>>>]' : '[  ]';
    const duration = s.startTime ? formatDuration(now - s.startTime) : '';
    lines.push(`${icon} ${id}: ${s.records.toLocaleString()} records ${duration}`);
    if (s.error) lines.push(`    Error: ${s.error}`);
  }

  lines.push('');
  lines.push('='.repeat(70));

  const output = lines.join('\n');
  writeFileSync(STATUS_FILE, output);
  console.log('\n' + output);
}

async function downloadCSV(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  return response.text();
}

async function importDataset(
  supabase: SupabaseClient,
  dataset: typeof REMAINING_DATASETS[0]
): Promise<number> {
  const status = statuses.get(dataset.id)!;
  status.status = 'downloading';
  status.startTime = Date.now();
  writeStatus();

  console.log(`\nDownloading ${dataset.id}...`);
  const csvContent = await downloadCSV(dataset.url);

  status.status = 'importing';
  writeStatus();

  const records: any[] = parseSync(csvContent, { columns: true, skip_empty_lines: true });
  console.log(`  Parsed ${records.length} regions`);

  const allData: any[] = [];

  for (const record of records) {
    const regionId = parseInt(record.RegionID, 10);
    const regionName = record.RegionName || '';
    if (isNaN(regionId) || !regionName) continue;

    let stateCode = record.State || record.StateName || null;
    if (stateCode && stateCode.length > 2) {
      stateCode = STATE_NAME_TO_CODE[stateCode] || null;
    }

    const cbsaCode = record.CBSACode || null;
    const dateColumns = Object.keys(record).filter(key => /^\d{4}-\d{2}-\d{2}$/.test(key));

    for (const dateCol of dateColumns) {
      const value = parseFloat(record[dateCol]);
      if (isNaN(value)) continue;

      const row: any = {
        region_id: regionId,
        region_name: regionName,
        state_code: stateCode,
        period_date: dateCol,
        metric_name: dataset.metricName,
        value: value
      };

      if (dataset.geography === 'Metro' && cbsaCode) {
        row.cbsa_code = cbsaCode;
      }

      allData.push(row);
    }
  }

  console.log(`  Total records: ${allData.length.toLocaleString()}`);

  // Batch upsert with 10000 batch size
  const batchSize = 10000;
  let inserted = 0;

  for (let i = 0; i < allData.length; i += batchSize) {
    const batch = allData.slice(i, i + batchSize);

    let retries = 0;
    while (retries < 3) {
      const { error } = await supabase
        .from(dataset.table)
        .upsert(batch, { onConflict: 'region_id,period_date,metric_name' });

      if (!error) {
        inserted += batch.length;
        status.records = inserted;
        break;
      } else {
        retries++;
        if (retries >= 3) {
          console.error(`  Error at batch ${i}: ${error.message}`);
        } else {
          await new Promise(r => setTimeout(r, 1000 * retries));
        }
      }
    }

    // Progress update every 50000 records
    if (inserted % 50000 === 0 && inserted > 0) {
      console.log(`  Progress: ${inserted.toLocaleString()} / ${allData.length.toLocaleString()}`);
      writeStatus();
    }
  }

  status.status = 'completed';
  status.records = inserted;
  writeStatus();

  console.log(`  COMPLETED: ${inserted.toLocaleString()} records`);
  return inserted;
}

async function main() {
  console.log('='.repeat(70));
  console.log('INGEST REMAINING ZILLOW DATASETS (10K BATCH SIZE)');
  console.log('='.repeat(70));
  console.log(`Datasets to process: ${REMAINING_DATASETS.length}`);
  console.log('');

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  // Initialize statuses
  for (const ds of REMAINING_DATASETS) {
    statuses.set(ds.id, { id: ds.id, status: 'pending', records: 0 });
  }

  writeStatus();

  let totalInserted = 0;
  let completed = 0;
  let failed = 0;

  for (const dataset of REMAINING_DATASETS) {
    try {
      const count = await importDataset(supabase, dataset);
      totalInserted += count;
      completed++;
    } catch (error: any) {
      const status = statuses.get(dataset.id)!;
      status.status = 'failed';
      status.error = error.message;
      writeStatus();
      console.error(`  FAILED: ${error.message}`);
      failed++;
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('FINAL SUMMARY');
  console.log('='.repeat(70));
  console.log(`Total time: ${formatDuration(Date.now() - startTime)}`);
  console.log(`Completed: ${completed}/${REMAINING_DATASETS.length}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total records inserted: ${totalInserted.toLocaleString()}`);
  console.log('='.repeat(70));

  writeStatus();
}

main().catch(console.error);
