#!/usr/bin/env npx tsx
/**
 * Realtor.com unified data import entry point.
 *
 * Imports all 5 geography levels: national, state, metro, county, zip.
 * National and state use the shared runSourceImport() directly.
 * Metro, county, and zip require merging core + hotness CSVs before upserting.
 *
 * Usage:
 *   npx tsx scripts/sources/realtor/import-realtor.ts              # Download current month
 *   npx tsx scripts/sources/realtor/import-realtor.ts --history    # Load from local history files
 *   npx tsx scripts/sources/realtor/import-realtor.ts --geo metro  # Single geography only
 *   npx tsx scripts/sources/realtor/import-realtor.ts --recent 6   # Only last 6 months
 */

import {
  getSupabaseClient,
  runSourceImport,
  getIncrementalCutoff,
  parseIncrementalFlagsFromArgv,
} from "../../lib";
import type { ImportSourceResult } from "../../lib";
import { refreshCalculatedMetrics } from "../../utils/refresh-calculated-metrics";
import { buildNationalStateConfig } from "./realtor-config";
import {
  buildMergeGeographies,
  importMergeGeography,
} from "./realtor-merge-importer";

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const useHistory = args.includes("--history");

function parseArgValue(flag: string): string | null {
  const eqArg = args.find((a) => a.startsWith(`${flag}=`));
  if (eqArg) return eqArg.split("=")[1];
  const idx = args.indexOf(flag);
  return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : null;
}

const geoFilter = parseArgValue("--geo");
const incrementalFlags = parseIncrementalFlagsFromArgv();

const VALID_GEOS = ["national", "state", "metro", "county", "zip"];
if (geoFilter && !VALID_GEOS.includes(geoFilter)) {
  console.error(
    `Invalid geography: "${geoFilter}". Valid: ${VALID_GEOS.join(", ")}`,
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const startTime = Date.now();

  console.log("Realtor.com Unified Data Import");
  console.log("=".repeat(60));
  console.log(`Date:    ${new Date().toISOString()}`);
  console.log(
    `Mode:    ${useHistory ? "Local history files" : "Download current month"}`,
  );
  console.log(`Filter:  ${geoFilter || "all geographies"}`);

  // Default to monthly incremental; pass `--full` for a backfill.
  const dateCutoff =
    getIncrementalCutoff({ frequency: "monthly", ...incrementalFlags }) ??
    undefined;
  console.log(
    `Mode:    ${incrementalFlags.fullLoad ? "FULL backfill" : `incremental (cutoff: ${dateCutoff})`}`,
  );
  console.log("");

  let totalInserted = 0;
  let totalFailed = 0;
  const allErrors: string[] = [];

  // Phase 1: National + State (no merge needed, use runSourceImport)
  const simpleGeos = ["national", "state"];
  const shouldRunSimple = !geoFilter || simpleGeos.includes(geoFilter);

  if (shouldRunSimple) {
    const config = buildNationalStateConfig(useHistory);
    if (dateCutoff) config.dateCutoff = dateCutoff;
    if (geoFilter)
      config.geographies = config.geographies.filter((g) => g.id === geoFilter);

    if (config.geographies.length > 0) {
      const result: ImportSourceResult = await runSourceImport(config);
      totalInserted += result.totalInserted;
      totalFailed += result.totalFailed;
      for (const geo of result.geographies) allErrors.push(...geo.errors);
    }
  }

  // Phase 2: Metro + County + Zip (core+hotness merge)
  const mergeGeos = buildMergeGeographies(useHistory);
  const filteredMergeGeos = geoFilter
    ? mergeGeos.filter((g) => g.id === geoFilter)
    : mergeGeos;

  for (const spec of filteredMergeGeos) {
    const result = await importMergeGeography(spec, useHistory, dateCutoff);
    totalInserted += result.recordsInserted;
    totalFailed += result.recordsFailed;
    allErrors.push(...result.errors);
  }

  // Phase 3: Post-import hooks (refresh calculated metrics)
  if (!geoFilter) {
    console.log("\nRefreshing calculated metrics...");
    const supabase = getSupabaseClient();
    await refreshCalculatedMetrics(supabase);
  }

  // Summary
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log("\n" + "=".repeat(60));
  console.log("  REALTOR.COM IMPORT COMPLETE");
  console.log("=".repeat(60));
  console.log(`  Total inserted: ${totalInserted}`);
  console.log(`  Total failed:   ${totalFailed}`);
  console.log(`  Duration:       ${duration}s`);
  if (allErrors.length > 0) {
    console.log(`  Errors (${allErrors.length}):`);
    allErrors.slice(0, 5).forEach((e) => console.log(`    - ${e}`));
  }
  console.log("=".repeat(60));

  if (totalFailed > 0) process.exit(1);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
