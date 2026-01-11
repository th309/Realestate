/**
 * Import Zillow Data - US/National and Metro Level Only
 *
 * Imports only US/National and Metro level data for:
 * - zillow_zhvi (Home Values)
 * - zillow_zori (Rentals)
 * - zillow_inventory (For-Sale Inventory)
 * - zillow_sales_count (Sales Count)
 * - zillow_sales_price (Median Sale Price)
 * - zillow_days_to_pending (Days to Pending)
 * - And 15 additional dataset types
 *
 * Usage:
 *   npx tsx scripts/import-zillow-us-metro-only.ts
 *
 * Refactored to use modular components from ./zillow-us-metro-import/
 */

import type { ProcessedResult } from './zillow-us-metro-import/types';
import { TARGET_DATASETS } from './zillow-us-metro-import/dataset-configs';
import { importDataset, printSummary } from './zillow-us-metro-import/importer';

/**
 * Main function
 */
async function main() {
  console.log('🚀 Importing Zillow Data - US/National and Metro Level Only');
  console.log('='.repeat(60));
  console.log(`Total datasets: ${TARGET_DATASETS.length} (21 types × 2 levels)\n`);

  const results: ProcessedResult[] = [];

  for (const [index, dataset] of TARGET_DATASETS.entries()) {
    console.log(`\n[${index + 1}/${TARGET_DATASETS.length}]`);

    try {
      const result = await importDataset(dataset);
      results.push({ config: dataset, ...result });

      // Delay between datasets
      if (index < TARGET_DATASETS.length - 1) {
        console.log('  ⏳ Waiting 2 seconds...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error: any) {
      console.error(`  ❌ Fatal error: ${error.message}`);
      results.push({
        config: dataset,
        marketsCreated: 0,
        recordsInserted: 0,
        errors: 1
      });
    }
  }

  printSummary(results);
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
