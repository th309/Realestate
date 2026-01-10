#!/usr/bin/env npx tsx
/**
 * Import Zillow ZHVI County-level data
 *
 * Downloads and imports the latest county-level home value index data from Zillow.
 * Run monthly to keep data current.
 *
 * Usage:
 *   npx tsx scripts/zillow-import/import-county.ts
 *   npx tsx scripts/zillow-import/import-county.ts --force  # Full reimport
 */

import { ZhviImporter, printResult } from './base-importer';

async function main() {
  const forceFullImport = process.argv.includes('--force');

  console.log('=== Zillow ZHVI County Import ===');
  console.log(`Mode: ${forceFullImport ? 'Full Import' : 'Incremental Update'}`);
  console.log(`Date: ${new Date().toISOString()}\n`);

  const importer = new ZhviImporter('County');
  const result = await importer.import(forceFullImport);

  printResult(result);

  process.exit(result.errors.length > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
