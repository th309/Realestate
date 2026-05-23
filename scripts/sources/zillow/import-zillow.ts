#!/usr/bin/env npx tsx
/**
 * Zillow unified data import entry point.
 *
 * Downloads and imports all Zillow research datasets across all geography levels.
 * Handles the wide-to-long CSV transposition that Zillow's date-as-column format requires.
 *
 * Usage:
 *   npx tsx scripts/sources/zillow/import-zillow.ts                      # All datasets
 *   npx tsx scripts/sources/zillow/import-zillow.ts --geo metro          # Single geography
 *   npx tsx scripts/sources/zillow/import-zillow.ts --metric zhvi        # Single metric
 *   npx tsx scripts/sources/zillow/import-zillow.ts --dataset zhvi-state # Single dataset
 */

import {
  getSupabaseClient,
  loadDataFile,
  batchUpsert,
  getIncrementalCutoff,
  parseIncrementalFlagsFromArgv,
} from "../../lib";
import type { ImportGeographyResult, BatchUpsertResult } from "../../lib";
import { createIngestionLogger } from "../../utils/ingestion-logger";
import {
  ALL_ZILLOW_DATASETS,
  ZILLOW_TABLES,
  transposeAllRows,
} from "./zillow-config";
import type { ZillowDatasetConfig, ZillowGeography } from "./zillow-config";
import { findLatestDate, printZillowSummary } from "./zillow-summary";

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

const cliArgs = process.argv.slice(2);

/** Parse a CLI flag value supporting both --flag value and --flag=value formats. */
function getArgValue(flag: string): string | null {
  const eqArg = cliArgs.find((a) => a.startsWith(`${flag}=`));
  if (eqArg) return eqArg.split("=")[1];
  const idx = cliArgs.indexOf(flag);
  return idx !== -1 && idx + 1 < cliArgs.length ? cliArgs[idx + 1] : null;
}

const geoFilter = getArgValue("--geo") as ZillowGeography | null;
const metricFilter = getArgValue("--metric");
const datasetFilter = getArgValue("--dataset");
const incrementalFlags = parseIncrementalFlagsFromArgv();

const VALID_GEOS: ZillowGeography[] = ["state", "metro", "county", "zip"];
if (geoFilter && !VALID_GEOS.includes(geoFilter)) {
  console.error(
    `Invalid geography: "${geoFilter}". Valid: ${VALID_GEOS.join(", ")}`,
  );
  process.exit(1);
}

const BATCH_SIZE = 5000;

// ---------------------------------------------------------------------------
// Filter datasets based on CLI arguments
// ---------------------------------------------------------------------------

function filterDatasets(
  datasets: ZillowDatasetConfig[],
): ZillowDatasetConfig[] {
  let filtered = datasets;
  if (datasetFilter) filtered = filtered.filter((d) => d.id === datasetFilter);
  if (geoFilter) filtered = filtered.filter((d) => d.geography === geoFilter);
  if (metricFilter)
    filtered = filtered.filter((d) => d.metricName === metricFilter);
  return filtered;
}

// ---------------------------------------------------------------------------
// Import a single Zillow dataset (download -> transpose -> upsert)
// ---------------------------------------------------------------------------

