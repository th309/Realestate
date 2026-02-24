#!/usr/bin/env npx tsx
/**
 * HUD Fair Market Rent unified data import entry point.
 *
 * Downloads the HUD FMR Excel file (trying multiple URL patterns),
 * parses county-level FMR values, deduplicates by 5-digit FIPS code,
 * and upserts into the hud_fmr table using the shared import framework.
 *
 * HUD FMR provides 100% county coverage for rental estimates,
 * unlike ZORI which is limited to major metros.
 *
 * Usage:
 *   npx tsx scripts/sources/hud-fmr/import-hud-fmr.ts
 *   npx tsx scripts/sources/hud-fmr/import-hud-fmr.ts --fy=2025
 *   npx tsx scripts/sources/hud-fmr/import-hud-fmr.ts --local
 *
 * Data source: https://www.huduser.gov/portal/datasets/fmr.html
 */

import { getSupabaseClient, batchUpsert, loadDataFile, downloadFromUrl } from '../../lib';
import type { ImportSourceResult, ImportGeographyResult, BatchUpsertResult } from '../../lib';
import type { IngestionSource } from '../../utils/ingestion-logger';
import { createIngestionLogger } from '../../utils/ingestion-logger';
import { printSummaryBanner, reportStatusToBackend } from '../../lib/import-reporter';

import {
  getCurrentFiscalYear,
  buildFmrDownloadUrls,
  buildFmrLocalPath,
  mapFmrRow,
  HUD_FMR_TABLE,
  HUD_FMR_CONFLICT_KEYS,
  HUD_FMR_BATCH_SIZE,
} from './hud-fmr-config';
import type { HudFmrRecord } from './hud-fmr-config';

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);

function getCliArg(prefix: string): string | null {
  const match = args.find((a) => a.startsWith(prefix));
  return match ? match.split('=')[1] : null;
}

const cliFiscalYear = getCliArg('--fy=') ? parseInt(getCliArg('--fy=')!, 10) : null;
const useLocalFile = args.includes('--local');

const SOURCE: IngestionSource = 'hud';

// ---------------------------------------------------------------------------
// Download HUD FMR file (trying multiple URL patterns)
// ---------------------------------------------------------------------------

/**
 * Try each HUD FMR URL pattern in order until one succeeds.
 * Returns the downloaded buffer, or null if all patterns fail.
 */
