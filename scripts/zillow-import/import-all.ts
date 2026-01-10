#!/usr/bin/env npx tsx
/**
 * Import All Zillow ZHVI Data
 *
 * Master script that imports all geography levels:
 * - State (51 regions)
 * - Metro (~900 MSAs)
 * - County (~3,000 counties)
 * - Zip (~33,000 ZIP codes)
 * - City (~30,000 cities)
 *
 * Usage:
 *   npx tsx scripts/zillow-import/import-all.ts
 *   npx tsx scripts/zillow-import/import-all.ts --force  # Full reimport all
 *   npx tsx scripts/zillow-import/import-all.ts --level state,metro  # Specific levels
 */

import { ZhviImporter, printResult, ImportResult, GeographyLevel } from './base-importer';

const ALL_LEVELS: GeographyLevel[] = ['State', 'Metro', 'County', 'Zip', 'City'];

async function main() {
  const forceFullImport = process.argv.includes('--force');

  // Parse --level argument
  let levelsToImport: GeographyLevel[] = ALL_LEVELS;
  const levelArg = process.argv.find(arg => arg.startsWith('--level='));
  if (levelArg) {
    const levelStr = levelArg.split('=')[1];
    levelsToImport = levelStr.split(',').map(l => {
      const normalized = l.charAt(0).toUpperCase() + l.slice(1).toLowerCase();
      return normalized as GeographyLevel;
    });
  }

  console.log('╔══════════════════════════════════════════╗');
  console.log('║    Zillow ZHVI Monthly Data Import       ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log(`Date: ${new Date().toISOString()}`);
  console.log(`Mode: ${forceFullImport ? 'Full Import' : 'Incremental Update'}`);
  console.log(`Levels: ${levelsToImport.join(', ')}\n`);

  const results: ImportResult[] = [];
  const startTime = Date.now();

  for (const level of levelsToImport) {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`Importing ${level} data...`);
    console.log('='.repeat(50));

    try {
      const batchSize = ['Zip', 'City'].includes(level) ? 2000 : 1000;
      const importer = new ZhviImporter(level, batchSize);
      const result = await importer.import(forceFullImport);
      results.push(result);
      printResult(result);
    } catch (error: any) {
      console.error(`Failed to import ${level}:`, error.message);
      results.push({
        geography: level,
        recordsProcessed: 0,
        recordsInserted: 0,
        recordsUpdated: 0,
        errors: [error.message],
        duration: 0,
      });
    }
  }

  // Summary
  const totalDuration = Date.now() - startTime;
  const totalRecords = results.reduce((sum, r) => sum + r.recordsInserted, 0);
  const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);

  console.log('\n');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║           IMPORT SUMMARY                 ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log(`Total Duration: ${(totalDuration / 1000 / 60).toFixed(1)} minutes`);
  console.log(`Total Records Inserted: ${totalRecords.toLocaleString()}`);
  console.log(`Total Errors: ${totalErrors}`);
  console.log('\nBy Geography:');

  for (const r of results) {
    const status = r.errors.length > 0 ? '❌' : '✅';
    console.log(`  ${status} ${r.geography}: ${r.recordsInserted.toLocaleString()} records (${(r.duration / 1000).toFixed(1)}s)`);
  }

  process.exit(totalErrors > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
