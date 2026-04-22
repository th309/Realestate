/**
 * Direct Supabase queries used by ContentDataService for trending-markets
 * and top-cashflow-markets lookups. These live outside the service class
 * to keep the facade small and to make the queries independently testable.
 *
 * Scoring level and score-type are fixed to 'propertyiq' since the
 * content pipeline only consumes the unified v4 score.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { GeoRef } from '../types';
import { TrendingMarketItem, CashflowMarketItem } from './content-data.types';

export type ScoringGeo = 'metro' | 'county' | 'zip';

interface LatestScoreRow {
  location_id: string;
  location_name: string;
  score: number;
}

interface ZillowMetroRow {
  cbsa_code: string;
  region_name: string;
  value: number;
  period_date: string;
}

/**
 * Fetch every propertyiq score for a single date, paging through to get
 * the full set. Used by the trending-markets delta computation.
 */
export async function fetchAllScoresForDate(
  client: SupabaseClient,
  scoringGeo: ScoringGeo,
  scoreDate: string,
): Promise<LatestScoreRow[]> {
  const pageSize = 1000;
  let from = 0;
  const acc: LatestScoreRow[] = [];
  while (true) {
    const { data } = await client
      .from('propertyiq_scores')
      .select('location_id, location_name, score')
      .eq('geography', scoringGeo)
      .eq('score_type', 'propertyiq')
      .eq('score_date', scoreDate)
      .range(from, from + pageSize - 1);
    if (!data || data.length === 0) break;
    acc.push(...(data as LatestScoreRow[]));
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return acc;
}

/**
 * Compute the top N PropertyIQ score movers (up or down) for a geography
 * level between the latest score_date and the score_date closest
 * on-or-before 90 days earlier.
 *
 * Assumptions:
 * - "Trending" = largest signed delta over ~90 days.
 * - Uses score_type = 'propertyiq'.
 * - Returns [] when no prior reference date can be found.
 */
export async function fetchTrendingMarkets(
  client: SupabaseClient,
  geography: GeoRef['geography'],
  scoringGeo: ScoringGeo,
  direction: 'up' | 'down',
  limit: number,
): Promise<TrendingMarketItem[]> {
  // 1. Find the latest score_date.
  const { data: latestRow } = await client
    .from('propertyiq_scores')
    .select('score_date')
    .eq('geography', scoringGeo)
    .eq('score_type', 'propertyiq')
    .order('score_date', { ascending: false })
    .limit(1);
  const latestDate: string | undefined = latestRow?.[0]?.score_date;
  if (!latestDate) return [];

  // 2. Target ~90 days earlier, then pick closest on-or-before actual date.
  const priorTarget = new Date(latestDate);
  priorTarget.setDate(priorTarget.getDate() - 90);
  const priorTargetIso = priorTarget.toISOString().slice(0, 10);

  const { data: priorRow } = await client
    .from('propertyiq_scores')
    .select('score_date')
    .eq('geography', scoringGeo)
    .eq('score_type', 'propertyiq')
    .lte('score_date', priorTargetIso)
    .order('score_date', { ascending: false })
    .limit(1);
  const priorDate: string | undefined = priorRow?.[0]?.score_date;
  if (!priorDate || priorDate === latestDate) return [];

  // 3. Fetch both date sets and compute deltas in memory.
  const [latest, prior] = await Promise.all([
    fetchAllScoresForDate(client, scoringGeo, latestDate),
    fetchAllScoresForDate(client, scoringGeo, priorDate),
  ]);
  const priorById = new Map(prior.map((r) => [r.location_id, r]));

  const items: TrendingMarketItem[] = [];
  for (const row of latest) {
    const p = priorById.get(row.location_id);
    if (!p) continue;
    const delta = row.score - p.score;
    if (direction === 'up' && delta <= 0) continue;
    if (direction === 'down' && delta >= 0) continue;
    items.push({
      geo: {
        geography,
        id: row.location_id,
        canonical_name: row.location_name,
      },
      current_score: row.score,
      previous_score: p.score,
      delta,
    });
  }

  items.sort((a, b) =>
    direction === 'up' ? b.delta - a.delta : a.delta - b.delta,
  );
  return items.slice(0, limit);
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
