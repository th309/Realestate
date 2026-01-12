#!/usr/bin/env npx tsx
/**
 * Import Zillow ZHVI State-level data
 *
 * Downloads and imports state-level home value index data into zillow_state table.
 * Run monthly to keep data current.
 *
 * Usage:
 *   npx tsx scripts/zillow-import/import-state.ts
 *   npx tsx scripts/zillow-import/import-state.ts --force  # Full reimport
 */

import { ZillowImporter, printResult } from './base-importer';

async function main() {
  const forceFullImport = process.argv.includes('--force');

  console.log('=== Zillow ZHVI State Import ===');
  console.log(`Target: zillow_state table`);
  console.log(`Mode: ${forceFullImport ? 'Full Import' : 'Incremental Update'}`);
  console.log(`Date: ${new Date().toISOString()}\n`);

  const importer = new ZillowImporter('State', 'zhvi');
  const result = await importer.import(forceFullImport);

  printResult(result);

  process.exit(result.errors.length > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
