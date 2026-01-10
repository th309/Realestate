#!/usr/bin/env npx tsx
/**
 * Import Zillow ZHVI City-level data
 *
 * Downloads and imports the latest city-level home value index data from Zillow.
 * This is a very large dataset (~30K+ cities).
 * Run monthly to keep data current.
 *
 * Usage:
 *   npx tsx scripts/zillow-import/import-city.ts
 *   npx tsx scripts/zillow-import/import-city.ts --force  # Full reimport
 */

import { ZhviImporter, printResult } from './base-importer';

async function main() {
  const forceFullImport = process.argv.includes('--force');

  console.log('=== Zillow ZHVI City Import ===');
  console.log(`Mode: ${forceFullImport ? 'Full Import' : 'Incremental Update'}`);
  console.log(`Date: ${new Date().toISOString()}\n`);

  // Use larger batch size for City (many records)
  const importer = new ZhviImporter('City', 2000);
  const result = await importer.import(forceFullImport);

  printResult(result);

  process.exit(result.errors.length > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
