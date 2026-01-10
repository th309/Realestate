#!/usr/bin/env npx tsx
/**
 * Import Zillow ZHVI Metro-level data
 *
 * Downloads and imports the latest metro/MSA-level home value index data from Zillow.
 * Run monthly to keep data current.
 *
 * Usage:
 *   npx tsx scripts/zillow-import/import-metro.ts
 *   npx tsx scripts/zillow-import/import-metro.ts --force  # Full reimport
 */

import { ZhviImporter, printResult } from './base-importer';

async function main() {
  const forceFullImport = process.argv.includes('--force');

  console.log('=== Zillow ZHVI Metro Import ===');
  console.log(`Mode: ${forceFullImport ? 'Full Import' : 'Incremental Update'}`);
  console.log(`Date: ${new Date().toISOString()}\n`);

  const importer = new ZhviImporter('Metro');
  const result = await importer.import(forceFullImport);

  printResult(result);

  process.exit(result.errors.length > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
