#!/usr/bin/env npx tsx
/**
 * Import Metro Datasets to zillow_metro (long-format table)
 *
 * Imports all Metro-level Zillow datasets into the zillow_metro table
 * using the long-format schema (region_id, period_date, metric_name, value).
 *
 * Usage:
 *   npx tsx scripts/import-metro-datasets.ts
 */

import { join } from 'path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
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

// ============================================================================
// CBSA CROSSWALK
// ============================================================================

const cbsaCrosswalkMap: Map<string, string> = new Map();
const cbsaNameMap: Map<string, string> = new Map();
let crosswalkLoaded = false;

function normalizeMetroName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[,\-]/g, ' ')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractPrimaryMetroName(name: string): string {
  const parts = name.split(',');
  return parts[0].toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
}

async function loadCbsaCrosswalk(): Promise<void> {
  if (crosswalkLoaded) return;

  console.log('Loading CBSA crosswalk...');

  // Load from zillow_metro_crosswalk
  const { data, error } = await supabase
    .from('zillow_metro_crosswalk')
    .select('zillow_region_id, zillow_region_name, cbsa_code, cbsa_title');

  if (!error && data) {
    for (const row of data) {
      if (row.zillow_region_id && row.cbsa_code) {
        cbsaCrosswalkMap.set(String(row.zillow_region_id), row.cbsa_code);

        if (row.zillow_region_name) {
          const normalized = normalizeMetroName(row.zillow_region_name);
          if (!cbsaNameMap.has(normalized)) {
            cbsaNameMap.set(normalized, row.cbsa_code);
          }
          const primary = extractPrimaryMetroName(row.zillow_region_name);
          if (!cbsaNameMap.has(primary)) {
            cbsaNameMap.set(primary, row.cbsa_code);
          }
        }

        if (row.cbsa_title) {
          const normalized = normalizeMetroName(row.cbsa_title);
          if (!cbsaNameMap.has(normalized)) {
            cbsaNameMap.set(normalized, row.cbsa_code);
          }
          const primary = extractPrimaryMetroName(row.cbsa_title);
          if (!cbsaNameMap.has(primary)) {
            cbsaNameMap.set(primary, row.cbsa_code);
          }
        }
      }
    }
  }

  // Load from tiger_cbsa for fallback
  const { data: tigerData, error: tigerError } = await supabase
    .from('tiger_cbsa')
    .select('geoid, name');

  if (!tigerError && tigerData) {
    for (const row of tigerData) {
      if (row.geoid && row.name) {
        const normalized = normalizeMetroName(row.name);
        if (!cbsaNameMap.has(normalized)) {
          cbsaNameMap.set(normalized, row.geoid);
        }
        const primary = extractPrimaryMetroName(row.name);
        if (!cbsaNameMap.has(primary)) {
          cbsaNameMap.set(primary, row.geoid);
        }
        // Split multi-city metros
        const namePart = row.name.split(',')[0];
        const cities = namePart.split('-').map((c: string) => c.toLowerCase().trim());
        for (const city of cities) {
          if (city && !cbsaNameMap.has(city)) {
            cbsaNameMap.set(city, row.geoid);
          }
        }
      }
    }
  }

  console.log(`Loaded ${cbsaCrosswalkMap.size} CBSA mappings by region_id`);
  console.log(`Loaded ${cbsaNameMap.size} CBSA mappings by name`);
  crosswalkLoaded = true;
}

function lookupCbsaCode(regionId: number, regionName: string): string | null {
  const byId = cbsaCrosswalkMap.get(String(regionId));
  if (byId) return byId;

  if (regionName) {
    const byNormalized = cbsaNameMap.get(normalizeMetroName(regionName));
    if (byNormalized) return byNormalized;

    const byPrimary = cbsaNameMap.get(extractPrimaryMetroName(regionName));
    if (byPrimary) return byPrimary;
  }

  return null;
}

// ============================================================================
// METRIC NAME MAPPING
// ============================================================================

