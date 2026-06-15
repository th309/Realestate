#!/usr/bin/env npx tsx
/**
 * Prints a compact one-line JSON map of the latest ACTUAL data period per key
 * source table. Used by the weekly data pipeline to decide whether new data
 * actually landed: incremental upserts re-write the last few months every run,
 * so row-counts are NOT a reliable "new data" signal — only an advancing period
 * date is. Read-only. Requires SUPABASE_URL + SUPABASE_SERVICE_KEY in env.
 *
 *   npx tsx scripts/lib/latest-periods.ts   ->  {"zillow_county":"2026-04-30",...}
 *
 * NOTE: zillow_metro / zillow_zip are deliberately EXCLUDED — they hold Zillow
 * ZHVF forecast rows dated to year-end, so their MAX(period_date) is pinned in
 * the future and never moves when a new actual month arrives. zillow_county is
 * forecast-free and advances on the same monthly cadence, so it is the clean
 * Zillow bellwether.
 */
import { getSupabaseClient } from "./db-client";

// table -> date column. Forecast-free bellwethers only.
const TABLES: Record<string, string> = {
  zillow_county: "period_date", // clean Zillow signal (metro/zip have forecasts)
  realtor_metro: "period_date",
  realtor_county: "period_date",
  realtor_zip: "period_date",
  calculated_metrics: "period_date",
  propertyiq_scores_v2: "score_date",
};

async function main(): Promise<void> {
  const supabase = getSupabaseClient();
  const out: Record<string, string | null> = {};

  for (const [table, col] of Object.entries(TABLES)) {
    const { data, error } = await supabase
      .from(table)
      .select(col)
      .order(col, { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      // A probe failure must not be silently treated as "no new data" — surface
      // it so the caller can decide. We null the entry and let the diff logic
      // (any change => refresh) handle it conservatively.
      console.error(`  probe: ${table} -> ${error.message}`);
      out[table] = null;
    } else {
      out[table] = (data as Record<string, string> | null)?.[col] ?? null;
    }
  }

  // Single line so a GitHub Actions step can capture it as an output.
  console.log(JSON.stringify(out));
}

main().catch((e) => {
  console.error("latest-periods probe failed:", e?.message ?? e);
  process.exit(1);
});
