/**
 * Direct Supabase queries used by ContentDataService for top-cashflow-markets
 * lookups. These live outside the service class to keep the facade small and
 * to make the queries independently testable.
 *
 * Score-mover queries (top movers, per-market context) now live in
 * score-mover-context.queries.ts.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { CashflowMarketItem } from './content-data.types';

export type ScoringGeo = 'metro' | 'county' | 'zip';

interface ZillowMetroRow {
  cbsa_code: string;
  region_name: string;
  value: number;
  period_date: string;
}

/**
 * Fetch the latest row per CBSA for a given zillow_metro metric_name.
 * Batches the .in() filter to stay within PostgREST URL limits.
 */
export async function fetchLatestZillowMetroMetric(
  client: SupabaseClient,
  metricName: string,
  cbsaCodes: string[],
): Promise<ZillowMetroRow[]> {
  const BATCH = 500;
  const latestByCbsa = new Map<string, ZillowMetroRow>();
  for (let i = 0; i < cbsaCodes.length; i += BATCH) {
    const batch = cbsaCodes.slice(i, i + BATCH);
    const { data } = await client
      .from('zillow_metro')
      .select('cbsa_code, region_name, value, period_date')
      .eq('metric_name', metricName)
      .in('cbsa_code', batch)
      .order('period_date', { ascending: false });
    for (const row of data ?? []) {
      const r = row as ZillowMetroRow;
      if (!latestByCbsa.has(r.cbsa_code)) latestByCbsa.set(r.cbsa_code, r);
    }
  }
  return [...latestByCbsa.values()];
}

/**
 * Compute the top N metros by rent-to-price ratio within a state.
 *
 * Assumptions:
 * - Only 'metro' is supported currently (caller must check).
 * - Rent-to-price = (annual ZORI) / ZHVI.
 * - CBSAs are derived from the geographies table's county rows (each
 *   county row carries its parent cbsa_code).
 */
export async function fetchTopCashflowMarkets(
  client: SupabaseClient,
  state: string,
  limit: number,
): Promise<CashflowMarketItem[]> {
  const stateCode = state.toUpperCase();

  // 1. Get all metro CBSA codes that intersect the state.
  const { data: metros } = await client
    .from('geographies')
    .select('cbsa_code')
    .eq('geography_type', 'county')
    .eq('state_code', stateCode)
    .not('cbsa_code', 'is', null);
  const cbsaCodes = [
    ...new Set((metros ?? []).map((r: { cbsa_code: string }) => r.cbsa_code)),
  ];
  if (cbsaCodes.length === 0) return [];

  // 2. Fetch the latest ZHVI and ZORI row per CBSA in parallel.
  const [zhviRows, zoriRows] = await Promise.all([
    fetchLatestZillowMetroMetric(client, 'zhvi', cbsaCodes),
    fetchLatestZillowMetroMetric(client, 'zori', cbsaCodes),
  ]);
  const zoriByCbsa = new Map(zoriRows.map((r) => [r.cbsa_code, r]));

  // 3. Compute rent-to-price ratios, sort descending, rank.
  const items: Array<{
    cbsa: string;
    region_name: string;
    home_value: number;
    rent: number;
    rent_to_price_ratio: number;
  }> = [];
  for (const zhvi of zhviRows) {
    const zori = zoriByCbsa.get(zhvi.cbsa_code);
    if (!zori || !zhvi.value || !zori.value) continue;
    items.push({
      cbsa: zhvi.cbsa_code,
      region_name: zhvi.region_name,
      home_value: zhvi.value,
      rent: zori.value,
      rent_to_price_ratio: (zori.value * 12) / zhvi.value,
    });
  }

  items.sort((a, b) => b.rent_to_price_ratio - a.rent_to_price_ratio);
  return items.slice(0, limit).map((it, idx) => ({
    geo: {
      geography: 'metro',
      id: it.cbsa,
      canonical_name: it.region_name,
    },
    home_value: it.home_value,
    rent: it.rent,
    rent_to_price_ratio: it.rent_to_price_ratio,
    rank: idx + 1,
  }));
}
