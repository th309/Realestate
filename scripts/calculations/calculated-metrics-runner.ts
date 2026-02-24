/**
 * Calculated Metrics Runner - Orchestrator
 *
 * Entry point that runs all calculated metric groups in sequence:
 *   1. Investment metrics (cap_rate, gross_yield, rent_to_price, grm)
 *   2. Valuation metrics (overvalued_pct, 5yr growth)
 *   3. Affordability metrics (income_to_buy, affordable_home_price, years_to_save)
 *
 * Usage:
 *   npx tsx scripts/calculations/calculated-metrics-runner.ts
 *
 * Or import the function for use as a post-import hook:
 *   import { refreshCalculatedMetrics } from './calculations/calculated-metrics-runner';
 *   await refreshCalculatedMetrics(supabase);
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from '../lib/db-client';
import { runInvestmentMetrics } from './investment-metrics';
import { runValuationMetrics } from './valuation-metrics';
import { runIncomeToBuyMetrics, runAffordableHomePriceMetrics } from './affordability-metrics';
import { runYearsToSaveMetrics } from './years-to-save-metrics';

// Re-export the RefreshResult type for consumers
export interface RefreshResult {
  investmentMetrics: { processed: number; stored: number; errors: string[]; byGeo?: Record<string, { processed: number; stored: number }> };
  overvalued: { processed: number; stored: number; errors: string[] };
  growth5YrMetros: { processed: number; stored: number };
  growth5YrStates: { processed: number; stored: number };
  incomeToBuy: { total: { processed: number; stored: number }; byGeo: Record<string, { processed: number; stored: number }> };
  affordableHomePrice: { total: { processed: number; stored: number }; byGeo: Record<string, { processed: number; stored: number }> };
  yearsToSave: { total: { processed: number; stored: number }; byGeo: Record<string, { processed: number; stored: number }> };
  totalProcessed: number;
  totalStored: number;
  duration: number;
}

/**
 * Refresh all calculated metrics.
 * Call this after any data import to update derived metrics.
 */
export async function refreshCalculatedMetrics(
  supabase: SupabaseClient,
  options: { silent?: boolean } = {},
): Promise<RefreshResult> {
  const startTime = Date.now();
  const log = options.silent ? () => {} : console.log;

  log('\nRefreshing calculated metrics...');

  // Investment + Valuation run in parallel (no dependency)
  const [investmentMetrics, valuation] = await Promise.all([
    runInvestmentMetrics(supabase),
    runValuationMetrics(supabase),
  ]);

  const { overvalued, growth5YrMetros, growth5YrStates } = valuation;

  // Affordability metrics (sequential due to shared FRED API call)
  log('   Calculating income-to-buy...');
  const incomeToBuy = await runIncomeToBuyMetrics(supabase);

  log('   Calculating affordable-home-price...');
  const affordableHomePrice = await runAffordableHomePriceMetrics(supabase);

  log('   Calculating years-to-save...');
  const yearsToSave = await runYearsToSaveMetrics(supabase);

  const duration = Date.now() - startTime;
  const totalProcessed = investmentMetrics.processed + overvalued.processed +
    growth5YrMetros.processed + growth5YrStates.processed +
    incomeToBuy.total.processed + affordableHomePrice.total.processed +
    yearsToSave.total.processed;
  const totalStored = investmentMetrics.stored + overvalued.stored +
    growth5YrMetros.stored + growth5YrStates.stored +
    incomeToBuy.total.stored + affordableHomePrice.total.stored +
    yearsToSave.total.stored;

  const fmtGeo = (geo: Record<string, { stored: number }>) =>
    Object.entries(geo).map(([g, v]) => `${g}:${v.stored}`).join(', ');

  log(`   Investment: ${investmentMetrics.stored} stored (${fmtGeo(investmentMetrics.byGeo || {})})`);
  log(`   Overvalued %: ${overvalued.stored} stored`);
  log(`   5-yr growth metros: ${growth5YrMetros.stored} | states: ${growth5YrStates.stored}`);
  log(`   Income-to-buy: ${incomeToBuy.total.stored} stored (${fmtGeo(incomeToBuy.byGeo)})`);
  log(`   Affordable-home-price: ${affordableHomePrice.total.stored} stored (${fmtGeo(affordableHomePrice.byGeo)})`);
  log(`   Years-to-save: ${yearsToSave.total.stored} stored (${fmtGeo(yearsToSave.byGeo)})`);
  log(`   Total: ${totalStored} records in ${(duration / 1000).toFixed(1)}s`);

  return {
    investmentMetrics, overvalued, growth5YrMetros, growth5YrStates,
    incomeToBuy, affordableHomePrice, yearsToSave,
    totalProcessed, totalStored, duration,
  };
}

// ---------------------------------------------------------------------------
// Standalone execution
// ---------------------------------------------------------------------------

async function main() {
  console.log('Running all calculated metrics...');
  const supabase = getSupabaseClient();
  const result = await refreshCalculatedMetrics(supabase);

  console.log('\n--- SUMMARY ---');
  console.log(`Total processed: ${result.totalProcessed}`);
  console.log(`Total stored: ${result.totalStored}`);
  console.log(`Duration: ${(result.duration / 1000).toFixed(1)}s`);
}

// Only run main when executed directly (not imported)
if (require.main === module) {
  main().catch((err) => { console.error(err); process.exit(1); });
}
