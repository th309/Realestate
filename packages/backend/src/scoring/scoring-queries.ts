/**
 * Scoring Queries
 *
 * All database read operations for pre-computed PropertyIQ scores.
 * These query the propertyiq_scores and propertyiq_backtest_outcomes tables.
 *
 * Functions accept a SupabaseClient and return score data in various formats.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { ScoreType, GeographyLevel, ConfidenceLevel } from './formula-weights';
import { ScoreResult, SingleScoreResult } from './scoring.types';

/**
 * Normalize confidence_level from DB to the current A/B/C/F format.
 * Handles legacy values (HIGH/MEDIUM/LOW/INSUFFICIENT) from rows
 * calculated before the confidence formula was updated.
 */
const LEGACY_CONFIDENCE_MAP: Record<string, ConfidenceLevel> = {
  HIGH: 'A',
  MEDIUM: 'B',
  LOW: 'C',
  INSUFFICIENT: 'F',
};

function normalizeConfidenceLevel(raw: string | null | undefined): ConfidenceLevel {
  if (!raw) return 'F';
  // Already new format
  if (raw === 'A' || raw === 'B' || raw === 'C' || raw === 'F') return raw;
  // Legacy format
  return LEGACY_CONFIDENCE_MAP[raw] ?? 'F';
}

/**
 * Get the most recent score_date for a given geography level.
 */
export async function getLatestScoreDate(
  supabase: SupabaseClient,
  geography: GeographyLevel,
): Promise<string | null> {
  const { data } = await supabase
    .from('propertyiq_scores')
    .select('score_date')
    .eq('geography', geography)
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
): Promise<string[]> {
  const { data } = await supabase
    .from('propertyiq_scores')
    .select('score_date')
    .eq('geography', geography)
    .eq('location_id', locationId)
    .order('score_date', { ascending: false })
    .limit(limit);
  if (!data?.length) return [];
  return [...new Set(data.map((r: { score_date: string }) => r.score_date))].sort(
    (a, b) => b.localeCompare(a),
  );
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
  const dates = [...new Set(data.map((r: { score_date: string }) => r.score_date))].sort(
    (a, b) => b.localeCompare(a),
  );
  return dates.slice(0, limit);
}

/**
 * Fetch all score rows for a single location at a specific date,
 * then assemble them into a unified ScoreResult.
 * Supports lookup by numeric ID or by name prefix (ilike).
 */
export async function getScoreForDate(
  supabase: SupabaseClient,
  locationId: string,
  geography: GeographyLevel,
  scoreDate: string,
): Promise<ScoreResult | null> {
  let query = supabase
    .from('propertyiq_scores')
    .select('*')
    .eq('geography', geography)
    .eq('score_date', scoreDate);

  if (/^\d+$/.test(locationId)) {
    query = query.eq('location_id', locationId);
  } else {
    query = query.ilike('location_name', `${locationId}%`);
  }

  const { data } = await query;
  if (!data || data.length === 0) return null;

  const scoresByType: Record<ScoreType, SingleScoreResult> = {
    homeready: null!,
    investoredge: null!,
    markethealth: null!,
  };
  let locationName = '';
  let medianPrice: number | null = null;
  let zScores: Record<string, number> | undefined;

  for (const row of data) {
    locationName = row.location_name || locationName;
    medianPrice = row.median_price ?? medianPrice;
    if (!zScores && row.z_scores && typeof row.z_scores === 'object') {
      zScores = row.z_scores;
    }
    const scoreType = row.score_type as ScoreType;
    scoresByType[scoreType] = {
      score: row.score,
      grade: row.grade,
      confidence: row.confidence,
      confidence_level: normalizeConfidenceLevel(row.confidence_level),
    };
  }

  return {
    location_id: locationId,
    location_name: locationName,
    geography,
    median_price: medianPrice,
    score_date: scoreDate,
    scores: {
      homeready: scoresByType.homeready || {
        score: 0,
        grade: 'F',
        confidence: 0,
        confidence_level: 'F',
      },
      investoredge: scoresByType.investoredge || {
        score: 0,
        grade: 'F',
        confidence: 0,
        confidence_level: 'F',
      },
      markethealth: scoresByType.markethealth || {
        score: 0,
        grade: 'F',
        confidence: 0,
        confidence_level: 'F',
      },
    },
    z_scores: zScores,
    return_1y: data[0]?.return_1y,
    return_3y_ann: data[0]?.return_3y_ann,
  };
}

/**
 * Fetch backtest outcomes for a location, keyed by score_date.
 */
export async function getOutcomesForLocation(
  supabase: SupabaseClient,
  locationId: string,
  geography: GeographyLevel,
): Promise<
  Map<
    string,
    {
      return1y?: number;
      return3y?: number;
      stateReturn1y?: number;
      stateReturn3y?: number;
      excessVsState3y?: number;
    }
  >
> {
  const { data } = await supabase
    .from('propertyiq_backtest_outcomes')
    .select(
      'score_date, outcome_1y_value, outcome_3y_value, state_return_1y, state_return_3y_cagr, excess_vs_state_3y',
    )
    .eq('geography_id', locationId)
    .eq('geography_type', geography)
    .order('score_date', { ascending: false });

  const outcomes = new Map<
    string,
    {
      return1y?: number;
      return3y?: number;
      stateReturn1y?: number;
      stateReturn3y?: number;
      excessVsState3y?: number;
    }
  >();
  if (data) {
    for (const row of data) {
      outcomes.set(row.score_date, {
        return1y: row.outcome_1y_value,
        return3y: row.outcome_3y_value,
        stateReturn1y: row.state_return_1y,
        stateReturn3y: row.state_return_3y_cagr,
        excessVsState3y: row.excess_vs_state_3y,
      });
    }
  }
  return outcomes;
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

  const { data } = await supabase
    .from('propertyiq_scores')
    .select('location_id, location_name, score, grade')
    .eq('geography', geography)
    .eq('score_type', scoreType)
    .eq('score_date', targetDate)
    .order('score', { ascending: false })
    .limit(limit);

  return data || [];
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
    .eq('score_type', 'homeready');

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
      'location_id, location_name, score, grade, confidence, confidence_level',
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
  const normalized = (data || []).map(row => ({
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
