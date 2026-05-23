#!/usr/bin/env npx tsx
/**
 * Redfin Data Center importer.
 *
 * Usage:
 *   npx tsx scripts/sources/redfin-data-center/import-redfin-dc.ts
 *   npx tsx scripts/sources/redfin-data-center/import-redfin-dc.ts --dashboard price_drops
 *   npx tsx scripts/sources/redfin-data-center/import-redfin-dc.ts --dashboard housing_market --geo metro
 *   npx tsx scripts/sources/redfin-data-center/import-redfin-dc.ts --full
 */

import { parse as csvParse } from "csv-parse/sync";
import { getSupabaseClient } from "../../lib/db-client";
import { batchUpsert } from "../../lib/batch-upsert";
import { downloadFromUrl } from "../../lib/csv-loader";
import {
  getIncrementalCutoff,
  parseIncrementalFlagsFromArgv,
} from "../../lib/incremental-cutoff";
import {
  printSummaryBanner,
  reportStatusToBackend,
} from "../../lib/import-reporter";
import type {
  ImportGeographyResult,
  ImportSourceResult,
} from "../../lib/types";
import { createIngestionLogger } from "../../utils/ingestion-logger";
import {
  ALL_DASHBOARD_IDS,
  getDashboard,
  getKnownColumns,
  type GeoTarget,
  type DashboardConfig,
} from "./redfin-dc-config";
import { fetchIndex, resolveCsvUrl } from "./redfin-dc-index-fetcher";
import { processRows } from "./redfin-dc-csv-processor";
import { runMonthsOfSupplyHook } from "./redfin-dc-mos-hook";

const UPSERT_BATCH_SIZE = 1000;

function argValue(flag: string): string | null {
  const argv = process.argv.slice(2);
  const eq = argv.find((a) => a.startsWith(`${flag}=`));
  if (eq) return eq.split("=")[1];
  const i = argv.indexOf(flag);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : null;
}

async function importGeo(
  supabase: ReturnType<typeof getSupabaseClient>,
  index: Record<string, unknown>,
  dash: DashboardConfig,
  geoLevel: string,
  target: GeoTarget,
  dateCutoff: string | null,
  rowLimit: number | undefined,
): Promise<ImportGeographyResult> {
  const start = Date.now();
  const dashboardId = dash.id;
  const result: ImportGeographyResult = {
    geographyId: `${dashboardId}/${geoLevel}`,
    tableName: target.table,
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
    const url = resolveCsvUrl(index, dash.indexKey, geoLevel, target.path);
    console.log(`\n--- ${dashboardId}/${geoLevel} -> ${target.table} ---`);
    const buf = await downloadFromUrl(url);
    let rows = csvParse(buf, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    }) as Record<string, string>[];
    result.totalRowsLoaded = rows.length;
    if (rowLimit) rows = rows.slice(0, rowLimit);
    if (dateCutoff) {
      rows = rows.filter((r) => {
        const pe = (r["PERIOD END"] ?? r["period end"] ?? "").trim();
        return !pe || pe >= dateCutoff;
      });
    }

    const knownColumns = getKnownColumns(dash, target);
    const { records, skipped, latestPeriodEnd } = await processRows(
      supabase,
      rows,
      geoLevel,
      target,
      knownColumns,
    );
    result.rowsSkippedByMapping = skipped;
    result.latestPeriodDate = latestPeriodEnd;

    const up = await batchUpsert(supabase, records, {
      tableName: target.table,
      conflictKeys: target.conflictKeys,
      batchSize: UPSERT_BATCH_SIZE,
    });
    result.recordsInserted = up.inserted;
    result.recordsFailed = up.failed;
    result.errors.push(...up.errors);
    result.status =
      up.failed === 0 && up.inserted > 0
        ? "success"
        : up.inserted > 0
          ? "partial"
          : "failed";
  } catch (err) {
    result.errors.push(err instanceof Error ? err.message : String(err));
    result.status = "failed";
    console.error(
      `  FATAL ${dashboardId}/${geoLevel}: ${result.errors.at(-1)}`,
    );
  }

  result.durationMs = Date.now() - start;
  return result;
}

async function main(): Promise<void> {
  const startTime = Date.now();
  const supabase = getSupabaseClient();
  const flags = parseIncrementalFlagsFromArgv();
  const dateCutoff = getIncrementalCutoff({ frequency: "monthly", ...flags });
  const rowLimit = argValue("--limit")
    ? parseInt(argValue("--limit")!, 10)
    : undefined;

  const dashboardFilter = argValue("--dashboard");
  const geoFilter = argValue("--geo");
  const dashboardIds = dashboardFilter ? [dashboardFilter] : ALL_DASHBOARD_IDS;

  const index = await fetchIndex();
  const geoResults: ImportGeographyResult[] = [];
  let housingMarketImported = false;

  for (const id of dashboardIds) {
    const dash = getDashboard(id);
    const logger = createIngestionLogger(supabase, {
      source: "redfin",
      tableName: `redfin_dc_${id}`,
      datasetId: `redfin-dc-${id}`,
    });
    await logger.start(0);
    const geoKeys = geoFilter ? [geoFilter] : Object.keys(dash.geos);
    for (const geoLevel of geoKeys) {
      const target = dash.geos[geoLevel];
      if (!target) continue;
      const r = await importGeo(
        supabase,
        index,
        dash,
        geoLevel,
        target,
        dateCutoff,
        rowLimit,
      );
      geoResults.push(r);
    }
    if (id === "housing_market") housingMarketImported = true;
    await logger.complete({
      recordsProcessed: geoResults.reduce(
        (s, g) => s + g.recordsInserted + g.recordsFailed,
        0,
      ),
      recordsSuccess: geoResults.reduce((s, g) => s + g.recordsInserted, 0),
      recordsError: geoResults.reduce((s, g) => s + g.recordsFailed, 0),
      errors: [],
    });
  }

  if (housingMarketImported) {
    try {
      await runMonthsOfSupplyHook(supabase);
    } catch (err) {
      console.warn(
        `  [redfin-dc] MoS hook failed (non-fatal): ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  const totalInserted = geoResults.reduce((s, g) => s + g.recordsInserted, 0);
  const totalFailed = geoResults.reduce((s, g) => s + g.recordsFailed, 0);
  const allOk = geoResults.every(
    (g) => g.status === "success" || g.status === "skipped",
  );
  const anyOk = geoResults.some(
    (g) => g.status === "success" || g.status === "partial",
  );
  const overallStatus = allOk ? "success" : anyOk ? "partial" : "failed";

  const sourceResult: ImportSourceResult = {
    source: "redfin",
    geographies: geoResults,
    overallStatus,
    totalInserted,
    totalFailed,
    totalDurationMs: Date.now() - startTime,
  };
  printSummaryBanner(sourceResult);
  await reportStatusToBackend(sourceResult);
  if (overallStatus === "failed") process.exit(1);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