function getMetricName(datasetType: string): string {
  const metricMap: Record<string, string> = {
    'zhvi': 'zhvi',
    'zori': 'zori',
    'zori_sfr': 'zori_sfr',
    'zori_mfr': 'zori_mfr',
    'zordi': 'zordi',
    'invt_fs': 'inventory',
    'new_listings': 'new_listings',
    'new_pending': 'pending_sales',
    'mlp': 'list_price',
    'sales_count_now': 'sales_count',
    'median_sale_price': 'sale_price',
    'mean_sale_price': 'mean_sale_price',
    'median_sale_to_list': 'sale_to_list',
    'mean_sale_to_list_ratio': 'sale_to_list',
    'mean_doz_pending': 'days_to_pending',
    'mean_doz_close': 'days_to_close',
    'median_days_to_close': 'days_to_close',
    'perc_listings_price_cut': 'price_cut_share',
    'med_listings_price_cut_amt': 'price_cut_amt',
    'med_listings_price_cut_perc': 'price_cut_pct',
    'market_temp_index': 'market_heat',
    'new_con_sales_count_raw': 'new_con_sales',
    'new_con_median_sale_price': 'new_con_price',
    'new_con_median_sale_price_raw': 'new_con_price',
    'new_con_median_sale_price_per_sqft': 'new_con_price_sqft',
    'new_homeowner_income_needed': 'homeowner_income',
    'new_renter_income_needed': 'renter_income',
    'affordable_home_price': 'affordable_price',
    'affordable_price': 'affordable_price',
    'years_to_save': 'years_to_save',
    'new_homeowner_affordability': 'homeowner_afford',
    'new_renter_affordability': 'renter_afford',
    'total_transaction_value': 'transaction_value',
    'median_list_price': 'list_price'
  };
  return metricMap[datasetType] || datasetType;
}

// ============================================================================
// DOWNLOAD
// ============================================================================

async function downloadCSV(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Download failed: ${response.status}`);
      return null;
    }
    return await response.text();
  } catch (error: any) {
    console.error(`Download error: ${error.message}`);
    return null;
  }
}

// ============================================================================
// IMPORT LOGIC
// ============================================================================

interface ImportResult {
  recordsInserted: number;
  errors: number;
}

async function importDataset(
  datasetConfig: { id: string; url: string; datasetType: string; description: string }
): Promise<ImportResult> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Importing: ${datasetConfig.description}`);
  console.log(`Dataset: ${datasetConfig.datasetType}`);

  // Download
  console.log('  Downloading...');
  const csvContent = await downloadCSV(datasetConfig.url);
  if (!csvContent) {
    return { recordsInserted: 0, errors: 1 };
  }
  console.log(`  Downloaded ${(csvContent.length / 1024).toFixed(1)} KB`);

  // Parse
  const records: any[] = parseSync(csvContent, {
    columns: true,
    skip_empty_lines: true
  });
  console.log(`  Parsed ${records.length} rows`);

  // Filter to Metro only (msa type, not United States)
  const metroRecords = records.filter(r =>
    r.RegionType === 'msa' &&
    r.RegionID !== '102001' &&
    r.RegionName !== 'United States'
  );
  console.log(`  Filtered to ${metroRecords.length} metro records`);

  if (metroRecords.length === 0) {
    console.log('  No metro records found');
    return { recordsInserted: 0, errors: 0 };
  }

  // Build time series records
  const metricName = getMetricName(datasetConfig.datasetType);
  const allRecords: any[] = [];
  const allowZeroAndNegative = datasetConfig.datasetType === 'market_temp_index';

  for (const record of metroRecords) {
    const regionId = parseInt(record.RegionID, 10);
    const regionName = record.RegionName || '';
    const stateCode = record.StateName?.length === 2 ? record.StateName : null;
    const cbsaCode = lookupCbsaCode(regionId, regionName);

    if (isNaN(regionId) || !regionName) continue;

    // Find date columns
    const dateColumns = Object.keys(record).filter(key => /^\d{4}-\d{2}-\d{2}$/.test(key));

    for (const dateCol of dateColumns) {
      const value = parseFloat(record[dateCol]);
      if (isNaN(value)) continue;
      if (!allowZeroAndNegative && value === 0) continue;

      allRecords.push({
        region_id: regionId,
        region_name: regionName,
        state_code: stateCode,
        cbsa_code: cbsaCode,
        period_date: dateCol,
        metric_name: metricName,
        value: value
      });
    }
  }

  console.log(`  Built ${allRecords.length.toLocaleString()} time series records`);

  if (allRecords.length === 0) {
    return { recordsInserted: 0, errors: 0 };
  }

  // Insert in batches
  const batchSize = 500;
  let inserted = 0;
  let errors = 0;

  for (let i = 0; i < allRecords.length; i += batchSize) {
    const batch = allRecords.slice(i, i + batchSize);

    let retries = 0;
    const maxRetries = 3;
    let success = false;

    while (!success && retries < maxRetries) {
      try {
        const { error } = await supabase
          .from('zillow_metro')
          .upsert(batch, { onConflict: 'region_id,period_date,metric_name' });

        if (error) {
          throw new Error(error.message);
        }
        success = true;
        inserted += batch.length;
      } catch (err: any) {
        retries++;
        if (retries >= maxRetries) {
          console.error(`  Batch error at ${i}: ${err.message}`);
          errors++;
        } else {
          await new Promise(resolve => setTimeout(resolve, 1000 * retries));
        }
      }
    }

    // Progress
    const progress = Math.round(((i + batch.length) / allRecords.length) * 100);
    process.stdout.write(`\r  Progress: ${progress}% (${inserted.toLocaleString()} records)`);
  }
  console.log(); // newline

  console.log(`  Inserted: ${inserted.toLocaleString()} records`);
  return { recordsInserted: inserted, errors };
}

