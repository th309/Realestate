/**
 * Redfin S3 Market Tracker Sales Import Pipeline
 *
 * Downloads gzipped TSV files from Redfin's public S3 bucket, parses them,
 * and upserts into per-geography Supabase tables (redfin_national through
 * redfin_neighborhood).
 *
 * Small files (national, state, metro): loaded entirely into memory.
 * Large files (county, city, zip, neighborhood): streamed and batch-processed.
 *
 * Usage:
 *   npx tsx scripts/redfin-sales-import/import-redfin-sales.ts
 *   npx tsx scripts/redfin-sales-import/import-redfin-sales.ts --geo=metro
 *   npx tsx scripts/redfin-sales-import/import-redfin-sales.ts --geo=metro --geo=county
 *   npx tsx scripts/redfin-sales-import/import-redfin-sales.ts --geo=zip --limit=1000
 */

import {
  loadEnv,
  createSupabaseAdminClient,
  testConnection,
} from "./db-client";
import { importDataset } from "./dataset-importer";
import { initCountyFipsLookup } from "./county-fips-lookup";
import type { RedfinGeoLevel, ImportResult } from "./types";
import { REDFIN_S3_DATASETS } from "./types";

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

interface CliOptions {
  geoFilters: RedfinGeoLevel[];
  rowLimit?: number;
}

function parseCliArgs(): CliOptions {
  const args = process.argv.slice(2);
  const options: CliOptions = { geoFilters: [] };
  const validLevels: RedfinGeoLevel[] = [
    "national",
    "state",
    "metro",
    "county",
    "city",
    "zip",
    "neighborhood",
  ];

  for (const arg of args) {
    if (arg.startsWith("--geo=")) {
      const value = arg.split("=")[1] as RedfinGeoLevel;
      if (!validLevels.includes(value)) {
        console.error(
          `Invalid --geo value: ${value}. Valid options: ${validLevels.join(", ")}`,
        );
        process.exit(1);
      }
      options.geoFilters.push(value);
    } else if (arg.startsWith("--limit=")) {
      const value = parseInt(arg.split("=")[1], 10);
      if (isNaN(value) || value <= 0) {
        console.error(
          `Invalid --limit value: ${arg.split("=")[1]}. Must be a positive integer.`,
        );
        process.exit(1);
      }
      options.rowLimit = value;
    } else if (arg.startsWith("--batch=")) {
      console.error(
        "Manual --batch override is disabled. This importer auto-selects batch sizes (max 5000) per geography.",
      );
      process.exit(1);
    } else if (arg === "--help" || arg === "-h") {
      console.log(`
Redfin S3 Market Tracker Sales Import

Usage:
  npx tsx scripts/redfin-sales-import/import-redfin-sales.ts [options]

Options:
  --geo=<level>    Import specific geography level(s) (supports multiple)
                   Valid: national, state, metro, county, city, zip, neighborhood
  --limit=<N>      Limit rows per dataset (for testing)
  --help, -h       Show this help message
`);
      process.exit(0);
    }
  }

  return options;
}

// ---------------------------------------------------------------------------
// Main orchestrator
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log("=".repeat(70));
  console.log("  Redfin S3 Market Tracker Sales Import");
  console.log("=".repeat(70));

  // 1. Load env and parse CLI
  loadEnv();
  const options = parseCliArgs();

  if (options.geoFilters.length > 0) {
    console.log(`  Geo filter: ${options.geoFilters.join(", ")}`);
  }
  if (options.rowLimit) {
    console.log(`  Row limit: ${options.rowLimit}`);
  }

  // 2. Load county FIPS lookup (used by parser for county-level imports)
  initCountyFipsLookup();

  // 3. Create Supabase client and test connection
  const supabase = createSupabaseAdminClient();
  const connected = await testConnection(supabase);
  if (!connected) {
    console.error("  Aborting: database connection failed.");
    process.exit(1);
  }

  // 4. Determine which datasets to import
  let datasets = REDFIN_S3_DATASETS;
  if (options.geoFilters.length > 0) {
    datasets = datasets.filter((d) => options.geoFilters.includes(d.geoLevel));
  }

  console.log(`\n  Importing ${datasets.length} dataset(s)\n`);

  // 5. Import each dataset sequentially
  const results: ImportResult[] = [];

  for (const [index, dataset] of datasets.entries()) {
    console.log(
      `\n[${index + 1}/${datasets.length}] ${dataset.geoLevel.toUpperCase()} -> ${dataset.tableName}`,
    );
    console.log("-".repeat(50));

    const result = await importDataset(supabase, dataset, options.rowLimit);
    results.push(result);

    console.log(
      `  Done: ${result.inserted.toLocaleString()} inserted, ${result.errors} errors, ${(result.durationMs / 1000).toFixed(1)}s`,
    );

    // Brief pause between datasets to avoid overwhelming the API
    if (index < datasets.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  // 6. Print summary
  console.log("\n" + "=".repeat(70));
  console.log("  Import Summary");
  console.log("=".repeat(70));
  console.log("");

  const totalInserted = results.reduce((sum, r) => sum + r.inserted, 0);
  const totalErrors = results.reduce((sum, r) => sum + r.errors, 0);
  const totalDuration = results.reduce((sum, r) => sum + r.durationMs, 0);

  for (const result of results) {
    const status = result.errors > 0 ? "ERRORS" : "OK";
    console.log(
      `  ${result.geoLevel.padEnd(14)} | ${result.tableName.padEnd(22)} | ` +
        `${result.totalRows.toLocaleString().padStart(10)} rows | ` +
        `${result.inserted.toLocaleString().padStart(10)} inserted | ` +
        `${(result.durationMs / 1000).toFixed(1).padStart(6)}s | ${status}`,
    );
  }

  console.log("");
  console.log(
    `  Total: ${totalInserted.toLocaleString()} inserted, ${totalErrors} errors, ${(totalDuration / 1000).toFixed(1)}s`,
  );
  console.log("=".repeat(70));

  if (totalErrors > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
