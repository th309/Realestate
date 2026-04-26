// packages/backend/src/content-pipeline/data/score-mover-context.queries.ts
/**
 * Score-mover queries: leaderboard (dual top-N gainers/losers across all
 * markets at a geography level over a chosen window) and per-market
 * context (score delta over the chosen window for a specific geoId).
 *
 * Both rely on the same `propertyiq_scores` table the rest of the pipeline
 * uses. Window resolution:
 *
 *   1. latestDate = max(score_date) for this geography
 *   2. priorTarget = latestDate - windowDays
 *   3. priorDate = max(score_date) where score_date <= priorTarget
 *
 * If priorDate doesn't exist, the result is null/empty — callers surface
 * the sparse-state UI rather than rendering an empty video.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  POPULATION_FLOOR,
  SCORE_MOVER_WINDOWS,
  type ScoreMoverGeo,
  type ScoreMoverWindowDays,
} from './score-mover-config';

export interface ScoreMoverItem {
  id: string;
  canonical_name: string;
  geography: ScoreMoverGeo;
  current_score: number;
  previous_score: number;
  delta: number;
  population: number | null;
}

export interface TopMoversResult {
  window: {
    latestDate: string;
    priorDate: string;
    windowDays: ScoreMoverWindowDays;
    requestedGeo: ScoreMoverGeo;
  } | null;
  qualifiedCount: number;
  up: ScoreMoverItem[];
  down: ScoreMoverItem[];
}

interface ScoreRow {
  location_id: string;
  location_name: string;
  score: number;
}

async function fetchAllScoresForDate(
  client: SupabaseClient,
  scoringGeo: ScoreMoverGeo,
  scoreDate: string,
): Promise<ScoreRow[]> {
  const pageSize = 1000;
  let from = 0;
  const acc: ScoreRow[] = [];
  while (true) {
    const { data } = await client
      .from('propertyiq_scores')
      .select('location_id, location_name, score')
      .eq('geography', scoringGeo)
      .eq('score_type', 'propertyiq')
      .eq('score_date', scoreDate)
      .range(from, from + pageSize - 1);
    if (!data || data.length === 0) break;
    acc.push(...(data as ScoreRow[]));
    from += pageSize;
  }
  return acc;
}

async function resolvePriorDate(
  client: SupabaseClient,
  geo: ScoreMoverGeo,
  latestDate: string,
  windowDays: number,
): Promise<string | null> {
  const target = new Date(latestDate);
  target.setUTCDate(target.getUTCDate() - windowDays);
  const targetIso = target.toISOString().slice(0, 10);

  const { data } = await client
    .from('propertyiq_scores')
    .select('score_date')
    .eq('geography', geo)
    .eq('score_type', 'propertyiq')
    .lte('score_date', targetIso)
    .order('score_date', { ascending: false })
    .limit(1);
  const prior = (data as { score_date: string }[] | null)?.[0]?.score_date;
  if (!prior || prior === latestDate) return null;
  return prior;
}

interface GeoMeta {
  population: number | null;
  name: string | null;
}

/**
 * Joins `geographies` for both population (used by floor filter) AND
 * canonical name. We deliberately use geographies.name over
 * propertyiq_scores.location_name because the scores table has
 * inconsistent suffixes (e.g. "Portsmouth, OH metro area" on some rows
 * and "Portsmouth, OH" on others), and downstream `resolveMarket`
 * searches `geographies.name` — names that don't appear there fail to
 * resolve. Using the geographies form guarantees round-trip.
 *
 * Join key: geography_id (= cbsa_code for metro, fips_code for county,
 * postal_code for zip). The `geographies` table has NO `location_id`
 * column. CLAUDE.md memory: "Geography ID Formats — metro=cbsa_code,
 * county=county_fips, zip=postal_code".
 */
async function fetchGeoMetadataByLocation(
  client: SupabaseClient,
  geo: ScoreMoverGeo,
  locationIds: string[],
): Promise<Map<string, GeoMeta>> {
  const out = new Map<string, GeoMeta>();
  if (locationIds.length === 0) return out;
  const BATCH = 500;
  for (let i = 0; i < locationIds.length; i += BATCH) {
    const batch = locationIds.slice(i, i + BATCH);
    const { data } = await client
      .from('geographies')
      .select('geography_id, population, name')
      .eq('geography_type', geo)
      .in('geography_id', batch);
    for (const row of (data as
      | {
          geography_id: string;
          population: number | null;
          name: string | null;
        }[]
      | null) ?? []) {
      out.set(row.geography_id, {
        population: row.population,
        name: row.name,
      });
    }
  }
  return out;
}