// ============================================================================
// DATASET CONFIGURATION
// ============================================================================

const ZILLOW_CSV_BASE = 'https://files.zillowstatic.com/research/public_csvs';

const METRO_DATASETS = [
  // ZHVI
  {
    id: 'zhvi-metro',
    url: `${ZILLOW_CSV_BASE}/zhvi/Metro_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv`,
    datasetType: 'zhvi',
    description: 'ZHVI - Home Values'
  },
  // ZORI - All (SFR + Condo + MFR)
  {
    id: 'zori-metro',
    url: `${ZILLOW_CSV_BASE}/zori/Metro_zori_uc_sfrcondomfr_sm_sa_month.csv`,
    datasetType: 'zori',
    description: 'ZORI - Rental Index (All)'
  },
  // ZORI - Single Family Only
  {
    id: 'zori-sfr-metro',
    url: `${ZILLOW_CSV_BASE}/zori/Metro_zori_uc_sfr_sm_month.csv`,
    datasetType: 'zori_sfr',
    description: 'ZORI - Single Family Rentals'
  },
  // ZORI - Multifamily Only
  {
    id: 'zori-mfr-metro',
    url: `${ZILLOW_CSV_BASE}/zori/Metro_zori_uc_mfr_sm_month.csv`,
    datasetType: 'zori_mfr',
    description: 'ZORI - Multifamily Rentals'
  },
  // Inventory
  {
    id: 'inventory-metro',
    url: `${ZILLOW_CSV_BASE}/invt_fs/Metro_invt_fs_uc_sfrcondo_sm_month.csv`,
    datasetType: 'invt_fs',
    description: 'For-Sale Inventory'
  },
  // Sales Count
  {
    id: 'sales-count-metro',
    url: `${ZILLOW_CSV_BASE}/sales_count_now/Metro_sales_count_now_uc_sfrcondo_month.csv`,
    datasetType: 'sales_count_now',
    description: 'Sales Count Nowcast'
  },
  // Median Sale Price
  {
    id: 'sale-price-metro',
    url: `${ZILLOW_CSV_BASE}/median_sale_price/Metro_median_sale_price_uc_sfrcondo_month.csv`,
    datasetType: 'median_sale_price',
    description: 'Median Sale Price'
  },
  // Days to Pending
  {
    id: 'days-pending-metro',
    url: `${ZILLOW_CSV_BASE}/mean_doz_pending/Metro_mean_doz_pending_uc_sfrcondo_sm_month.csv`,
    datasetType: 'mean_doz_pending',
    description: 'Mean Days to Pending'
  },
  // Market Heat Index
  {
    id: 'market-heat-metro',
    url: `${ZILLOW_CSV_BASE}/market_temp_index/Metro_market_temp_index_uc_sfrcondo_month.csv`,
    datasetType: 'market_temp_index',
    description: 'Market Heat Index'
  },
  // New Construction Sales Count
  {
    id: 'new-con-sales-metro',
    url: `${ZILLOW_CSV_BASE}/new_con_sales_count_raw/Metro_new_con_sales_count_raw_uc_sfrcondo_month.csv`,
    datasetType: 'new_con_sales_count_raw',
    description: 'New Construction Sales Count'
  },
  // New Construction Sale Price
  {
    id: 'new-con-price-metro',
    url: `${ZILLOW_CSV_BASE}/new_con_median_sale_price_raw/Metro_new_con_median_sale_price_raw_uc_sfrcondo_month.csv`,
    datasetType: 'new_con_median_sale_price',
    description: 'New Construction Sale Price'
  },
  // New Listings
  {
    id: 'new-listings-metro',
    url: `${ZILLOW_CSV_BASE}/new_listings/Metro_new_listings_uc_sfrcondo_sm_month.csv`,
    datasetType: 'new_listings',
    description: 'New Listings'
  },
  // Median List Price
  {
    id: 'list-price-metro',
    url: `${ZILLOW_CSV_BASE}/mlp/Metro_mlp_uc_sfrcondo_sm_month.csv`,
    datasetType: 'mlp',
    description: 'Median List Price'
  },
  // Sale-to-List Ratio
  {
    id: 'sale-to-list-metro',
    url: `${ZILLOW_CSV_BASE}/median_sale_to_list/Metro_median_sale_to_list_uc_sfrcondo_sm_month.csv`,
    datasetType: 'median_sale_to_list',
    description: 'Sale-to-List Ratio'
  },
  // Days to Close
  {
    id: 'days-close-metro',
    url: `${ZILLOW_CSV_BASE}/median_days_to_close/Metro_median_days_to_close_uc_sfrcondo_sm_month.csv`,
    datasetType: 'median_days_to_close',
    description: 'Median Days to Close'
  },
  // Price Cut Share
  {
    id: 'price-cut-share-metro',
    url: `${ZILLOW_CSV_BASE}/perc_listings_price_cut/Metro_perc_listings_price_cut_uc_sfrcondo_sm_month.csv`,
    datasetType: 'perc_listings_price_cut',
    description: 'Price Cut Share'
  },
  // Affordability - Homeowner Income Needed
  {
    id: 'afford-homeowner-income-metro',
    url: `${ZILLOW_CSV_BASE}/new_homeowner_income_needed/Metro_new_homeowner_income_needed_downpayment_0.20_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv`,
    datasetType: 'new_homeowner_income_needed',
    description: 'Homeowner Income Needed'
  },
  // Affordability - Renter Income Needed
  {
    id: 'afford-renter-income-metro',
    url: `${ZILLOW_CSV_BASE}/new_renter_income_needed/Metro_new_renter_income_needed_uc_sfrcondomfr_sm_sa_month.csv`,
    datasetType: 'new_renter_income_needed',
    description: 'Renter Income Needed'
  },
  // Affordability - Affordable Home Price
  {
    id: 'afford-home-price-metro',
    url: `${ZILLOW_CSV_BASE}/affordable_price/Metro_affordable_price_downpayment_0.20_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv`,
    datasetType: 'affordable_home_price',
    description: 'Affordable Home Price'
  },
  // Affordability - Years to Save
  {
    id: 'afford-years-save-metro',
    url: `${ZILLOW_CSV_BASE}/years_to_save/Metro_years_to_save_downpayment_0.20_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv`,
    datasetType: 'years_to_save',
    description: 'Years to Save for Down Payment'
  },
  // Affordability - Homeowner Affordability %
  {
    id: 'afford-homeowner-pct-metro',
    url: `${ZILLOW_CSV_BASE}/new_homeowner_affordability/Metro_new_homeowner_affordability_downpayment_0.20_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv`,
    datasetType: 'new_homeowner_affordability',
    description: 'Homeowner Affordability %'
  },
  // Affordability - Renter Affordability %
  {
    id: 'afford-renter-pct-metro',
    url: `${ZILLOW_CSV_BASE}/new_renter_affordability/Metro_new_renter_affordability_uc_sfrcondomfr_sm_sa_month.csv`,
    datasetType: 'new_renter_affordability',
    description: 'Renter Affordability %'
  }
];

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('='.repeat(60));
  console.log('ZILLOW METRO IMPORT');
  console.log('='.repeat(60));
  console.log(`Start Time: ${new Date().toISOString()}`);
  console.log(`Total datasets: ${METRO_DATASETS.length}`);
  console.log('');

  // Load CBSA crosswalk
  await loadCbsaCrosswalk();

  let totalInserted = 0;
  let totalErrors = 0;
  const startTime = Date.now();

  for (let i = 0; i < METRO_DATASETS.length; i++) {
    const dataset = METRO_DATASETS[i];
    console.log(`\n[${i + 1}/${METRO_DATASETS.length}]`);

    const result = await importDataset(dataset);
    totalInserted += result.recordsInserted;
    totalErrors += result.errors;

    // Small delay between datasets
    if (i < METRO_DATASETS.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
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

  // Refresh calculated metrics after import
  await refreshCalculatedMetrics(supabase);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
