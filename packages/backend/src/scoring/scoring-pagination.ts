/**
 * PropertyIQ Scoring — Geography-Level Pagination Orchestration
 *
 * Free functions (taking the Supabase client explicitly, mirroring
 * scoring-queries.ts) that page / batch / stream all scores for a geography
 * level at a given date. The underlying page reads delegate to
 * scoring-queries.ts; these wrappers add the date-resolution, total-count, and
 * paging envelope logic.
 *
 * Extracted verbatim from ScoringService.getAllScoresForGeography /
 * getAllScoresForGeographyAll / iterateScoresForGeography — pure structural
 * extraction, no behavior changes.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { ScoreType, GeographyLevel } from './formula-weights';
import {
  getLatestScoreDate,
  fetchScoresPage,
  fetchAllScoresBatched,
} from './scoring-queries';

/** One page of scores for a geography level, with paging envelope. */
export async function getAllScoresForGeographyPage(
  supabase: SupabaseClient,
  geography: GeographyLevel,
  scoreType: ScoreType,
  periodDate?: string,
  page: number = 0,
  pageSize: number = 1000,
) {
  const targetDate =
    periodDate || (await getLatestScoreDate(supabase, geography));
  if (!targetDate) {
    return { data: [], total: 0, page, pageSize, hasMore: false };
  }

  const { count: total } = await supabase
    .from('propertyiq_scores')
    .select('*', { count: 'exact', head: true })
    .eq('geography', geography)
    .eq('score_type', scoreType)
    .eq('score_date', targetDate);

  const { data } = await fetchScoresPage(
    supabase,
    geography,
    scoreType,
    targetDate,
    page * pageSize,
    (page + 1) * pageSize - 1,
  );

  return {
    data: data || [],
    total: total || 0,
    page,
    pageSize,
    hasMore: (page + 1) * pageSize < (total || 0),
  };
}

/** All scores for a geography level, fetched in concurrent batches. */
export async function getAllScoresForGeographyBatched(
  supabase: SupabaseClient,
  geography: GeographyLevel,
  scoreType: ScoreType,
  periodDate?: string,
  pageSize: number = 1000,
  concurrency: number = 4,
) {
  const targetDate =
    periodDate || (await getLatestScoreDate(supabase, geography));
  if (!targetDate) {
    return { data: [], total: 0, pageSize };
  }
  const { data, total } = await fetchAllScoresBatched(
    supabase,
    geography,
    scoreType,
    targetDate,
    pageSize,
    concurrency,
  );
  return { data, total: total || data.length, pageSize };
}

/** Stream all scores for a geography level one page at a time. */
export async function* iterateScoresForGeographyPages(
  supabase: SupabaseClient,
  geography: GeographyLevel,
  scoreType: ScoreType,
  periodDate?: string,
  pageSize: number = 1000,
) {
  const targetDate =
    periodDate || (await getLatestScoreDate(supabase, geography));
  if (!targetDate) return;

  let page = 0;
  while (true) {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const { data } = await fetchScoresPage(
      supabase,
      geography,
      scoreType,
      targetDate,
      from,
      to,
    );
    if (!data || data.length === 0) break;
    yield data;
    if (data.length < pageSize) break;
    page += 1;
  }
}
