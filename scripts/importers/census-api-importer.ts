/**
 * Census Bureau API Data Importer
 *
 * Imports demographics, economics, and housing data from Census Bureau API
 * - American Community Survey 5-Year Estimates (ACS5)
 * - Supports ZIP, County, and State levels
 * - Annual updates (released each December)
 *
 * Usage:
 *   npx tsx scripts/importers/census-api-importer.ts --year=2022 --geography=zip
 *   npx tsx scripts/importers/census-api-importer.ts --year=2022 --geography=county
 *   npx tsx scripts/importers/census-api-importer.ts --year=2022 --geography=state
 *   npx tsx scripts/importers/census-api-importer.ts --year=2022 --all
 *
 * Refactored to use modular components from ./census-import/
 */

import type { ImportStats, CensusGeography } from './census-import/types';
import { getCensusApiKey, getSupabaseUrl } from './census-import/db-client';
import { importCensusData, printOverallSummary } from './census-import/importer';

/**
 * CLI handling
 */
async function main() {
  const args = process.argv.slice(2);
  const yearArg = args.find(arg => arg.startsWith('--year='));
  const geoArg = args.find(arg => arg.startsWith('--geography='));
  const allFlag = args.includes('--all');

  const year = yearArg ? parseInt(yearArg.split('=')[1]) : new Date().getFullYear() - 2;
  const apiKey = getCensusApiKey();
  const supabaseUrl = getSupabaseUrl();

  console.log('🏛️  Census Bureau API Data Importer');
  console.log(`📅 Year: ${year}`);
  console.log(`🔑 API Key: ${apiKey ? '✅ Set' : '❌ Missing'}`);
  console.log(`🔗 Supabase: ${supabaseUrl}\n`);

  if (!apiKey) {
    console.error('❌ CENSUS_API_KEY not found in environment');
    console.error('   Please set CENSUS_API_KEY in web/.env.local');
    console.error('   Get your free API key at: https://api.census.gov/data/key_signup.html');
    process.exit(1);
  }

  const allStats: ImportStats[] = [];

  if (allFlag) {
    allStats.push(await importCensusData(year, 'state'));
    allStats.push(await importCensusData(year, 'county'));
    allStats.push(await importCensusData(year, 'zip'));
  } else if (geoArg) {
    const geography = geoArg.split('=')[1] as CensusGeography;
    allStats.push(await importCensusData(year, geography));
  } else {
    console.error('Usage:');
    console.error('  npx tsx scripts/importers/census-api-importer.ts --year=2022 --geography=zip');
    console.error('  npx tsx scripts/importers/census-api-importer.ts --year=2022 --geography=county');
    console.error('  npx tsx scripts/importers/census-api-importer.ts --year=2022 --geography=state');
    console.error('  npx tsx scripts/importers/census-api-importer.ts --year=2022 --all');
    process.exit(1);
  }

  if (allStats.length > 1) {
    printOverallSummary(allStats);
  }

  const hasErrors = allStats.some(s => s.errors.length > 0);
  process.exit(hasErrors ? 1 : 0);
}

main();
