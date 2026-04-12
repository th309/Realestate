#!/usr/bin/env npx tsx
/**
 * Census & Economic unified data import entry point.
 *
 * Fetches data from 4 APIs (Census ACS, BEA, FRED, BLS) and upserts
 * into census_* and economic_* database tables.
 *
 * Usage:
 *   npx tsx scripts/sources/census-economic/import-census-economic.ts
 *   npx tsx scripts/sources/census-economic/import-census-economic.ts --census
 *   npx tsx scripts/sources/census-economic/import-census-economic.ts --economic
 *   npx tsx scripts/sources/census-economic/import-census-economic.ts --quick
 *   npx tsx scripts/sources/census-economic/import-census-economic.ts --recent 6
 */

import type { IngestionSource } from "../../utils/ingestion-logger";
import { computeDateCutoff } from "../../lib";
import {
  CENSUS_YEARS_FULL,
  CENSUS_YEARS_QUICK,
  CENSUS_TABLES,
} from "./census-economic-config";
import {
  fetchCensusNational,
  fetchCensusStates,
  fetchCensusMetros,
  fetchCensusCounties,
  fetchCensusCities,
  fetchCensusZips,
} from "./census-api-client";
import { upsertWithLogging } from "./census-economic-upsert";
import { importAllEconomicData } from "./economic-importer";

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const hasCensusFlag = args.includes("--census");
const hasEconomicFlag = args.includes("--economic");
// If neither --census nor --economic is specified, import both by default.
// This prevents unrelated flags (e.g. --quick) from accidentally disabling imports.
const importCensus = hasCensusFlag || !hasEconomicFlag;
const importEconomic = hasEconomicFlag || !hasCensusFlag;
const quickMode = args.includes("--quick");

function parseArgValue(flag: string): string | null {
  const eqArg = args.find((a) => a.startsWith(`${flag}=`));
  if (eqArg) return eqArg.split("=")[1];
  const idx = args.indexOf(flag);
  return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : null;
}

const recentMonthsRaw = parseArgValue("--recent");
const recentMonths = recentMonthsRaw
  ? parseInt(recentMonthsRaw, 10)
  : undefined;
const dateCutoff = recentMonths ? computeDateCutoff(recentMonths) : undefined;

// --recent implies --quick for Census (no point fetching years we'll discard)
const censusYears =
  quickMode || recentMonths ? CENSUS_YEARS_QUICK : CENSUS_YEARS_FULL;
const fredStartYear = recentMonths
  ? new Date().getFullYear() - 1
  : quickMode
    ? 2020
    : 2000;

// ---------------------------------------------------------------------------
// Census data import (Census ACS 5-Year)
// ---------------------------------------------------------------------------

async function importAllCensusData(): Promise<{
  inserted: number;
  failed: number;
}> {
  console.log("\n" + "=".repeat(60));
  console.log(`Importing Census ACS Data for ${censusYears.length} years`);
  console.log("=".repeat(60));

  let totalInserted = 0;
  let totalFailed = 0;

  const allNational: Record<string, unknown>[] = [];
  const allStates: Record<string, unknown>[] = [];
  const allMetros: Record<string, unknown>[] = [];
  const allCounties: Record<string, unknown>[] = [];
  const allCities: Record<string, unknown>[] = [];
  const allZips: Record<string, unknown>[] = [];

  for (const year of censusYears) {
    console.log(`\n--- Census ACS Year ${year} ---`);
    allNational.push(...(await fetchCensusNational(year)));
    allStates.push(...(await fetchCensusStates(year)));
    allMetros.push(...(await fetchCensusMetros(year)));
    allCounties.push(...(await fetchCensusCounties(year)));
    allCities.push(...(await fetchCensusCities(year)));
    allZips.push(...(await fetchCensusZips(year)));
  }

  const geoData: Array<{
    records: Record<string, unknown>[];
    geo: string;
    source: IngestionSource;
  }> = [
    { records: allNational, geo: "national", source: "census" },
    { records: allStates, geo: "state", source: "census" },
    { records: allMetros, geo: "metro", source: "census" },
    { records: allCounties, geo: "county", source: "census" },
    { records: allCities, geo: "city", source: "census" },
    { records: allZips, geo: "zip", source: "census" },
  ];

  for (const { records, geo, source } of geoData) {
    const table = CENSUS_TABLES[geo];
    const result = await upsertWithLogging({
      source,
      tableName: table.tableName,
      conflictKeys: table.conflictKeys,
      datasetId: `census-${geo}`,
      records,
    });
    totalInserted += result.inserted;
    totalFailed += result.failed;
  }

  return { inserted: totalInserted, failed: totalFailed };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const startTime = Date.now();

  console.log("Census & Economic Unified Data Import");
  console.log("=".repeat(60));
  console.log(`Date:   ${new Date().toISOString()}`);
  console.log(`Mode:   ${quickMode ? "QUICK (2 years)" : "FULL HISTORICAL"}`);
  if (dateCutoff) console.log(`Recent: cutoff ${dateCutoff}`);
  console.log(`Census: ${importCensus ? "YES" : "SKIP"}`);
  console.log(`Econ:   ${importEconomic ? "YES" : "SKIP"}`);
  console.log("");

  let totalInserted = 0;
  let totalFailed = 0;

  if (importCensus) {
    const census = await importAllCensusData();
    totalInserted += census.inserted;
    totalFailed += census.failed;
  }

  if (importEconomic) {
    const econ = await importAllEconomicData(fredStartYear, dateCutoff);
    totalInserted += econ.inserted;
    totalFailed += econ.failed;
  }

  const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  console.log("\n" + "=".repeat(60));
  console.log("  CENSUS & ECONOMIC IMPORT COMPLETE");
  console.log("=".repeat(60));
  console.log(`  Total inserted: ${totalInserted}`);
  console.log(`  Total failed:   ${totalFailed}`);
  console.log(`  Duration:       ${duration} minutes`);
  console.log("=".repeat(60));

  if (totalFailed > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
