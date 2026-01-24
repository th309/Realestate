/**
 * Import Realtor.com State Data
 *
 * Imports state-level housing market data from Realtor.com.
 *
 * Usage:
 *   # Import from current month download URL
 *   npx tsx scripts/import-realtor-state.ts
 *
 *   # Import from historical file
 *   npx tsx scripts/import-realtor-state.ts --history
 */

import { createRealtorImportClient } from './realtor-import/db-client';
import { downloadDataset, loadFromFile } from './realtor-import/download';
import { parseStateCSV, importStateRecords } from './realtor-import/csv-processor';
import { REALTOR_DATASETS } from './realtor-import/types';
import { refreshCalculatedMetrics } from './utils/refresh-calculated-metrics';
import { createIngestionLogger } from './utils/ingestion-logger';

const DATASET_CONFIG = REALTOR_DATASETS.find(d => d.id === 'realtor-state')!;

async function main() {
  const startTime = Date.now();
  const args = process.argv.slice(2);
  const useHistory = args.includes('--history');

  console.log('🏠 Realtor.com State Data Import');
  console.log('='.repeat(60));
  console.log(`Date: ${new Date().toISOString()}`);
  console.log(`Mode: ${useHistory ? 'Historical file' : 'Current month download'}`);
  console.log('');

  // Create database client
  const supabase = createRealtorImportClient();

  // Create ingestion logger
  const logger = createIngestionLogger(supabase, {
    source: 'realtor',
    tableName: 'realtor_state',
    datasetId: 'realtor-state'
  });

  try {
    // Get CSV content
    let csvContent: string;
    if (useHistory && DATASET_CONFIG.historyFile) {
      console.log('📂 Loading historical data...');
      const result = loadFromFile(DATASET_CONFIG.historyFile);
      if (!result.success) {
        console.error(`❌ Failed to load file: ${result.error}`);
        await logger.fail(`Failed to load file: ${result.error}`);
        process.exit(1);
      }
      csvContent = result.csvContent!;
    } else {
      console.log('📥 Downloading current month data...');
      const result = await downloadDataset(DATASET_CONFIG.downloadUrl);
      if (!result.success) {
        console.error(`❌ Failed to download: ${result.error}`);
        await logger.fail(`Failed to download: ${result.error}`);
        process.exit(1);
      }
      csvContent = result.csvContent!;
    }

    // Parse CSV
    console.log('\n📊 Parsing CSV data...');
    const records = parseStateCSV(csvContent);
    console.log(`  ✅ Parsed ${records.length} records`);

    // Show date range and state count
    if (records.length > 0) {
      const dates = records.map(r => r.period_date).sort((a, b) => a.getTime() - b.getTime());
      const startDate = dates[0].toISOString().split('T')[0];
      const endDate = dates[dates.length - 1].toISOString().split('T')[0];
      const uniqueStates = new Set(records.map(r => r.state_id)).size;
      console.log(`  📅 Date range: ${startDate} to ${endDate}`);
      console.log(`  🗺️  States: ${uniqueStates}`);
    }

    // Start ingestion log
    await logger.start(records.length);

    // Import to database
    console.log('\n💾 Importing to database...');
    const result = await importStateRecords(supabase, records);

    // Complete ingestion log
    await logger.complete({
      recordsProcessed: records.length,
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
      // Refresh calculated metrics after successful import
      if (result.recordsInserted > 0) {
        await refreshCalculatedMetrics(supabase);
      }
      console.log('✅ IMPORT COMPLETED SUCCESSFULLY');
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
