/**
 * Post-import hook: recompute months_of_supply into calculated_metrics from the
 * new-format redfin_dc_housing_market_* tables. This is the fallback the
 * PropertyIQ score uses when the legacy redfin months_of_supply column is absent
 * (so the score survives full legacy deprecation).
 *
 * MoS = active_listings / homes_sold, AGGREGATED per (region_id, period_end).
 * Aggregation matters for metro: Redfin reports metropolitan DIVISIONS (LA +
 * Anaheim) that share one CBSA region_id, so we sum their listings/sales before
 * dividing to get a single CBSA-level MoS. For other geos each (region_id,
 * period) is a single row, so the aggregation is a no-op.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { batchUpsert } from "../../lib/batch-upsert";

interface HmRow {
  region_id: string;
  period_end: string;
  active_listings: number | null;
  homes_sold: number | null;
}

/**
 * Pure transform: housing_market rows -> calculated_metrics MoS rows.
 * Sums active_listings and homes_sold per (region_id, period_end), then divides.
 * Skips groups with no active-listings data or zero/no homes sold.
 */
export function buildMosRows(
  rows: HmRow[],
  geographyType: string,
): Record<string, unknown>[] {
  interface Agg {
    region_id: string;
    period: string;
    active: number;
    homes: number;
    hasActive: boolean;
    hasHomes: boolean;
  }
  const agg = new Map<string, Agg>();
  for (const r of rows) {
    const key = `${r.region_id}|${r.period_end}`;
    let a = agg.get(key);
    if (!a) {
      a = {
        region_id: r.region_id,
        period: r.period_end,
        active: 0,
        homes: 0,
        hasActive: false,
        hasHomes: false,
      };
      agg.set(key, a);
    }
    if (r.active_listings != null) {
      a.active += Number(r.active_listings);
      a.hasActive = true;
    }
    if (r.homes_sold != null) {
      a.homes += Number(r.homes_sold);
      a.hasHomes = true;
    }
  }

  const out: Record<string, unknown>[] = [];
  for (const a of agg.values()) {
    if (!a.hasActive || !a.hasHomes || a.homes === 0) continue;
    out.push({
      geography_id: a.region_id,
      geography_type: geographyType,
      period_date: a.period,
      months_of_supply: a.active / a.homes,
    });
  }
  return out;
}

/** housing_market geo tables -> calculated_metrics geography_type. */
const GEO_TABLES: Array<{ table: string; type: string }> = [
  { table: "redfin_dc_housing_market_metro", type: "metro" },
  { table: "redfin_dc_housing_market_county", type: "county" },
  { table: "redfin_dc_housing_market_zip", type: "zip" },
  { table: "redfin_dc_housing_market_state", type: "state" },
];

/** Page size for reading housing_market rows. */
const PAGE = 1000;

/** Read all rows of a housing_market table (paged). */
async function readAll(
  supabase: SupabaseClient,
  table: string,
): Promise<HmRow[]> {
  const rows: HmRow[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select("region_id, period_end, active_listings, homes_sold")
      .range(from, from + PAGE - 1);
    if (error) {
      console.warn(`    skip ${table}: ${error.message}`);
      return rows;
    }
    if (!data || data.length === 0) break;
    rows.push(...(data as HmRow[]));
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return rows;
}

/** Recompute months_of_supply into calculated_metrics from new-format housing_market. */
export async function runMonthsOfSupplyHook(
  supabase: SupabaseClient,
): Promise<void> {
  console.log(
    "  [redfin-dc] Recomputing months_of_supply into calculated_metrics...",
  );
  let total = 0;
  for (const { table, type } of GEO_TABLES) {
    const hmRows = await readAll(supabase, table);
    const mosRows = buildMosRows(hmRows, type);
    if (mosRows.length === 0) continue;
    const up = await batchUpsert(supabase, mosRows, {
      tableName: "calculated_metrics",
      conflictKeys: ["geography_id", "geography_type", "period_date"],
      batchSize: 1000,
    });
    total += up.inserted;
    console.log(`    ${type}: ${up.inserted} MoS rows upserted`);
  }
  console.log(`  [redfin-dc] MoS recompute complete: ${total} rows.`);
}
