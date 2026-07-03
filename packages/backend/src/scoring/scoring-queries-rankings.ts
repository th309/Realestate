/**
 * Scoring Queries — Rankings & Market Lists
 *
 * Read operations that list or rank scored markets: the lean scored
 * location_id set for SEO, top-scoring markets (nationally or state-filtered),
 * and name search, from the propertyiq_scores table.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { ScoreType, GeographyLevel } from './formula-weights';
import { getLatestScoreDate } from './scoring-queries-dates';

/**
 * List every scored location_id for a geography at the latest (or given) date.
 *
 * Lean projection (location_id only, deduped) so SEO callers — sitemap
 * filtering and per-page noindex — can pull the full set (~29k ZIPs) in a
 * small, cacheable payload instead of the multi-MB /scores/all response.
 * Paginated to clear Supabase's 1000-row cap.
 */
export async function getScoredLocationIds(
  supabase: SupabaseClient,
  geography: GeographyLevel,
  scoreType: ScoreType,
  date?: string,
): Promise<{ date: string | null; ids: string[] }> {
  const targetDate =
    date || (await getLatestScoreDate(supabase, geography, scoreType));
  if (!targetDate) return { date: null, ids: [] };

  const pageSize = 1000;
  const ids = new Set<string>();
  let page = 0;

  while (true) {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from('propertyiq_scores')
      .select('location_id')
      .eq('geography', geography)
      .eq('score_type', scoreType)
      .eq('score_date', targetDate)
      // Stable order is REQUIRED for correct range pagination — without it
      // Postgres may reorder rows between pages, skipping some location_ids.
      .order('location_id', { ascending: true })
      .range(from, to);

    if (error) {
      throw new Error(`Failed to fetch scored location ids: ${error.message}`);
    }
    if (!data || data.length === 0) break;
    for (const row of data) {
      if (row.location_id) ids.add(row.location_id);
    }
    if (data.length < pageSize) break;
    page += 1;
  }

  return { date: targetDate, ids: [...ids] };
}

/**
 * Return the top-scoring markets for a score type, optionally at a specific date.
 * Falls back to the latest available date if none is provided.
 */
export async function getTopMarkets(
  supabase: SupabaseClient,
  geography: GeographyLevel,
  scoreType: ScoreType,
  limit: number = 10,
  periodDate?: string,
  state?: string,
  ascending: boolean = false,
): Promise<
  Array<{
    location_id: string;
    location_name: string;
    score: number;
    grade: string;
  }>
> {
  const targetDate =
    periodDate || (await getLatestScoreDate(supabase, geography));
  if (!targetDate) return [];

  // State-filtered path: look up matching location_ids via crosswalk, then query scores
  if (state) {
    const crosswalkCol =
      geography === 'metro'
        ? 'cbsa_code'
        : geography === 'county'
          ? 'county_fips'
          : 'zip_code';

    const { data: crosswalkRows, error: cwError } = await supabase
      .from('geography_crosswalk')
      .select(crosswalkCol)
      .eq('state_abbrev', state.toUpperCase());

    if (cwError || !crosswalkRows?.length) return [];

    const locationIds = [
      ...new Set(
        crosswalkRows.map((r: any) => r[crosswalkCol]).filter(Boolean),
      ),
    ];

    // Fallback: crosswalk has no mapping for this geo level in this state
    // (e.g. CT has county_fips/zip but no cbsa_code). Search scores by name.
    if (locationIds.length === 0) {
      const { data: fallbackData } = await supabase
        .from('propertyiq_scores')
        .select('location_id, location_name, score, grade')
        .eq('geography', geography)
        .eq('score_type', scoreType)
        .eq('score_date', targetDate)
        .ilike('location_name', `%, ${state.toUpperCase()}%`)
        .order('score', { ascending })
        .limit(limit);

      return fallbackData ?? [];
    }

    // Batch the .in() filter to stay within PostgREST URL limits
    const BATCH_SIZE = 500;
    type TopRow = {
      location_id: string;
      location_name: string;
      score: number;
      grade: string;
    };
    const allResults: TopRow[] = [];

    for (let i = 0; i < locationIds.length; i += BATCH_SIZE) {
      const batch = locationIds.slice(i, i + BATCH_SIZE);
      const { data } = await supabase
        .from('propertyiq_scores')
        .select('location_id, location_name, score, grade')
        .eq('geography', geography)
        .eq('score_type', scoreType)
        .eq('score_date', targetDate)
        .in('location_id', batch)
        .order('score', { ascending })
        .limit(limit);

      if (data) allResults.push(...data);
    }

    allResults.sort((a, b) =>
      ascending ? a.score - b.score : b.score - a.score,
    );
    return enrichZipNames(supabase, geography, allResults.slice(0, limit));
  }

  // Unfiltered path — simple national ranking
  const { data } = await supabase
    .from('propertyiq_scores')
    .select('location_id, location_name, score, grade')
    .eq('geography', geography)
    .eq('score_type', scoreType)
    .eq('score_date', targetDate)
    .order('score', { ascending })
    .limit(limit);

  return enrichZipNames(supabase, geography, data || []);
}

/** Enrich ZIP results with "XXXXX — City, ST" from geography_crosswalk. */
async function enrichZipNames<
  T extends { location_id: string; location_name: string },
>(
  supabase: SupabaseClient,
  geography: GeographyLevel,
  results: T[],
): Promise<T[]> {
  if (geography !== 'zip' || results.length === 0) return results;

  const { data: cw } = await supabase
    .from('geography_crosswalk')
    .select('zip_code, zip_default_city, zip_default_state')
    .in(
      'zip_code',
      results.map((r) => r.location_id),
    );

  if (!cw?.length) return results;

  const map = new Map(
    cw
      .filter((r: any) => r.zip_default_city && r.zip_default_state)
      .map((r: any) => [
        r.zip_code,
        `${r.zip_code} — ${r.zip_default_city}, ${r.zip_default_state}`,
      ]),
  );

  return results.map((r) => ({
    ...r,
    location_name: map.get(r.location_id) ?? r.location_name,
  }));
}

/**
 * Search markets by name (case-insensitive partial match).
 * Deduplicates by geography + location_id.
 */
export async function searchMarkets(
  supabase: SupabaseClient,
  query: string,
  geography?: GeographyLevel,
  limit: number = 20,
): Promise<
  Array<{
    location_id: string;
    location_name: string;
    geography: string;
  }>
> {
  let queryBuilder = supabase
    .from('propertyiq_scores')
    .select('location_id, location_name, geography')
    .ilike('location_name', `%${query}%`)
    .eq('score_type', 'propertyiq');

  if (geography) {
    queryBuilder = queryBuilder.eq('geography', geography);
  }

  const { data } = await queryBuilder.limit(limit);

  const seen = new Set<string>();
  return (data || []).filter((row) => {
    const key = `${row.geography}:${row.location_id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
