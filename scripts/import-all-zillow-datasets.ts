/**
 * Download and Import All Zillow Datasets
 *
 * Downloads and imports all available Zillow datasets one by one.
 *
 * Usage:
 *   npx tsx scripts/import-all-zillow-datasets.ts
 *
 * Refactored to use modular components from ./zillow-all-import/
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

// Import dataset configuration
let ZILLOW_DATASETS: DatasetConfig[];
try {
  const zillowDatasets = require('../web/lib/data-ingestion/sources/zillow-datasets');
  ZILLOW_DATASETS = zillowDatasets.ZILLOW_DATASETS;
} catch (error) {
  console.error('❌ Could not import zillow-datasets');
  process.exit(1);
}

/**
 * Process a single dataset
 */
async function processDataset(supabase: any, dataset: DatasetConfig): Promise<ImportResult> {
  console.log(`\n📊 Processing: ${dataset.id}`);
  console.log(`   Description: ${dataset.description}`);

  // Determine metric name from dataset type
  let metricName = dataset.datasetType;
  if (metricName === 'invt_fs') metricName = 'inventory';
  if (metricName === 'sales_count_now') metricName = 'sales_count';
  if (metricName === 'median_sale_price') metricName = 'median_sale_price';
  if (metricName === 'mean_doz_pending') metricName = 'days_to_pending';

  const tableName = getTableName(dataset.datasetType);
  console.log(`   Target table: ${tableName}`);

  // Download
  const downloadResult = await downloadDataset(dataset);
  if (!downloadResult.success) {
    return {
      datasetId: dataset.id,
      success: false,
      marketsCreated: 0,
      timeSeriesInserted: 0,
      errors: 0,
      errorMessage: downloadResult.error
    };
  }

  // Import
  console.log(`  🔄 Importing data...`);
  const importResult = await importCSV(supabase, downloadResult.csvContent!, metricName, dataset);

  console.log(`  ✅ Imported: ${importResult.marketsCreated} markets, ${importResult.timeSeriesInserted} time series records`);

  return {
    datasetId: dataset.id,
    success: importResult.errors === 0,
    marketsCreated: importResult.marketsCreated,
    timeSeriesInserted: importResult.timeSeriesInserted,
    errors: importResult.errors
  };
}

/**
 * Print summary of import results
 */
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

/**
 * Main function
 */
async function main() {
  console.log('🚀 Starting Zillow Dataset Import Process');
  console.log('='.repeat(60));
  console.log(`Total datasets: ${ZILLOW_DATASETS.length}\n`);

  const supabase = createZillowImportClient();

  // Skip the one we already imported
  const datasetsToProcess = ZILLOW_DATASETS.filter(d => d.id !== 'zhvi-metro-all-homes-sm-sa');

  console.log(`Processing ${datasetsToProcess.length} datasets...\n`);

  const results: ImportResult[] = [];

  for (const [index, dataset] of datasetsToProcess.entries()) {
    console.log(`\n[${index + 1}/${datasetsToProcess.length}]`);

    try {
      const result = await processDataset(supabase, dataset);
      results.push(result);

      // Add delay between datasets
      if (index < datasetsToProcess.length - 1) {
        console.log('  ⏳ Waiting 2 seconds before next dataset...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error: any) {
      console.error(`  ❌ Fatal error: ${error.message}`);
      results.push({
        datasetId: dataset.id,
        success: false,
        marketsCreated: 0,
        timeSeriesInserted: 0,
        errors: 0,
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