async function downloadFmrWithFallback(fiscalYear: number): Promise<Buffer | null> {
  const urls = buildFmrDownloadUrls(fiscalYear);

  for (const url of urls) {
    console.log(`  Trying: ${url}`);
    try {
      const buffer = await downloadFromUrl(url);
      return buffer;
    } catch {
      console.log(`    Failed, trying next pattern...`);
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Parse XLSX and deduplicate rows
// ---------------------------------------------------------------------------

/**
 * Parse the raw XLSX rows into deduplicated HudFmrRecords.
 * HUD includes multiple rows per county (for different sub-areas);
 * we keep only the first occurrence per 5-digit FIPS code.
 */
function parseFmrRowsWithDedup(
  rawRows: Record<string, string>[],
  fiscalYear: number,
): { records: HudFmrRecord[]; skipped: number } {
  const seenFips = new Set<string>();
  const records: HudFmrRecord[] = [];
  let skipped = 0;

  for (const row of rawRows) {
    const mapped = mapFmrRow(row, fiscalYear);
    if (!mapped) {
      skipped++;
      continue;
    }

    // Deduplicate: keep first row per county FIPS
    if (seenFips.has(mapped.fips_code)) {
      skipped++;
      continue;
    }
    seenFips.add(mapped.fips_code);
    records.push(mapped);
  }

  return { records, skipped };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const overallStart = Date.now();
  const currentFY = getCurrentFiscalYear();
  const targetFY = cliFiscalYear ?? currentFY;

  console.log('HUD Fair Market Rent Unified Data Import');
  console.log('='.repeat(60));
  console.log(`Date:        ${new Date().toISOString()}`);
  console.log(`Fiscal year: FY${targetFY}${cliFiscalYear ? ' (specified)' : ' (auto-detected)'}`);
  console.log(`Mode:        ${useLocalFile ? 'Local file' : 'Download from HUD'}`);
  console.log('');

  const supabase = getSupabaseClient();
  const logger = createIngestionLogger(supabase, {
    source: SOURCE,
    tableName: HUD_FMR_TABLE,
    datasetId: `hud-fmr-fy${targetFY}`,
  });

  const geoResult: ImportGeographyResult = {
    geographyId: 'county',
    tableName: HUD_FMR_TABLE,
    status: 'failed',
    recordsInserted: 0,
    recordsFailed: 0,
    totalRowsLoaded: 0,
    rowsSkippedByMapping: 0,
    latestPeriodDate: null,
    errors: [],
    durationMs: 0,
  };

  try {
    await logger.start(0);

    // Step 1: Load data (local file or download with URL fallback)
    let rawRows: Record<string, string>[];

    if (useLocalFile) {
      const localPath = buildFmrLocalPath(targetFY);
      console.log(`Loading local file: data/${localPath}`);
      try {
        const loadResult = await loadDataFile({ localPath, format: 'xlsx' });
        rawRows = loadResult.rows;
      } catch (err) {
        throw new Error(
          `Failed to load local file at data/${localPath}. ` +
          `Ensure the file exists or run without --local to download from HUD. ` +
          `Original error: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    } else {
      console.log(`Downloading FY${targetFY} FMR data from HUD...`);
      let buffer = await downloadFmrWithFallback(targetFY);

      // Fallback to previous FY if current FY not yet available
      if (!buffer && !cliFiscalYear && targetFY === currentFY) {
        console.log(`\nFY${targetFY} not available, trying FY${targetFY - 1}...`);
        buffer = await downloadFmrWithFallback(targetFY - 1);
      }

      if (!buffer) {
        const errorMessage = `Could not download HUD FMR data for FY${targetFY}. ` +
          `Visit https://www.huduser.gov/portal/datasets/fmr.html for manual download.`;
        throw new Error(errorMessage);
      }

      // Parse XLSX buffer using the shared csv-loader's XLSX parser
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      rawRows = XLSX.utils.sheet_to_json<Record<string, string>>(firstSheet, { raw: false });
    }

    console.log(`  Raw rows loaded: ${rawRows.length}`);
    geoResult.totalRowsLoaded = rawRows.length;

    // Step 2: Parse and deduplicate
    console.log('Parsing and deduplicating FMR records...');
    const { records, skipped } = parseFmrRowsWithDedup(rawRows, targetFY);
    geoResult.rowsSkippedByMapping = skipped;
    console.log(`  Unique county records: ${records.length} (${skipped} skipped/duplicates)`);

    if (records.length === 0) {
      throw new Error('No valid records parsed from HUD FMR file');
    }

    // Step 3: Batch upsert
    console.log(`\nUpserting ${records.length} records into ${HUD_FMR_TABLE}...`);
    const upsertResult: BatchUpsertResult = await batchUpsert(supabase, records as unknown as Record<string, unknown>[], {
      tableName: HUD_FMR_TABLE,
      conflictKeys: HUD_FMR_CONFLICT_KEYS,
      batchSize: HUD_FMR_BATCH_SIZE,
    });

    geoResult.recordsInserted = upsertResult.inserted;
    geoResult.recordsFailed = upsertResult.failed;
    geoResult.errors = upsertResult.errors;

    // HUD FMR uses year rather than period_date; store as YYYY-10-01 (FY start)
    geoResult.latestPeriodDate = `${targetFY - 1}-10-01`;

    // Determine status
    if (upsertResult.failed === 0 && upsertResult.inserted > 0) {
      geoResult.status = 'success';
    } else if (upsertResult.inserted > 0 && upsertResult.failed > 0) {
      geoResult.status = 'partial';
    }

    await logger.complete({
      recordsProcessed: records.length,
      recordsSuccess: upsertResult.inserted,
      recordsError: upsertResult.failed,
      errors: upsertResult.errors,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    geoResult.errors.push(message);
    console.error(`FATAL: ${message}`);
    await logger.fail(message);
  }

  geoResult.durationMs = Date.now() - overallStart;

  // Build aggregated result for summary + backend reporting
  const sourceResult: ImportSourceResult = {
    source: SOURCE,
    geographies: [geoResult],
    overallStatus: geoResult.status === 'success' ? 'success'
      : geoResult.status === 'partial' ? 'partial' : 'failed',
    totalInserted: geoResult.recordsInserted,
    totalFailed: geoResult.recordsFailed,
    totalDurationMs: geoResult.durationMs,
  };

  printSummaryBanner(sourceResult);
  await reportStatusToBackend(sourceResult);

  if (geoResult.recordsFailed > 0 || geoResult.status === 'failed') {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
