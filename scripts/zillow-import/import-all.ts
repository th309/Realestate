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
 * Metro imports use Zillow_Census_Metro_Crosswalk.csv for CBSA codes.
 *
 * Usage:
 *   npx tsx scripts/zillow-import/import-all.ts
 *   npx tsx scripts/zillow-import/import-all.ts --force  # Full reimport all
 *   npx tsx scripts/zillow-import/import-all.ts --level state,metro  # Specific levels
 *   npx tsx scripts/zillow-import/import-all.ts --metric zhvi,zori   # Specific metrics
 */

import { ZillowImporter, printResult, ImportResult, GeographyLevel, MetricName, ZillowRecord } from './base-importer';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parse } from 'csv-parse/sync';

// CBSA crosswalk mapping: Zillow RegionID -> CBSA info
interface CbsaCrosswalkEntry {
  cbsaCode: string;
  cbsaName: string;
  cbsaType: string;
}

// Global crosswalk cache (loaded once, used for all Metro imports)
let cbsaCrosswalk: Map<number, CbsaCrosswalkEntry> | null = null;

function loadCbsaCrosswalk(): Map<number, CbsaCrosswalkEntry> {
  if (cbsaCrosswalk) return cbsaCrosswalk;

  const crosswalkPath = join(__dirname, '../../data/normalization/Zillow_Census_Metro_Crosswalk.csv');
  console.log('Loading CBSA crosswalk from:', crosswalkPath);

  try {
    const csvContent = readFileSync(crosswalkPath, 'utf-8');
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
    });

    cbsaCrosswalk = new Map<number, CbsaCrosswalkEntry>();
    for (const record of records) {
      const regionId = parseInt(record.Zillow_RegionID, 10);
      // Deduplicate - file has multiple rows per metro (one per county)
      if (!isNaN(regionId) && record['CBSA Code'] && !cbsaCrosswalk.has(regionId)) {
        cbsaCrosswalk.set(regionId, {
          cbsaCode: record['CBSA Code'],
          cbsaName: record['CBSA Title'] || '',
          cbsaType: record['Metropolitan/Micropolitan Statistical Area'] || '',
        });
      }
    }

    console.log(`Loaded ${cbsaCrosswalk.size} CBSA mappings from crosswalk\n`);
    return cbsaCrosswalk;
  } catch (error: any) {
    console.error('Error loading CBSA crosswalk:', error.message);
    cbsaCrosswalk = new Map();
    return cbsaCrosswalk;
  }
}

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
  private crosswalk: Map<number, CbsaCrosswalkEntry> | null = null;

  constructor(geography: GeographyLevel, metricName: MetricName, batchSize = 10000) {
    super(geography, metricName, batchSize);

    // Check for custom URL for this metric
    const metricUrls = METRIC_URLS[metricName];
    if (metricUrls && metricUrls[geography]) {
      this.customUrl = metricUrls[geography];
    }

    // Load CBSA crosswalk for Metro imports
    if (geography === 'Metro') {
      this.crosswalk = loadCbsaCrosswalk();
    }
  }

  // Override getCbsaCode to use the crosswalk for Metro imports
  getCbsaCode(record: any): string | null {
    if (this.geography !== 'Metro' || !this.crosswalk) {
      return super.getCbsaCode(record);
    }

    const regionId = parseInt(record.RegionID, 10);
    if (isNaN(regionId)) return null;

    const crosswalkEntry = this.crosswalk.get(regionId);
    if (crosswalkEntry) {
      return crosswalkEntry.cbsaCode;
    }

    // Fallback to CSV field if present
    return record.CBSACode || null;
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
