#!/usr/bin/env npx tsx
/**
 * Import Zillow ZORI (Rent Index) Data
 *
 * Downloads and imports Zillow Observed Rent Index (ZORI) data
 * into long-format zillow_* tables.
 *
 * Usage:
 *   npx tsx scripts/zillow-import/import-zori.ts
 *   npx tsx scripts/zillow-import/import-zori.ts --force  # Full reimport
 */

import { ZillowImporter, printResult, GeographyLevel, MetricName } from './base-importer';

const ZORI_BASE_URL = 'https://files.zillowstatic.com/research/public_csvs/zori';

// ZORI URLs by geography
const ZORI_URLS: Record<GeographyLevel, string | null> = {
  State: null, // State ZORI not available from Zillow
  Metro: `${ZORI_BASE_URL}/Metro_zori_uc_sfrcondomfr_sm_sa_month.csv`,
  County: `${ZORI_BASE_URL}/County_zori_uc_sfrcondomfr_sm_sa_month.csv`,
  Zip: `${ZORI_BASE_URL}/Zip_zori_uc_sfrcondomfr_sm_sa_month.csv`,
  City: null, // City ZORI not available
};

class ZoriImporter extends ZillowImporter {
  constructor(geography: GeographyLevel) {
    super(geography, 'zori' as MetricName);
  }

  // Override download URL to use ZORI URL
  async downloadCsv(): Promise<string> {
    const url = ZORI_URLS[this.geography];
    if (!url) {
      console.log(`ZORI data not available for ${this.geography}`);
      return '';
    }

    console.log(`Downloading ${this.geography} ZORI data from Zillow...`);
    console.log(`URL: ${url}`);

    const response = await fetch(url);
    if (!response.ok) {
      if (response.status === 404) {
        console.warn(`ZORI data not found for ${this.geography} (404)`);
        return '';
      }
      throw new Error(`Failed to download: ${response.status} ${response.statusText}`);
    }

    const text = await response.text();
    console.log(`Downloaded ${(text.length / 1024 / 1024).toFixed(2)} MB`);
    return text;
  }
}

async function main() {
  const forceFullImport = process.argv.includes('--force');

  // Geographies that have ZORI data
  const geographies: GeographyLevel[] = ['Metro', 'County', 'Zip'];

  console.log('=== Zillow ZORI Import ===');
  console.log(`Mode: ${forceFullImport ? 'Full Import' : 'Incremental Update'}`);

  for (const geo of geographies) {
    try {
      console.log(`\n--- Importing ${geo} ZORI ---`);
      const importer = new ZoriImporter(geo);
      const result = await importer.import(forceFullImport);
      if (result.recordsProcessed > 0) {
        printResult(result);
      }
    } catch (e) {
      console.error(`Failed to import ${geo} ZORI:`, e);
    }
  }

  console.log('\n=== ZORI Import Complete ===');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
