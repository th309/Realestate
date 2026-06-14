/**
 * Calculated Metrics Runner - Affordability Orchestrator
 *
 * Runs the affordability metric group:
 *   1. income_to_buy  (income required to qualify for median home)
 *   2. affordable_home_price  (max price at median income)
 *   3. years_to_save  (time to accumulate a down payment)
 *
 * Investment and valuation metrics are computed by the NestJS
 * CalculatedMetricsService (invoked via the backend CLI in CI).
 *
 * Usage:
 *   npx tsx scripts/calculations/calculated-metrics-runner.ts
 *
 * Or import the function for use as a post-import hook:
 *   import { refreshCalculatedMetrics } from './calculations/calculated-metrics-runner';
 *   await refreshCalculatedMetrics(supabase);
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseClient } from "../lib/db-client";
import {
  runIncomeToBuyMetrics,
  runAffordableHomePriceMetrics,
} from "./affordability-metrics";
import { runYearsToSaveMetrics } from "./years-to-save-metrics";

// Re-export the RefreshResult type for consumers
export interface RefreshResult {
  incomeToBuy: {
    total: { processed: number; stored: number };
    byGeo: Record<string, { processed: number; stored: number }>;
  };
  affordableHomePrice: {
    total: { processed: number; stored: number };
    byGeo: Record<string, { processed: number; stored: number }>;
  };
  yearsToSave: {
    total: { processed: number; stored: number };
    byGeo: Record<string, { processed: number; stored: number }>;
  };
  totalProcessed: number;
  totalStored: number;
  duration: number;
}

/**
 * Refresh affordability calculated metrics.
 * Call this after any data import to update derived affordability metrics.
 */
export async function refreshCalculatedMetrics(
  supabase: SupabaseClient,
  options: { silent?: boolean } = {},
): Promise<RefreshResult> {
  const startTime = Date.now();
  const log = options.silent ? () => {} : console.log;

  log("\nRefreshing affordability metrics...");

  // Affordability metrics run sequentially (shared FRED API call)
  log("   Calculating income-to-buy...");
  const incomeToBuy = await runIncomeToBuyMetrics(supabase);

  log("   Calculating affordable-home-price...");
  const affordableHomePrice = await runAffordableHomePriceMetrics(supabase);

  log("   Calculating years-to-save...");
  const yearsToSave = await runYearsToSaveMetrics(supabase);

  const duration = Date.now() - startTime;
  const totalProcessed =
    incomeToBuy.total.processed +
    affordableHomePrice.total.processed +
    yearsToSave.total.processed;
  const totalStored =
    incomeToBuy.total.stored +
    affordableHomePrice.total.stored +
    yearsToSave.total.stored;

  const fmtGeo = (geo: Record<string, { stored: number }>) =>
    Object.entries(geo)
      .map(([g, v]) => `${g}:${v.stored}`)
      .join(", ");

  log(
    `   Income-to-buy: ${incomeToBuy.total.stored} stored (${fmtGeo(incomeToBuy.byGeo)})`,
  );
  log(
    `   Affordable-home-price: ${affordableHomePrice.total.stored} stored (${fmtGeo(affordableHomePrice.byGeo)})`,
  );
  log(
    `   Years-to-save: ${yearsToSave.total.stored} stored (${fmtGeo(yearsToSave.byGeo)})`,
  );
  log(`   Total: ${totalStored} records in ${(duration / 1000).toFixed(1)}s`);

  return {
    incomeToBuy,
    affordableHomePrice,
    yearsToSave,
    totalProcessed,
    totalStored,
    duration,
  };
}

// ---------------------------------------------------------------------------
// Standalone execution
// ---------------------------------------------------------------------------

async function main() {
  console.log("Running all calculated metrics...");
  const supabase = getSupabaseClient();
  const result = await refreshCalculatedMetrics(supabase);

  console.log("\n--- SUMMARY ---");
  console.log(`Total processed: ${result.totalProcessed}`);
  console.log(`Total stored: ${result.totalStored}`);
  console.log(`Duration: ${(result.duration / 1000).toFixed(1)}s`);
}

// Only run main when executed directly (not imported)
if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
