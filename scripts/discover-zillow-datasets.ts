/**
 * Discover Zillow Research Data Datasets
 *
 * This script analyzes the Zillow research data page to discover all available
 * CSV download URLs and their metadata.
 *
 * Usage:
 *   npx tsx scripts/discover-zillow-datasets.ts
 *
 * Refactored to use modular components from ./zillow-discover/
 */

/**
 * NOTE: This script requires jsdom which is not currently installed.
 * For now, use the URL builder in zillow-datasets.ts instead.
 *
 * To use this script, install jsdom:
 *   npm install --save-dev jsdom @types/jsdom
 */

import { writeFileSync } from 'fs';
import { join } from 'path';
import type { ZillowDataset } from './zillow-discover/types';
import { ZILLOW_DATA_URL } from './zillow-discover/types';
import { generateKnownUrlPatterns } from './zillow-discover/url-patterns';
import { generateTsConfig, printCategorySummary, deduplicateDatasets } from './zillow-discover/ts-generator';

// Uncomment if jsdom is installed:
// import axios from 'axios';
// import { JSDOM } from 'jsdom';

/**
 * Discover all available Zillow datasets from the research data page
 * Note: Requires jsdom to be installed
 */
async function discoverZillowDatasets(): Promise<ZillowDataset[]> {
  console.log('🔍 Discovering Zillow datasets...');
  console.log(`📥 Fetching: ${ZILLOW_DATA_URL}`);
  console.log('⚠️  Note: This script requires jsdom. Using known patterns instead.');

  // For now, return empty array and use known patterns
  // Full implementation requires jsdom - see commented code in original file
  return [];
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 Zillow Dataset Discovery Tool');
  console.log('================================\n');

  try {
    // Try to discover from the page
    let discoveredDatasets: ZillowDataset[] = [];

    try {
      discoveredDatasets = await discoverZillowDatasets();
    } catch (error) {
      console.warn('⚠️ Could not discover from page, using known patterns instead');
    }

    // Also generate known patterns
    const knownPatterns = generateKnownUrlPatterns();

    // Combine and deduplicate
    const allDatasets = [...discoveredDatasets, ...knownPatterns];
    const uniqueDatasets = deduplicateDatasets(allDatasets);

    console.log(`\n📊 Total unique datasets: ${uniqueDatasets.length}`);

    // Save to JSON file
    const outputPath = join(__dirname, 'zillow-datasets.json');
    writeFileSync(outputPath, JSON.stringify(uniqueDatasets, null, 2));
    console.log(`\n💾 Saved to: ${outputPath}`);

    // Generate TypeScript configuration
    const tsConfig = generateTsConfig(uniqueDatasets);
    const tsConfigPath = join(__dirname, '../web/lib/data-ingestion/sources/zillow-datasets.ts');
    writeFileSync(tsConfigPath, tsConfig);
    console.log(`💾 Saved TypeScript config to: ${tsConfigPath}`);

    // Print summary by category
    printCategorySummary(uniqueDatasets);

    console.log('\n✅ Discovery complete!');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
