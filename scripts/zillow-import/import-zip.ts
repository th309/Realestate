#!/usr/bin/env npx tsx
/**
 * Import Zillow ZHVI ZIP-level data
 *
 * Downloads and imports ZIP code-level home value index data into zillow_zip table.
 * Run monthly to keep data current.
 *
 * Note: ZIP-level data is large (~33,000 ZIP codes x ~300 months = ~10M records)
 * This import may take longer than other geography levels.
 *
 * Usage:
 *   npx tsx scripts/zillow-import/import-zip.ts
 *   npx tsx scripts/zillow-import/import-zip.ts --force  # Full reimport
 */

import { ZillowImporter, printResult } from './base-importer';

async function main() {
  const forceFullImport = process.argv.includes('--force');

  console.log('=== Zillow ZHVI ZIP Import ===');
  console.log(`Target: zillow_zip table`);
  console.log(`Mode: ${forceFullImport ? 'Full Import' : 'Incremental Update'}`);
  console.log(`Date: ${new Date().toISOString()}\n`);

  // Use larger batch size for ZIP data
  const importer = new ZillowImporter('Zip', 'zhvi', 5000);
  const result = await importer.import(forceFullImport);

  printResult(result);

  process.exit(result.errors.length > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
