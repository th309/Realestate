/**
 * Import Missing Zillow Datasets
 *
 * Imports only the datasets for tables that are currently empty.
 * This is faster than running the full import.
 *
 * Empty tables to populate:
 * - zillow_new_listings
 * - zillow_pending_listings
 * - zillow_median_list_price
 * - zillow_sale_to_list
 * - zillow_days_to_close
 * - zillow_price_cut_share
 * - zillow_price_cut_amt
 * - zillow_price_cut_pct
 *
 * Usage:
 *   npx tsx scripts/import-missing-zillow-datasets.ts
 */

import { mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import type { ImportResult, DatasetConfig } from './zillow-all-import/types';
import { createZillowImportClient, getTableName } from './zillow-all-import/db-client';
import { downloadDataset } from './zillow-all-import/download';
import { importCSV } from './zillow-all-import/csv-processor';

const DATA_DIR = join(__dirname, '../data/zillow');
if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

// Datasets that target the empty tables
const MISSING_DATASETS: DatasetConfig[] = [
  {
    id: 'new-listings-metro-sm-month',
    category: 'FOR-SALE LISTINGS',
    dataType: 'New Listings (Smooth, All Homes, Monthly)',
    geography: 'Metro',
    datasetType: 'new_listings',
    propertyType: 'sfrcondo',
    smoothing: 'sm',
    frequency: 'month',
    downloadUrl: 'https://files.zillowstatic.com/research/public_csvs/new_listings/Metro_new_listings_uc_sfrcondo_sm_month.csv',
    description: 'New Listings - Metro areas, all homes, smoothed, monthly'
  },
  {
    id: 'pending-listings-metro-sm-month',
    category: 'FOR-SALE LISTINGS',
    dataType: 'Newly Pending Listings (Smoothed, All Homes Monthly)',
    geography: 'Metro',
    datasetType: 'new_pending',
    propertyType: 'sfrcondo',
    smoothing: 'sm',
    frequency: 'month',
    downloadUrl: 'https://files.zillowstatic.com/research/public_csvs/new_pending/Metro_new_pending_uc_sfrcondo_sm_month.csv',
    description: 'Newly Pending Listings - Metro areas, all homes, smoothed, monthly'
  },
  {
    id: 'median-list-price-metro-sm-month',
    category: 'FOR-SALE LISTINGS',
    dataType: 'Median List Price (Smoothed, All Homes, Monthly)',
    geography: 'Metro',
    datasetType: 'mlp',
    propertyType: 'sfrcondo',
    smoothing: 'sm',
    frequency: 'month',
    downloadUrl: 'https://files.zillowstatic.com/research/public_csvs/mlp/Metro_mlp_uc_sfrcondo_sm_month.csv',
    description: 'Median List Price - Metro areas, all homes, smoothed, monthly'
  },
  {
    id: 'sale-to-list-metro-sm-month',
    category: 'SALES',
    dataType: 'Median Sale-to-List Ratio (Smooth, All Homes, Monthly)',
    geography: 'Metro',
    datasetType: 'median_sale_to_list',
    propertyType: 'sfrcondo',
    smoothing: 'sm',
    frequency: 'month',
    downloadUrl: 'https://files.zillowstatic.com/research/public_csvs/median_sale_to_list/Metro_median_sale_to_list_uc_sfrcondo_sm_month.csv',
    description: 'Median Sale-to-List Ratio - Metro areas, all homes, smoothed, monthly'
  },
  {
    id: 'days-to-close-metro-sm-month',
    category: 'DAYS ON MARKET AND PRICE CUTS',
    dataType: 'Median Days to Close (Smooth, All Homes, Monthly)',
    geography: 'Metro',
    datasetType: 'median_days_to_close',
    propertyType: 'sfrcondo',
    smoothing: 'sm',
    frequency: 'month',
    downloadUrl: 'https://files.zillowstatic.com/research/public_csvs/median_days_to_close/Metro_median_days_to_close_uc_sfrcondo_sm_month.csv',
    description: 'Median Days to Close - Metro areas, all homes, smoothed, monthly'
  },
  {
    id: 'price-cut-share-metro-sm-month',
    category: 'DAYS ON MARKET AND PRICE CUTS',
    dataType: 'Share of Listings with a Price Cut (Smooth, All Homes, Monthly)',
    geography: 'Metro',
    datasetType: 'perc_listings_price_cut',
    propertyType: 'sfrcondo',
    smoothing: 'sm',
    frequency: 'month',
    downloadUrl: 'https://files.zillowstatic.com/research/public_csvs/perc_listings_price_cut/Metro_perc_listings_price_cut_uc_sfrcondo_sm_month.csv',
    description: 'Share of Listings with Price Cut - Metro areas, all homes, smoothed, monthly'
  },
  {
    id: 'price-cut-amt-metro-sm-month',
    category: 'DAYS ON MARKET AND PRICE CUTS',
    dataType: 'Median Price Cut ($, Smoothed, All Homes, Monthly)',
    geography: 'Metro',
    datasetType: 'med_listings_price_cut_amt',
    propertyType: 'sfrcondo',
    smoothing: 'sm',
    frequency: 'month',
    downloadUrl: 'https://files.zillowstatic.com/research/public_csvs/med_listings_price_cut_amt/Metro_med_listings_price_cut_amt_uc_sfrcondo_sm_month.csv',
    description: 'Median Price Cut Amount ($) - Metro areas, all homes, smoothed, monthly'
  },
  {
    id: 'price-cut-pct-metro-sm-month',
    category: 'DAYS ON MARKET AND PRICE CUTS',
    dataType: 'Median Price Cut (%, Smoothed, All Homes, Monthly)',
    geography: 'Metro',
    datasetType: 'med_listings_price_cut_perc',
    propertyType: 'sfrcondo',
    smoothing: 'sm',
    frequency: 'month',
    downloadUrl: 'https://files.zillowstatic.com/research/public_csvs/med_listings_price_cut_perc/Metro_med_listings_price_cut_perc_uc_sfrcondo_sm_month.csv',
    description: 'Median Price Cut Percent (%) - Metro areas, all homes, smoothed, monthly'
  }
];

async function processDataset(supabase: any, dataset: DatasetConfig): Promise<ImportResult> {
  console.log(`\n📊 Processing: ${dataset.id}`);
  console.log(`   Description: ${dataset.description}`);

  const tableName = getTableName(dataset.datasetType);
  console.log(`   Target table: ${tableName}`);
  console.log(`   Download URL: ${dataset.downloadUrl}`);

  // Download
  console.log(`   ⬇️  Downloading...`);
  const downloadResult = await downloadDataset(dataset);
  if (!downloadResult.success) {
    console.error(`   ❌ Download failed: ${downloadResult.error}`);
    return {
      datasetId: dataset.id,
      success: false,
      marketsCreated: 0,
      timeSeriesInserted: 0,
      errors: 1,
      errorMessage: downloadResult.error
    };
  }
  console.log(`   ✅ Downloaded ${(downloadResult.csvContent?.length || 0).toLocaleString()} bytes`);

  // Import
  console.log(`   🔄 Importing to ${tableName}...`);
  const metricName = dataset.datasetType;

  try {
    const importResult = await importCSV(supabase, downloadResult.csvContent!, metricName, dataset);
    console.log(`   ✅ Imported: ${importResult.marketsCreated} markets, ${importResult.timeSeriesInserted.toLocaleString()} time series records`);

    if (importResult.errors > 0) {
      console.log(`   ⚠️  ${importResult.errors} errors during import`);
    }

    return {
      datasetId: dataset.id,
      success: importResult.errors === 0,
      marketsCreated: importResult.marketsCreated,
      timeSeriesInserted: importResult.timeSeriesInserted,
      errors: importResult.errors
    };
  } catch (err: any) {
    console.error(`   ❌ Import failed: ${err.message}`);
    return {
      datasetId: dataset.id,
      success: false,
      marketsCreated: 0,
      timeSeriesInserted: 0,
      errors: 1,
      errorMessage: err.message
    };
  }
}

function printSummary(results: ImportResult[]): void {
  console.log('\n' + '='.repeat(60));
  console.log('📊 IMPORT SUMMARY');
  console.log('='.repeat(60));

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(`✅ Successful: ${successful.length}`);
  console.log(`❌ Failed: ${failed.length}`);

  let totalMarkets = 0;
  let totalTimeSeries = 0;

  results.forEach(r => {
    totalMarkets += r.marketsCreated;
    totalTimeSeries += r.timeSeriesInserted;
  });

  console.log(`📊 Total markets created/updated: ${totalMarkets}`);
  console.log(`📊 Total time series records: ${totalTimeSeries.toLocaleString()}`);

  if (failed.length > 0) {
    console.log('\n❌ Failed datasets:');
    failed.forEach(r => {
      console.log(`  - ${r.datasetId}: ${r.errorMessage || 'Unknown error'}`);
    });
  }

  console.log('\n✅ Process complete!');
}

async function main() {
  console.log('🚀 Starting Missing Zillow Dataset Import');
  console.log('='.repeat(60));
  console.log(`Total datasets to import: ${MISSING_DATASETS.length}\n`);

  const supabase = createZillowImportClient();

  const results: ImportResult[] = [];

  for (const [index, dataset] of MISSING_DATASETS.entries()) {
    console.log(`\n[${index + 1}/${MISSING_DATASETS.length}]`);

    try {
      const result = await processDataset(supabase, dataset);
      results.push(result);

      // Add delay between datasets to avoid rate limiting
      if (index < MISSING_DATASETS.length - 1) {
        console.log('   ⏳ Waiting 2 seconds before next dataset...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error: any) {
      console.error(`   ❌ Fatal error: ${error.message}`);
      results.push({
        datasetId: dataset.id,
        success: false,
        marketsCreated: 0,
        timeSeriesInserted: 0,
        errors: 1,
        errorMessage: error.message
      });
    }
  }

  printSummary(results);
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
