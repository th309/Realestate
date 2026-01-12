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
  // Try packages/frontend first
  const zillowDatasets = require('../packages/frontend/lib/data-ingestion/sources/zillow-datasets');
  ZILLOW_DATASETS = zillowDatasets.ZILLOW_DATASETS;
} catch (error) {
  try {
    // Fallback to web (older structure)
    const zillowDatasets = require('../web/lib/data-ingestion/sources/zillow-datasets');
    ZILLOW_DATASETS = zillowDatasets.ZILLOW_DATASETS;
  } catch (innerError) {
    console.error('❌ Could not import zillow-datasets from packages/frontend or web');
    process.exit(1);
  }
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
 * Returns true if all datasets succeeded, false if any failed
 */
function printSummary(results: ImportResult[], startTime: number): boolean {
  const endTime = Date.now();
  const durationMs = endTime - startTime;
  const durationMin = Math.round(durationMs / 60000);

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

  console.log(`📊 Total markets created/updated: ${totalMarkets.toLocaleString()}`);
  console.log(`📊 Total time series records: ${totalTimeSeries.toLocaleString()}`);
  console.log(`⏱️  Duration: ${durationMin} minutes`);

  if (failed.length > 0) {
    console.log('\n❌ Failed datasets:');
    failed.forEach(r => {
      console.log(`  - ${r.datasetId}: ${r.errorMessage || 'Unknown error'}`);
    });
  }

  if (successful.length > 0) {
    console.log('\n✅ Successful datasets:');
    successful.forEach(r => {
      console.log(`  - ${r.datasetId}: ${r.timeSeriesInserted.toLocaleString()} records`);
    });
  }

  console.log('\n' + '='.repeat(60));
  if (failed.length === 0) {
    console.log('✅ ALL DATASETS IMPORTED SUCCESSFULLY');
  } else {
    console.log(`⚠️  ${failed.length} DATASET(S) FAILED - CHECK LOGS ABOVE`);
  }
  console.log('='.repeat(60));

  return failed.length === 0;
}

/**
 * Main function
 */
async function main() {
  const startTime = Date.now();

  console.log('🚀 Starting Zillow Dataset Import Process');
  console.log('='.repeat(60));
  console.log(`Date: ${new Date().toISOString()}`);
  console.log(`Total datasets configured: ${ZILLOW_DATASETS.length}\n`);

  const supabase = createZillowImportClient();

  // Sort by estimated size (smallest first): state < metro < county < city < zip
  const getSizePriority = (id: string): number => {
    if (id.includes('-us-')) return 0;      // US aggregate (tiny)
    if (id.includes('-state-')) return 1;   // State (~300KB)
    if (id.includes('-metro-')) return 2;   // Metro (~1-4MB)
    if (id.includes('-county-')) return 3;  // County (~1.7-12MB)
    if (id.includes('-city-')) return 4;    // City (~4-88MB)
    if (id.includes('-zip-')) return 5;     // ZIP (~116MB)
    return 3; // Default to middle
  };

  const args = process.argv.slice(2);
  const filterArg = args.find(arg => arg.startsWith('--filter='));
  const filter = filterArg ? filterArg.split('=')[1] : null;

  let datasetsToProcess = ZILLOW_DATASETS
    .sort((a, b) => getSizePriority(a.id) - getSizePriority(b.id));

  if (filter) {
    console.log(`🔍 Filtering datasets by: "${filter}"`);
    datasetsToProcess = datasetsToProcess.filter(d => d.id.includes(filter));
  }

  console.log(`Processing ${datasetsToProcess.length} datasets (sorted smallest to largest)...\n`);

  const results: ImportResult[] = [];

  for (const [index, dataset] of datasetsToProcess.entries()) {
    console.log(`\n[${index + 1}/${datasetsToProcess.length}]`);

    try {
      const result = await processDataset(supabase, dataset);
      results.push(result);

      // Add delay between datasets to avoid rate limiting
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
        errors: 1,
        errorMessage: error.message
      });
    }
  }

  const allSuccess = printSummary(results, startTime);

  // Exit with error code if any failures occurred
  if (!allSuccess) {
    process.exit(1);
  }
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