export async function fetchTopMovers(
  client: SupabaseClient,
  geo: ScoreMoverGeo,
  windowDays: ScoreMoverWindowDays,
  limit: number,
): Promise<TopMoversResult> {
  const { data: latestRow } = await client
    .from('propertyiq_scores')
    .select('score_date')
    .eq('geography', geo)
    .eq('score_type', 'propertyiq')
    .order('score_date', { ascending: false })
    .limit(1);
  const latestDate = (latestRow as { score_date: string }[] | null)?.[0]
    ?.score_date;
  if (!latestDate) {
    return { window: null, qualifiedCount: 0, up: [], down: [] };
  }

  const priorDate = await resolvePriorDate(client, geo, latestDate, windowDays);
  if (!priorDate) {
    return { window: null, qualifiedCount: 0, up: [], down: [] };
  }

  const latest = await fetchAllScoresForDate(client, geo, latestDate);
  const prior = await fetchAllScoresForDate(client, geo, priorDate);
  const priorById = new Map(prior.map((r) => [r.location_id, r]));

  const metaById = await fetchGeoMetadataByLocation(
    client,
    geo,
    latest.map((r) => r.location_id),
  );

  const floor = POPULATION_FLOOR[geo];

  const items: ScoreMoverItem[] = [];
  for (const row of latest) {
    const p = priorById.get(row.location_id);
    if (!p) continue;
    const meta = metaById.get(row.location_id);
    const pop = meta?.population ?? null;
    if (pop == null || pop < floor) continue;
    items.push({
      id: row.location_id,
      // Prefer geographies.name (round-trips through resolveMarket cleanly);
      // fall back to propertyiq_scores.location_name only if the geography
      // row is missing for this id (shouldn't happen for in-scope IDs since
      // we just filtered by population from the same table).
      canonical_name: meta?.name ?? row.location_name,
      geography: geo,
      current_score: row.score,
      previous_score: p.score,
      delta: row.score - p.score,
      population: pop,
    });
  }

  const cmp = (a: ScoreMoverItem, b: ScoreMoverItem, dir: 'up' | 'down') => {
    const primary = dir === 'up' ? b.delta - a.delta : a.delta - b.delta;
    if (primary !== 0) return primary;
    const popDelta = (b.population ?? 0) - (a.population ?? 0);
    if (popDelta !== 0) return popDelta;
    return a.canonical_name.localeCompare(b.canonical_name);
  };

  const up = items
    .filter((i) => i.delta > 0)
    .sort((a, b) => cmp(a, b, 'up'))
    .slice(0, limit);
  const down = items
    .filter((i) => i.delta < 0)
    .sort((a, b) => cmp(a, b, 'down'))
    .slice(0, limit);

  return {
    window: { latestDate, priorDate, windowDays, requestedGeo: geo },
    qualifiedCount: items.length,
    up,
    down,
  };
}

export interface ScoreMoverContext {
  current: { score: number; scoreDate: string };
  prior: { score: number; scoreDate: string };
  delta: number;
  windowDays: ScoreMoverWindowDays;
  windowLabel: string;
  windowCaption: string;
}

export async function fetchScoreMoverContext(
  client: SupabaseClient,
  geoId: string,
  geo: ScoreMoverGeo,
  windowDays: ScoreMoverWindowDays,
): Promise<ScoreMoverContext | null> {
  const { data: latestRow } = await client
    .from('propertyiq_scores')
    .select('score_date, score')
    .eq('geography', geo)
    .eq('score_type', 'propertyiq')
    .eq('location_id', geoId)
    .order('score_date', { ascending: false })
    .limit(1);
  const latest = (
    latestRow as { score_date: string; score: number }[] | null
  )?.[0];
  if (!latest) return null;

  const target = new Date(latest.score_date);
  target.setUTCDate(target.getUTCDate() - windowDays);
  const targetIso = target.toISOString().slice(0, 10);

  const { data: priorRow } = await client
    .from('propertyiq_scores')
    .select('score_date, score')
    .eq('geography', geo)
    .eq('score_type', 'propertyiq')
    .eq('location_id', geoId)
    .lte('score_date', targetIso)
    .order('score_date', { ascending: false })
    .limit(1);
  const prior = (
    priorRow as { score_date: string; score: number }[] | null
  )?.[0];
  if (!prior || prior.score_date === latest.score_date) return null;

  const cfg = SCORE_MOVER_WINDOWS[windowDays];
  return {
    current: { score: latest.score, scoreDate: latest.score_date },
    prior: { score: prior.score, scoreDate: prior.score_date },
    delta: latest.score - prior.score,
    windowDays,
    windowLabel: cfg.label,
    windowCaption: cfg.caption,
  };
}
