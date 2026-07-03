/**
 * Scoring Queries — Pagination & Bulk Reads
 *
 * Read operations that page or batch all scores for a geography/type/date,
 * with optional concurrent page workers, from the propertyiq_scores table.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { ScoreType, GeographyLevel } from './formula-weights';
import { normalizeConfidenceLevel } from './scoring-queries-confidence';

/** Row shape returned by fetchScoresPage and fetchAllScoresBatched. */
export interface ScorePageRow {
  location_id: string;
  location_name: string;
  score: number;
  grade: string;
  confidence: number;
  confidence_level: string;
}

/**
 * Fetch a single page of scores, ordered by score descending.
 */
export async function fetchScoresPage(
  supabase: SupabaseClient,
  geography: GeographyLevel,
  scoreType: ScoreType,
  scoreDate: string,
  from: number,
  to: number,
): Promise<{ data: ScorePageRow[] }> {
  const { data, error } = await supabase
    .from('propertyiq_scores')
    .select(
      'location_id, location_name, score, grade, confidence, confidence_level, score_date',
    )
    .eq('geography', geography)
    .eq('score_type', scoreType)
    .eq('score_date', scoreDate)
    .order('score', { ascending: false })
    .range(from, to);

  if (error) {
    throw new Error(`Failed to fetch scores: ${error.message}`);
  }

  // Normalize legacy confidence_level values from existing DB rows
  const normalized = (data || []).map((row) => ({
    ...row,
    confidence_level: normalizeConfidenceLevel(row.confidence_level),
  }));

  return { data: normalized };
}

/**
 * Fetch all scores for a geography/type/date, using concurrent page workers
 * when the result set is large enough to benefit from parallelism.
 */
export async function fetchAllScoresBatched(
  supabase: SupabaseClient,
  geography: GeographyLevel,
  scoreType: ScoreType,
  scoreDate: string,
  pageSize: number,
  concurrency: number,
): Promise<{ data: ScorePageRow[]; total: number | null }> {
  const { count: total } = await supabase
    .from('propertyiq_scores')
    .select('*', { count: 'exact', head: true })
    .eq('geography', geography)
    .eq('score_type', scoreType)
    .eq('score_date', scoreDate);

  if (!total || total <= pageSize || concurrency <= 1) {
    const all: ScorePageRow[] = [];
    let page = 0;
    while (true) {
      const from = page * pageSize;
      const to = from + pageSize - 1;
      const { data } = await fetchScoresPage(
        supabase,
        geography,
        scoreType,
        scoreDate,
        from,
        to,
      );
      if (!data || data.length === 0) break;
      all.push(...data);
      if (data.length < pageSize) break;
      page += 1;
    }
    return { data: all, total: total || all.length };
  }

  const totalPages = Math.ceil(total / pageSize);
  const pageResults: ScorePageRow[][] = new Array(totalPages);

  let nextPage = 0;
  const workerCount = Math.max(1, Math.min(concurrency, totalPages));

  const workers = Array.from({ length: workerCount }, async () => {
    while (true) {
      const page = nextPage;
      nextPage += 1;
      if (page >= totalPages) break;
      const from = page * pageSize;
      const to = from + pageSize - 1;
      const { data } = await fetchScoresPage(
        supabase,
        geography,
        scoreType,
        scoreDate,
        from,
        to,
      );
      pageResults[page] = data || [];
    }
  });

  await Promise.all(workers);

  return {
    data: pageResults.flat(),
    total,
  };
}
