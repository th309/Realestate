#!/usr/bin/env npx tsx
/**
 * Import All Zillow Data
 *
 * Master script that imports all Zillow data into long-format tables:
 * - zillow_state
 * - zillow_metro
 * - zillow_county
 * - zillow_zip
 *
 * Metrics imported: ZHVI, ZORI, Inventory, etc.
 *
 * Usage:
 *   npx tsx scripts/zillow-import/import-all.ts
 *   npx tsx scripts/zillow-import/import-all.ts --force  # Full reimport all
 *   npx tsx scripts/zillow-import/import-all.ts --level state,metro  # Specific levels
 *   npx tsx scripts/zillow-import/import-all.ts --metric zhvi,zori   # Specific metrics
 */

import { ZillowImporter, printResult, ImportResult, GeographyLevel, MetricName } from './base-importer';

// All geography levels and their available metrics
const GEOGRAPHY_METRICS: Record<GeographyLevel, MetricName[]> = {
  State: ['zhvi'],  // State only has ZHVI
  Metro: ['zhvi', 'zori'],
  County: ['zhvi', 'zori'],
  Zip: ['zhvi', 'zori'],
  City: ['zhvi'],  // City only has ZHVI
};

const ALL_LEVELS: GeographyLevel[] = ['State', 'Metro', 'County', 'Zip'];

// Metric-specific URL overrides
const METRIC_URLS: Partial<Record<MetricName, Record<GeographyLevel, string | null>>> = {
  zori: {
    State: null,
    Metro: 'https://files.zillowstatic.com/research/public_csvs/zori/Metro_zori_uc_sfrcondomfr_sm_sa_month.csv',
    County: 'https://files.zillowstatic.com/research/public_csvs/zori/County_zori_uc_sfrcondomfr_sm_sa_month.csv',
    Zip: 'https://files.zillowstatic.com/research/public_csvs/zori/Zip_zori_uc_sfrcondomfr_sm_sa_month.csv',
    City: null,
  },
};

class MultiMetricImporter extends ZillowImporter {
  private customUrl: string | null = null;

  constructor(geography: GeographyLevel, metricName: MetricName, batchSize = 10000) {
    super(geography, metricName, batchSize);

    // Check for custom URL for this metric
    const metricUrls = METRIC_URLS[metricName];
    if (metricUrls && metricUrls[geography]) {
      this.customUrl = metricUrls[geography];
    }
  }

  async downloadCsv(): Promise<string> {
    // Use custom URL if available
    if (this.customUrl) {
      console.log(`Downloading ${this.geography} ${this.metricName} data...`);
      console.log(`URL: ${this.customUrl}`);

      const response = await fetch(this.customUrl);
      if (!response.ok) {
        if (response.status === 404) {
          console.warn(`Data not found (404)`);
          return '';
        }
        throw new Error(`Failed to download: ${response.status} ${response.statusText}`);
      }

      const text = await response.text();
      console.log(`Downloaded ${(text.length / 1024 / 1024).toFixed(2)} MB`);
      return text;
    }

    // Otherwise use base class URL (ZHVI)
    return super.downloadCsv();
  }
}

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

  // Parse --metric argument
  let metricsFilter: MetricName[] | null = null;
  const metricArg = process.argv.find(arg => arg.startsWith('--metric='));
  if (metricArg) {
    const metricStr = metricArg.split('=')[1];
    metricsFilter = metricStr.split(',').map(m => m.toLowerCase() as MetricName);
  }

  console.log('='.repeat(50));
  console.log('    Zillow Monthly Data Import');
  console.log('='.repeat(50));
  console.log(`Date: ${new Date().toISOString()}`);
  console.log(`Mode: ${forceFullImport ? 'Full Import' : 'Incremental Update'}`);
  console.log(`Levels: ${levelsToImport.join(', ')}`);
  console.log(`Metrics: ${metricsFilter ? metricsFilter.join(', ') : 'all available'}\n`);

  const results: ImportResult[] = [];
  const startTime = Date.now();

  for (const level of levelsToImport) {
    // Get metrics available for this geography
    let metrics = GEOGRAPHY_METRICS[level];
    if (metricsFilter) {
      metrics = metrics.filter(m => metricsFilter!.includes(m));
    }

    for (const metric of metrics) {
      console.log(`\n${'='.repeat(50)}`);
      console.log(`Importing ${level} ${metric.toUpperCase()} data...`);
      console.log('='.repeat(50));

      try {
        // Use smaller batch for larger datasets
        const batchSize = ['Zip'].includes(level) ? 5000 : 10000;
        const importer = new MultiMetricImporter(level, metric, batchSize);
        const result = await importer.import(forceFullImport);
        results.push(result);
        printResult(result);
      } catch (error: any) {
        console.error(`Failed to import ${level} ${metric}:`, error.message);
        results.push({
          geography: level,
          metricName: metric,
          recordsProcessed: 0,
          recordsInserted: 0,
          recordsUpdated: 0,
          errors: [error.message],
          duration: 0,
        });
      }
    }
  }

  // Summary
  const totalDuration = Date.now() - startTime;
  const totalRecords = results.reduce((sum, r) => sum + r.recordsInserted, 0);
  const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);

  console.log('\n');
  console.log('='.repeat(50));
  console.log('           IMPORT SUMMARY');
  console.log('='.repeat(50));
  console.log(`Total Duration: ${(totalDuration / 1000 / 60).toFixed(1)} minutes`);
  console.log(`Total Records Inserted: ${totalRecords.toLocaleString()}`);
  console.log(`Total Errors: ${totalErrors}`);
  console.log('\nBy Geography/Metric:');

  for (const r of results) {
    const status = r.errors.length > 0 ? '[ERR]' : '[OK]';
    console.log(`  ${status} ${r.geography} ${r.metricName}: ${r.recordsInserted.toLocaleString()} records (${(r.duration / 1000).toFixed(1)}s)`);
  }

  process.exit(totalErrors > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
