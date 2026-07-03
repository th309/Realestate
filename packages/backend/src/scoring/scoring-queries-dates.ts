/**
 * Scoring Queries — Score Dates
 *
 * Read operations that resolve which score_date(s) exist for a geography
 * level or a single location, from the propertyiq_scores table.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { ScoreType, GeographyLevel } from './formula-weights';

/**
 * Get the most recent score_date for a given geography level.
 * Optionally filter by score_type to avoid date mismatches between
 * v3 (homeready/investoredge/markethealth) and v4 (propertyiq) rows
 * that may have been calculated on different dates.
 */
export async function getLatestScoreDate(
  supabase: SupabaseClient,
  geography: GeographyLevel,
  scoreType?: ScoreType,
): Promise<string | null> {
  let query = supabase
    .from('propertyiq_scores')
    .select('score_date')
    .eq('geography', geography);

  if (scoreType) {
    query = query.eq('score_type', scoreType);
  }

  const { data } = await query
    .order('score_date', { ascending: false })
    .limit(1);
  return data?.[0]?.score_date || null;
}

/**
 * Get distinct score dates for a specific location, ordered newest first.
 */
export async function getScoreDatesForLocation(
  supabase: SupabaseClient,
  locationId: string,
  geography: GeographyLevel,
  limit: number,
  scoreType: ScoreType = 'propertyiq',
): Promise<string[]> {
  const { data } = await supabase
    .from('propertyiq_scores')
    .select('score_date')
    .eq('geography', geography)
    .eq('location_id', locationId)
    .eq('score_type', scoreType)
    .order('score_date', { ascending: false })
    .limit(limit);
  if (!data?.length) return [];
  return [
    ...new Set(data.map((r: { score_date: string }) => r.score_date)),
  ].sort((a, b) => b.localeCompare(a));
}

/**
 * Get distinct score dates for a geography level, ordered newest first.
 * Over-fetches rows to account for duplicates, then deduplicates and slices.
 */
export async function getScoreDates(
  supabase: SupabaseClient,
  geography: GeographyLevel,
  limit: number,
): Promise<string[]> {
  const { data } = await supabase
    .from('propertyiq_scores')
    .select('score_date')
    .eq('geography', geography)
    .order('score_date', { ascending: false })
    .limit(limit * 4);
  if (!data?.length) return [];
  const dates = [
    ...new Set(data.map((r: { score_date: string }) => r.score_date)),
  ].sort((a, b) => b.localeCompare(a));
  return dates.slice(0, limit);
}
