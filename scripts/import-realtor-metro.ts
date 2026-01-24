/**
 * Import Realtor.com Metro Data
 *
 * Imports metro-level housing market data from Realtor.com (core + hotness combined).
 *
 * Usage:
 *   npx tsx scripts/import-realtor-metro.ts           # Current month
 *   npx tsx scripts/import-realtor-metro.ts --history # Historical files
 */

import { createRealtorImportClient } from './realtor-import/db-client';
import { loadFromFile } from './realtor-import/download';
import {
  parseMetroCoreCSV,
  parseMetroHotnessCSV,
  mergeMetroData,
  importMetroRecords
} from './realtor-import/csv-processor';
import { REALTOR_DATASETS } from './realtor-import/types';
import { refreshCalculatedMetrics } from './utils/refresh-calculated-metrics';
import { createIngestionLogger } from './utils/ingestion-logger';

const DATASET_CONFIG = REALTOR_DATASETS.find(d => d.id === 'realtor-metro')!;

async function main() {
  const startTime = Date.now();
  const args = process.argv.slice(2);
  const useHistory = args.includes('--history');

  console.log('🏠 Realtor.com Metro Data Import');
  console.log('='.repeat(60));
  console.log(`Date: ${new Date().toISOString()}`);
  console.log(`Mode: ${useHistory ? 'Historical files' : 'Current month download'}`);
  console.log('');

  const supabase = createRealtorImportClient();

  // Create ingestion logger
  const logger = createIngestionLogger(supabase, {
    source: 'realtor',
    tableName: 'realtor_metro',
    datasetId: 'realtor-metro'
  });

  try {
    // Load core data
    console.log('📂 Loading core data...');
    const coreResult = loadFromFile(DATASET_CONFIG.historyFile!);
    if (!coreResult.success) {
      console.error(`❌ Failed to load core file: ${coreResult.error}`);
      await logger.fail(`Failed to load core file: ${coreResult.error}`);
      process.exit(1);
    }

    // Load hotness data
    console.log('📂 Loading hotness data...');
    const hotnessResult = loadFromFile(DATASET_CONFIG.hotnessHistoryFile!);
    if (!hotnessResult.success) {
      console.error(`❌ Failed to load hotness file: ${hotnessResult.error}`);
      await logger.fail(`Failed to load hotness file: ${hotnessResult.error}`);
      process.exit(1);
    }

    // Parse CSV files
    console.log('\n📊 Parsing CSV data...');
    const coreRecords = parseMetroCoreCSV(coreResult.csvContent!);
    console.log(`  ✅ Parsed ${coreRecords.length} core records`);

    const hotnessMap = parseMetroHotnessCSV(hotnessResult.csvContent!);
    console.log(`  ✅ Parsed ${hotnessMap.size} hotness records`);

    // Merge data
    console.log('\n🔗 Merging core and hotness data...');
    const mergedRecords = mergeMetroData(coreRecords, hotnessMap);

    // Show stats
    if (mergedRecords.length > 0) {
      const dates = mergedRecords.map(r => r.period_date).sort((a, b) => a.getTime() - b.getTime());
      const uniqueMetros = new Set(mergedRecords.map(r => r.cbsa_code)).size;
      console.log(`  📅 Date range: ${dates[0].toISOString().split('T')[0]} to ${dates[dates.length - 1].toISOString().split('T')[0]}`);
      console.log(`  🏙️  Metros: ${uniqueMetros}`);
    }

    // Start ingestion log
    await logger.start(mergedRecords.length);

    // Import to database
    console.log('\n💾 Importing to database...');
    const result = await importMetroRecords(supabase, mergedRecords);

    // Complete ingestion log
    await logger.complete({
      recordsProcessed: mergedRecords.length,
      recordsSuccess: result.recordsInserted,
      recordsError: result.errors,
      errors: result.errors > 0 ? [`${result.errors} records failed`] : []
    });

    // Summary
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('\n' + '='.repeat(60));
    console.log('📊 IMPORT SUMMARY');
    console.log('='.repeat(60));
    console.log(`Records imported: ${result.recordsInserted}`);
    console.log(`Errors: ${result.errors}`);
    console.log(`Duration: ${duration}s`);
    console.log('='.repeat(60));

    if (result.success) {
      console.log('✅ IMPORT COMPLETED SUCCESSFULLY');

      // Refresh calculated metrics after import
      await refreshCalculatedMetrics(supabase);
    } else {
      console.log('❌ IMPORT COMPLETED WITH ERRORS');
      process.exit(1);
    }
  } catch (error: any) {
    await logger.fail(error.message);
    throw error;
  }
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
