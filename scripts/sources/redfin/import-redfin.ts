#!/usr/bin/env npx tsx
/**
 * Redfin Market Tracker unified data import entry point.
 *
 * Downloads gzipped TSV files from Redfin's S3 bucket, parses them,
 * resolves region names to standard geoids via tiger lookup tables,
 * and upserts into year-partitioned redfin_metrics tables.
 *
 * Uses the shared framework for database client, batch upserts, and ingestion
 * logging. Handles its own TSV parsing and geoid resolution because Redfin
 * files are too large for the standard loadDataFile() approach.
 *
 * Usage:
 *   npx tsx scripts/sources/redfin/import-redfin.ts                  # Import default geos (state, metro, county, zip)
 *   npx tsx scripts/sources/redfin/import-redfin.ts --geo metro      # Single geography
 *   npx tsx scripts/sources/redfin/import-redfin.ts --geo all        # All geographies including national/city/neighborhood
 *   npx tsx scripts/sources/redfin/import-redfin.ts --limit 5000     # Limit rows per file (for testing)
 */

import type { ImportGeographyResult, ImportSourceResult } from '../../lib';
import { printSummaryBanner, reportStatusToBackend } from '../../lib/import-reporter';
import { DEFAULT_IMPORT_GEOS, ALL_REDFIN_GEOS } from './redfin-config';
import { importRedfinGeography } from './redfin-tsv-processor';
import { clearGeoidCache } from './redfin-geoid-lookup';

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const geoFlagIndex = args.indexOf('--geo');
const geoFilter = geoFlagIndex >= 0 ? args[geoFlagIndex + 1] : null;
const limitFlagIndex = args.indexOf('--limit');
const rowLimit = limitFlagIndex >= 0 ? parseInt(args[limitFlagIndex + 1], 10) : undefined;

function getGeographiesToImport(): string[] {
  if (!geoFilter || geoFilter === 'default') return DEFAULT_IMPORT_GEOS;
  if (geoFilter === 'all') return ALL_REDFIN_GEOS;
  if (!ALL_REDFIN_GEOS.includes(geoFilter)) {
    console.error(`Invalid geography: "${geoFilter}". Valid: ${ALL_REDFIN_GEOS.join(', ')}, all, default`);
    process.exit(1);
  }
  return [geoFilter];
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const startTime = Date.now();
  const geos = getGeographiesToImport();

  console.log('Redfin Market Tracker Data Import');
  console.log('='.repeat(60));
  console.log(`Date:         ${new Date().toISOString()}`);
  console.log(`Geographies:  ${geos.join(', ')}`);
  if (rowLimit) console.log(`Row limit:    ${rowLimit.toLocaleString()}`);
  console.log('');

  const geoResults: ImportGeographyResult[] = [];

  // Import each geography sequentially (they share the geoid cache)
  for (const geo of geos) {
    const geoResult = await importRedfinGeography(geo, rowLimit);
    geoResults.push(geoResult);
  }

  // Aggregate results
  const totalInserted = geoResults.reduce((sum, g) => sum + g.recordsInserted, 0);
  const totalFailed = geoResults.reduce((sum, g) => sum + g.recordsFailed, 0);
  const allSucceeded = geoResults.every(g => g.status === 'success' || g.status === 'skipped');
  const anySucceeded = geoResults.some(g => g.status === 'success' || g.status === 'partial');

  const overallStatus = allSucceeded ? 'success' : anySucceeded ? 'partial' : 'failed';

  const sourceResult: ImportSourceResult = {
    source: 'redfin',
    geographies: geoResults,
    overallStatus,
    totalInserted,
    totalFailed,
    totalDurationMs: Date.now() - startTime,
  };

  printSummaryBanner(sourceResult);
  await reportStatusToBackend(sourceResult);

  // Clear the geoid cache at the end of the run
  clearGeoidCache();

  if (overallStatus === 'failed') {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