async function importSingleDataset(
  dataset: ZillowDatasetConfig,
): Promise<ImportGeographyResult> {
  const startMs = Date.now();
  const supabase = getSupabaseClient();
  const tableConfig = ZILLOW_TABLES[dataset.geography];

  const logger = createIngestionLogger(supabase, {
    source: "zillow",
    tableName: tableConfig.tableName,
    metricName: dataset.metricName,
    datasetId: dataset.id,
  });

  const result: ImportGeographyResult = {
    geographyId: dataset.id,
    tableName: tableConfig.tableName,
    status: "failed",
    recordsInserted: 0,
    recordsFailed: 0,
    totalRowsLoaded: 0,
    rowsSkippedByMapping: 0,
    latestPeriodDate: null,
    errors: [],
    durationMs: 0,
  };

  try {
    console.log(
      `\n--- Importing ${dataset.id} -> ${tableConfig.tableName} [${dataset.metricName}] ---`,
    );
    console.log(`  ${dataset.description}`);
    await logger.start(0);

    // Step 1: Download CSV
    const loadResult = await loadDataFile({ url: dataset.url, format: "csv" });
    result.totalRowsLoaded = loadResult.rowCount;

    if (loadResult.rowCount === 0) {
      console.log("  No rows loaded, skipping.");
      result.status = "skipped";
      result.durationMs = Date.now() - startMs;
      return result;
    }

    // Step 2: Transpose wide-to-long
    // Default to monthly incremental; pass `--full` for a backfill.
    const dateCutoff =
      getIncrementalCutoff({ frequency: "monthly", ...incrementalFlags }) ??
      undefined;
    const { records, rowsSkipped } = transposeAllRows(
      loadResult.rows,
      dataset.metricName,
      dataset.geography,
      { allowZeroValues: dataset.allowZeroValues, dateCutoff },
    );
    result.rowsSkippedByMapping = rowsSkipped;
    console.log(
      `  Transposed: ${loadResult.rowCount} rows -> ${records.length} records (${rowsSkipped} rows skipped)`,
    );

    if (records.length === 0) {
      console.log("  No valid records after transposition, skipping.");
      result.status = "skipped";
      result.durationMs = Date.now() - startMs;
      return result;
    }

    await logger.updateProgress(0, 0);

    // Step 3: Batch upsert
    const upsertResult: BatchUpsertResult = await batchUpsert(
      supabase,
      records,
      {
        tableName: tableConfig.tableName,
        conflictKeys: [...tableConfig.conflictKeys],
        batchSize: BATCH_SIZE,
        onProgress: (inserted, failed) => {
          logger.updateProgress(inserted, failed);
        },
      },
    );

    result.recordsInserted = upsertResult.inserted;
    result.recordsFailed = upsertResult.failed;
    result.errors = upsertResult.errors;

    // Step 4: Find latest period date
    result.latestPeriodDate = findLatestDate(records);

    // Step 5: Determine status
    if (upsertResult.failed === 0 && upsertResult.inserted > 0) {
      result.status = "success";
    } else if (upsertResult.inserted > 0 && upsertResult.failed > 0) {
      result.status = "partial";
    } else {
      result.status = "failed";
    }

    // Step 6: Complete ingestion log
    await logger.complete({
      recordsProcessed: records.length,
      recordsSuccess: upsertResult.inserted,
      recordsError: upsertResult.failed,
      errors: upsertResult.errors,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    result.errors.push(message);
    result.status = "failed";
    console.error(`  FATAL error importing ${dataset.id}: ${message}`);
    await logger.fail(message);
  }

  result.durationMs = Date.now() - startMs;
  return result;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const startTime = Date.now();

  console.log("Zillow Unified Data Import");
  console.log("=".repeat(60));
  console.log(`Date:    ${new Date().toISOString()}`);
  console.log(
    `Filter:  geo=${geoFilter || "all"} metric=${metricFilter || "all"} dataset=${datasetFilter || "all"}`,
  );
  console.log(
    `Mode:    ${incrementalFlags.fullLoad ? "FULL backfill" : `incremental (last ${incrementalFlags.lookbackMonthsOverride ?? 3} months)`}`,
  );

  const datasets = filterDatasets(ALL_ZILLOW_DATASETS);
  if (datasets.length === 0) {
    console.error("No datasets match the specified filters.");
    process.exit(1);
  }
  console.log(`Datasets to process: ${datasets.length}`);

  // Sort by estimated size: state < metro < county < zip
  const GEO_ORDER: Record<ZillowGeography, number> = {
    state: 0,
    metro: 1,
    county: 2,
    zip: 3,
  };
  datasets.sort((a, b) => GEO_ORDER[a.geography] - GEO_ORDER[b.geography]);

  const results: ImportGeographyResult[] = [];

  for (let i = 0; i < datasets.length; i++) {
    console.log(`\n[${i + 1}/${datasets.length}]`);
    const result = await importSingleDataset(datasets[i]);
    results.push(result);

    // Pause between datasets to avoid rate limiting
    if (i < datasets.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  printZillowSummary(results, Date.now() - startTime);

  if (results.some((r) => r.status === "failed")) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
