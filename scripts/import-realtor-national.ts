/**
 * Import Realtor.com National Data
 *
 * Imports national-level housing market data from Realtor.com.
 *
 * Usage:
 *   # Import from current month download URL
 *   npx tsx scripts/import-realtor-national.ts
 *
 *   # Import from historical file
 *   npx tsx scripts/import-realtor-national.ts --history
 */

import { createRealtorImportClient } from './realtor-import/db-client';
import { downloadDataset, loadFromFile } from './realtor-import/download';
import { parseNationalCSV, importNationalRecords } from './realtor-import/csv-processor';
import { REALTOR_DATASETS } from './realtor-import/types';

const DATASET_CONFIG = REALTOR_DATASETS.find(d => d.id === 'realtor-national')!;

async function main() {
  const startTime = Date.now();
  const args = process.argv.slice(2);
  const useHistory = args.includes('--history');

  console.log('🏠 Realtor.com National Data Import');
  console.log('='.repeat(60));
  console.log(`Date: ${new Date().toISOString()}`);
  console.log(`Mode: ${useHistory ? 'Historical file' : 'Current month download'}`);
  console.log('');

  // Create database client
  const supabase = createRealtorImportClient();

  // Get CSV content
  let csvContent: string;
  if (useHistory && DATASET_CONFIG.historyFile) {
    console.log('📂 Loading historical data...');
    const result = loadFromFile(DATASET_CONFIG.historyFile);
    if (!result.success) {
      console.error(`❌ Failed to load file: ${result.error}`);
      process.exit(1);
    }
    csvContent = result.csvContent!;
  } else {
    console.log('📥 Downloading current month data...');
    const result = await downloadDataset(DATASET_CONFIG.downloadUrl);
    if (!result.success) {
      console.error(`❌ Failed to download: ${result.error}`);
      process.exit(1);
    }
    csvContent = result.csvContent!;
  }

  // Parse CSV
  console.log('\n📊 Parsing CSV data...');
  const records = parseNationalCSV(csvContent);
  console.log(`  ✅ Parsed ${records.length} records`);

  // Show date range
  if (records.length > 0) {
    const dates = records.map(r => r.period_date).sort((a, b) => a.getTime() - b.getTime());
    const startDate = dates[0].toISOString().split('T')[0];
    const endDate = dates[dates.length - 1].toISOString().split('T')[0];
    console.log(`  📅 Date range: ${startDate} to ${endDate}`);
  }

  // Import to database
  console.log('\n💾 Importing to database...');
  const result = await importNationalRecords(supabase, records);

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
  } else {
    console.log('❌ IMPORT COMPLETED WITH ERRORS');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
