/**
 * Import Geographic Normalization CSV Files
 *
 * Imports all CSV files from data/Normalization/ into Supabase tables:
 * 1. States.csv → tiger_states
 * 2. County to State.csv → tiger_counties
 * 3. Metro Areas.csv → tiger_cbsa
 * 4. ZIP to State, Town, Metro.csv → tiger_zcta
 * 5. Zip to County.csv → geo_zip_county
 * 6. Metro to ZIP Code.csv → geo_zip_cbsa
 *
 * Usage:
 *   npx tsx scripts/import-normalization-csvs.ts
 *
 * Refactored to use modular components from ./normalization-import/
 */

import { join } from 'path';
import type { ImportResult } from './normalization-import/types';
import { createNormalizationClient, getSupabaseUrl } from './normalization-import/db-client';
import {
  importStates,
  importCounties,
  importCBSA,
  importZIPPrimary,
  importZIPCounty,
  importZIPCBSA
} from './normalization-import/importers';

const DATA_DIR = join(__dirname, '../data/Normalization');

/**
 * Print import summary
 */
function printSummary(results: ImportResult[]): void {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('📊 IMPORT SUMMARY');
  console.log('═══════════════════════════════════════════════════════════');

  let totalProcessed = 0;
  let totalInserted = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  results.forEach(result => {
    totalProcessed += result.rowsProcessed;
    totalInserted += result.rowsInserted;
    totalSkipped += result.skipped;
    totalErrors += result.errors.length;

    const status = result.errors.length === 0 ? '✅' : '⚠️';
    console.log(`\n${status} ${result.file}:`);
    console.log(`   Processed: ${result.rowsProcessed.toLocaleString()}`);
    console.log(`   Inserted:  ${result.rowsInserted.toLocaleString()}`);
    console.log(`   Skipped:   ${result.skipped.toLocaleString()}`);
    if (result.errors.length > 0) {
      console.log(`   Errors:    ${result.errors.length}`);
      result.errors.slice(0, 3).forEach(err => {
        console.log(`      - ${err}`);
      });
      if (result.errors.length > 3) {
        console.log(`      ... and ${result.errors.length - 3} more`);
      }
    }
  });

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('📈 TOTALS');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`   Total Processed: ${totalProcessed.toLocaleString()}`);
  console.log(`   Total Inserted:  ${totalInserted.toLocaleString()}`);
  console.log(`   Total Skipped:   ${totalSkipped.toLocaleString()}`);
  console.log(`   Total Errors:    ${totalErrors}`);
  console.log('');

  if (totalErrors === 0) {
    console.log('✅ All imports completed successfully!');
  } else {
    console.log('⚠️  Imports completed with some errors. Review the details above.');
  }
}

/**
 * Main import function
 */
async function main() {
  console.log('🚀 Starting CSV Import Process...');
  console.log(`   Data directory: ${DATA_DIR}`);
  console.log(`   Supabase URL: ${getSupabaseUrl()}`);
  console.log('');

  const supabase = createNormalizationClient();
  const results: ImportResult[] = [];

  try {
    // Import in order: States → Counties → CBSA → ZIPs → Relationships
    results.push(await importStates(supabase));
    results.push(await importCounties(supabase));
    results.push(await importCBSA(supabase));
    results.push(await importZIPPrimary(supabase));
    results.push(await importZIPCounty(supabase));
    results.push(await importZIPCBSA(supabase));

    printSummary(results);
  } catch (error: any) {
    console.error('\n❌ Fatal error during import:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run the import
main().catch(error => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
});
