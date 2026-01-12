#!/usr/bin/env npx tsx
/**
 * Import ALL Zillow Metro-level datasets
 *
 * Imports all metro datasets with CBSA codes from database crosswalk table.
 * Run with --force for full reimport.
 *
 * Usage:
 *   npx tsx scripts/zillow-import/import-all-metro.ts
 *   npx tsx scripts/zillow-import/import-all-metro.ts --force
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { join } from 'path';
import { parse } from 'csv-parse/sync';

config({ path: join(__dirname, '../../packages/backend/.env') });

// Metro datasets to import
const METRO_DATASETS = [
  {
    id: 'zhvi',
    name: 'ZHVI (Home Values)',
    url: 'https://files.zillowstatic.com/research/public_csvs/zhvi/Metro_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv',
    metricName: 'zhvi'
  },
  {
    id: 'zori',
    name: 'ZORI (Rents)',
    url: 'https://files.zillowstatic.com/research/public_csvs/zori/Metro_zori_uc_sfrcondomfr_sm_month.csv',
    metricName: 'zori'
  },
  {
    id: 'zori_sa',
    name: 'ZORI Seasonally Adjusted',
    url: 'https://files.zillowstatic.com/research/public_csvs/zori/Metro_zori_uc_sfrcondomfr_sm_sa_month.csv',
    metricName: 'zori_sa'
  },
  {
    id: 'inventory',
    name: 'For-Sale Inventory',
    url: 'https://files.zillowstatic.com/research/public_csvs/invt_fs/Metro_invt_fs_uc_sfrcondo_sm_month.csv',
    metricName: 'inventory'
  },
  {
    id: 'new_listings',
    name: 'New Listings',
    url: 'https://files.zillowstatic.com/research/public_csvs/new_listings/Metro_new_listings_uc_sfrcondo_sm_month.csv',
    metricName: 'new_listings'
  },
  {
    id: 'new_pending',
    name: 'Newly Pending Listings',
    url: 'https://files.zillowstatic.com/research/public_csvs/new_pending/Metro_new_pending_uc_sfrcondo_sm_month.csv',
    metricName: 'new_pending'
  },
  {
    id: 'median_list_price',
    name: 'Median List Price',
    url: 'https://files.zillowstatic.com/research/public_csvs/mlp/Metro_mlp_uc_sfrcondo_sm_month.csv',
    metricName: 'median_list_price'
  },
  {
    id: 'median_sale_price',
    name: 'Median Sale Price',
    url: 'https://files.zillowstatic.com/research/public_csvs/median_sale_price/Metro_median_sale_price_uc_sfrcondo_month.csv',
    metricName: 'median_sale_price'
  },
  {
    id: 'sales_count',
    name: 'Sales Count',
    url: 'https://files.zillowstatic.com/research/public_csvs/sales_count_now/Metro_sales_count_now_uc_sfrcondo_month.csv',
    metricName: 'sales_count'
  },
  {
    id: 'sale_to_list',
    name: 'Sale-to-List Ratio',
    url: 'https://files.zillowstatic.com/research/public_csvs/median_sale_to_list/Metro_median_sale_to_list_uc_sfrcondo_sm_month.csv',
    metricName: 'sale_to_list'
  },
  {
    id: 'days_to_pending',
    name: 'Days to Pending',
    url: 'https://files.zillowstatic.com/research/public_csvs/mean_doz_pending/Metro_mean_doz_pending_uc_sfrcondo_sm_month.csv',
    metricName: 'days_to_pending'
  },
  {
    id: 'days_to_close',
    name: 'Days to Close',
    url: 'https://files.zillowstatic.com/research/public_csvs/median_days_to_close/Metro_median_days_to_close_uc_sfrcondo_sm_month.csv',
    metricName: 'days_to_close'
  },
  {
    id: 'price_cut_share',
    name: 'Price Cut Share',
    url: 'https://files.zillowstatic.com/research/public_csvs/perc_listings_price_cut/Metro_perc_listings_price_cut_uc_sfrcondo_sm_month.csv',
    metricName: 'price_cut_share'
  },
  {
    id: 'price_cut_amt',
    name: 'Median Price Cut Amount',
    url: 'https://files.zillowstatic.com/research/public_csvs/med_listings_price_cut_amt/Metro_med_listings_price_cut_amt_uc_sfrcondo_sm_month.csv',
    metricName: 'price_cut_amt'
  },
  {
    id: 'price_cut_pct',
    name: 'Median Price Cut Percent',
    url: 'https://files.zillowstatic.com/research/public_csvs/med_listings_price_cut_perc/Metro_med_listings_price_cut_perc_uc_sfrcondo_sm_month.csv',
    metricName: 'price_cut_pct'
  },
  {
    id: 'market_heat_index',
    name: 'Market Heat Index',
    url: 'https://files.zillowstatic.com/research/public_csvs/market_temp_index/Metro_market_temp_index_uc_sfrcondo_month.csv',
    metricName: 'market_heat_index'
  },
  {
    id: 'zordi',
    name: 'Renter Demand Index',
    url: 'https://files.zillowstatic.com/research/public_csvs/zordi/Metro_zordi_uc_sfrcondomfr_month.csv',
    metricName: 'zordi'
  },
  {
    id: 'zhvf_growth',
    name: 'Home Value Forecast Growth',
    url: 'https://files.zillowstatic.com/research/public_csvs/zhvf_growth/Metro_zhvf_growth_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv',
    metricName: 'zhvf_growth'
  },
  {
    id: 'homeowner_income_needed',
    name: 'Homeowner Income Needed',
    url: 'https://files.zillowstatic.com/research/public_csvs/new_homeowner_income_needed/Metro_new_homeowner_income_needed_downpayment_0.20_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv',
    metricName: 'homeowner_income_needed'
  },
  {
    id: 'renter_income_needed',
    name: 'Renter Income Needed',
    url: 'https://files.zillowstatic.com/research/public_csvs/new_renter_income_needed/Metro_new_renter_income_needed_uc_sfrcondomfr_sm_sa_month.csv',
    metricName: 'renter_income_needed'
  },
  {
    id: 'affordable_home_price',
    name: 'Affordable Home Price',
    url: 'https://files.zillowstatic.com/research/public_csvs/affordable_price/Metro_affordable_price_downpayment_0.20_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv',
    metricName: 'affordable_home_price'
  },
  {
    id: 'years_to_save',
    name: 'Years to Save',
    url: 'https://files.zillowstatic.com/research/public_csvs/years_to_save/Metro_years_to_save_downpayment_0.20_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv',
    metricName: 'years_to_save'
  },
  {
    id: 'new_homeowner_affordability',
    name: 'New Homeowner Affordability',
    url: 'https://files.zillowstatic.com/research/public_csvs/new_homeowner_affordability/Metro_new_homeowner_affordability_downpayment_0.20_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv',
    metricName: 'new_homeowner_affordability'
  },
  {
    id: 'new_renter_affordability',
    name: 'New Renter Affordability',
    url: 'https://files.zillowstatic.com/research/public_csvs/new_renter_affordability/Metro_new_renter_affordability_uc_sfrcondomfr_sm_sa_month.csv',
    metricName: 'new_renter_affordability'
  },
  {
    id: 'new_con_sales_count',
    name: 'New Construction Sales Count',
    url: 'https://files.zillowstatic.com/research/public_csvs/new_con_sales_count_raw/Metro_new_con_sales_count_raw_uc_sfrcondo_month.csv',
    metricName: 'new_con_sales_count'
  },
  {
    id: 'new_con_median_price',
    name: 'New Construction Median Price',
    url: 'https://files.zillowstatic.com/research/public_csvs/new_con_median_sale_price/Metro_new_con_median_sale_price_uc_sfrcondo_month.csv',
    metricName: 'new_con_median_price'
  },
  {
    id: 'new_con_median_price_per_sqft',
    name: 'New Construction Median Price Per Sqft',
    url: 'https://files.zillowstatic.com/research/public_csvs/new_con_median_sale_price_per_sqft/Metro_new_con_median_sale_price_per_sqft_uc_sfrcondo_month.csv',
    metricName: 'new_con_median_price_per_sqft'
  }
];

interface CbsaCrosswalkEntry {
  cbsaCode: string;
  cbsaName: string;
  cbsaType: string;
}

interface ZillowRecord {
  region_id: number;
  region_name: string;
  state_code: string | null;
  cbsa_code: string | null;
  period_date: string;
  metric_name: string;
  value: number;
}

class MetroDatasetImporter {
  private supabase: SupabaseClient;
  private cbsaCrosswalk: Map<number, CbsaCrosswalkEntry> = new Map();
  private batchSize: number;

  constructor(batchSize = 10000) {
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    this.batchSize = batchSize;
  }

  async loadCbsaCrosswalk(): Promise<void> {
    console.log('Loading CBSA crosswalk from database...');

    const { data, error } = await this.supabase
      .from('zillow_metro_crosswalk')
      .select('zillow_region_id, cbsa_code, cbsa_title, cbsa_type');

    if (error) {
      console.error('Error loading CBSA crosswalk:', error.message);
      return;
    }

    for (const record of data || []) {
      this.cbsaCrosswalk.set(record.zillow_region_id, {
        cbsaCode: record.cbsa_code,
        cbsaName: record.cbsa_title || '',
        cbsaType: record.cbsa_type || '',
      });
    }

    console.log(`Loaded ${this.cbsaCrosswalk.size} CBSA mappings from database\n`);
  }

  private extractDateColumns(record: any): string[] {
    return Object.keys(record).filter(key => {
      return /^\d{4}-\d{2}-\d{2}$/.test(key) || /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(key);
    });
  }

  private getCbsaCode(regionId: number): string | null {
    const entry = this.cbsaCrosswalk.get(regionId);
    return entry ? entry.cbsaCode : null;
  }

  async importDataset(dataset: typeof METRO_DATASETS[0], forceFullImport: boolean): Promise<{
    success: boolean;
    recordsInserted: number;
    error?: string;
  }> {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Importing: ${dataset.name}`);
    console.log(`Metric: ${dataset.metricName}`);
    console.log('='.repeat(60));

    try {
      // Download CSV
      console.log('Downloading...');
      const response = await fetch(dataset.url);
      if (!response.ok) {
        return { success: false, recordsInserted: 0, error: `HTTP ${response.status}` };
      }
      const csvText = await response.text();
      console.log(`Downloaded ${(csvText.length / 1024 / 1024).toFixed(2)} MB`);

      // Parse CSV
      const rawRecords = parse(csvText, { columns: true, skip_empty_lines: true, relax_column_count: true });
      console.log(`Parsed ${rawRecords.length} rows`);

      // Get existing dates if not force import
      let existingDates = new Set<string>();
      if (!forceFullImport) {
        const { data } = await this.supabase
          .from('zillow_metro')
          .select('period_date')
          .eq('metric_name', dataset.metricName)
          .order('period_date', { ascending: false })
          .limit(100);
        existingDates = new Set(data?.map(d => d.period_date) || []);
      }

      // Transform records
      const records: ZillowRecord[] = [];
      const dateColumns = this.extractDateColumns(rawRecords[0]);
      const latestExisting = [...existingDates].sort().pop();

      let withCbsa = 0;
      let withoutCbsa = 0;

      for (const raw of rawRecords) {
        const regionId = parseInt(raw.RegionID, 10);
        if (isNaN(regionId)) continue;

        const regionName = raw.RegionName || '';
        const stateCode = raw.StateName || raw.State || null;
        const cbsaCode = this.getCbsaCode(regionId);

        if (cbsaCode) withCbsa++;
        else withoutCbsa++;

        for (const dateCol of dateColumns) {
          // Skip old dates if incremental
          if (latestExisting && dateCol <= latestExisting) continue;

          const value = parseFloat(raw[dateCol]);
          if (isNaN(value)) continue;

          let periodDate = dateCol;
          if (dateCol.includes('/')) {
            const [month, day, year] = dateCol.split('/');
            periodDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
          }

          records.push({
            region_id: regionId,
            region_name: regionName,
            state_code: stateCode,
            cbsa_code: cbsaCode,
            period_date: periodDate,
            metric_name: dataset.metricName,
            value,
          });
        }
      }

      console.log(`Transformed ${records.length} records`);
      console.log(`  With CBSA: ${withCbsa} metros, Without: ${withoutCbsa}`);

      if (records.length === 0) {
        console.log('No new records to import');
        return { success: true, recordsInserted: 0 };
      }

      // Insert in batches
      let inserted = 0;
      for (let i = 0; i < records.length; i += this.batchSize) {
        const batch = records.slice(i, i + this.batchSize);
        const { error } = await this.supabase
          .from('zillow_metro')
          .upsert(batch, { onConflict: 'region_id,period_date,metric_name', ignoreDuplicates: false });

        if (error) {
          console.error(`Batch error: ${error.message}`);
          continue;
        }
        inserted += batch.length;
        process.stdout.write(`\rProgress: ${Math.round((i + batch.length) / records.length * 100)}%`);
      }
      console.log();

      return { success: true, recordsInserted: inserted };
    } catch (error: any) {
      return { success: false, recordsInserted: 0, error: error.message };
    }
  }

  async importAll(forceFullImport: boolean): Promise<void> {
    console.log('='.repeat(60));
    console.log('ZILLOW METRO DATASETS IMPORT');
    console.log(`Mode: ${forceFullImport ? 'Full Import' : 'Incremental Update'}`);
    console.log(`Datasets: ${METRO_DATASETS.length}`);
    console.log(`Date: ${new Date().toISOString()}`);
    console.log('='.repeat(60));

    // Load crosswalk from database
    await this.loadCbsaCrosswalk();

    const results: { name: string; success: boolean; records: number; error?: string }[] = [];

    for (const dataset of METRO_DATASETS) {
      const result = await this.importDataset(dataset, forceFullImport);
      results.push({
        name: dataset.name,
        success: result.success,
        records: result.recordsInserted,
        error: result.error
      });
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('IMPORT SUMMARY');
    console.log('='.repeat(60));

    let totalRecords = 0;
    let successCount = 0;

    for (const r of results) {
      const status = r.success ? 'OK' : 'FAIL';
      console.log(`[${status}] ${r.name}: ${r.records.toLocaleString()} records${r.error ? ` (${r.error})` : ''}`);
      if (r.success) {
        successCount++;
        totalRecords += r.records;
      }
    }

    console.log('='.repeat(60));
    console.log(`Total: ${successCount}/${METRO_DATASETS.length} datasets, ${totalRecords.toLocaleString()} records`);
  }
}

async function main() {
  const forceFullImport = process.argv.includes('--force');
  const importer = new MetroDatasetImporter(10000);
  await importer.importAll(forceFullImport);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
