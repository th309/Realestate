/**
 * FRED (Federal Reserve Economic Data) API Importer
 *
 * Imports economic time series data from FRED API
 * - Supports state, county, and metro (MSA) levels
 * - Handles multiple economic indicators
 * - Time series data with historical values
 *
 * Usage:
 *   npx tsx scripts/importers/fred-api-importer.ts --year=2024 --geography=state
 *   npx tsx scripts/importers/fred-api-importer.ts --year=2024 --geography=county
 *   npx tsx scripts/importers/fred-api-importer.ts --year=2024 --geography=msa
 *   npx tsx scripts/importers/fred-api-importer.ts --year=2024 --all
 *
 * Refactored to use modular components from ./fred-import/
 */

import type { ImportStats, FREDGeography } from './fred-import/types';
import { getFredApiKey, getSupabaseUrl } from './fred-import/db-client';
import { importFREDData, printOverallSummary } from './fred-import/importer';

/**
 * CLI handling
 */
async function main() {
  const args = process.argv.slice(2);
  const yearArg = args.find(arg => arg.startsWith('--year='));
  const geoArg = args.find(arg => arg.startsWith('--geography='));
  const allFlag = args.includes('--all');

  const year = yearArg ? parseInt(yearArg.split('=')[1]) : new Date().getFullYear();
  const apiKey = getFredApiKey();
  const supabaseUrl = getSupabaseUrl();

  console.log('🏛️  FRED API Data Importer');
  console.log(`📅 Year: ${year}`);
  console.log(`🔑 API Key: ${apiKey ? '✅ Set' : '❌ Missing'}`);
  console.log(`🔗 Supabase: ${supabaseUrl}\n`);

  if (!apiKey) {
    console.error('❌ FRED_API_KEY not found in environment');
    console.error('   Please set FRED_API_KEY in web/.env.local');
    console.error('   Get your free API key at: https://fred.stlouisfed.org/docs/api/api_key.html');
    process.exit(1);
  }

  const allStats: ImportStats[] = [];

  if (allFlag) {
    allStats.push(await importFREDData(year, 'national'));
    allStats.push(await importFREDData(year, 'state'));
    allStats.push(await importFREDData(year, 'msa'));
  } else if (geoArg) {
    const geography = geoArg.split('=')[1] as FREDGeography;
    allStats.push(await importFREDData(year, geography));
  } else {
    console.error('Usage:');
    console.error('  npx tsx scripts/importers/fred-api-importer.ts --year=2024 --geography=national');
    console.error('  npx tsx scripts/importers/fred-api-importer.ts --year=2024 --geography=state');
    console.error('  npx tsx scripts/importers/fred-api-importer.ts --year=2024 --geography=msa');
    console.error('  npx tsx scripts/importers/fred-api-importer.ts --year=2024 --all');
    process.exit(1);
  }

  if (allStats.length > 1) {
    printOverallSummary(allStats);
  }

  const hasErrors = allStats.some(s => s.errors.length > 0);
  process.exit(hasErrors ? 1 : 0);
}

main();
