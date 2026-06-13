/**
 * PropertyIQ Scoring — Single-Location Retrieval Orchestration
 *
 * Free functions (taking the Supabase client explicitly, mirroring
 * scoring-queries.ts) that orchestrate fetching a single location's score plus
 * its history / extended-history / outcome payloads. The DB reads delegate to
 * scoring-queries.ts; the pure assembly delegates to scoring-history-assembly.ts.
 *
 * Extracted verbatim from ScoringService.getScore / getScoreWithExtendedHistory
 * — pure structural extraction, no behavior changes.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { GeographyLevel } from './formula-weights';
import { ScoreResult, SCORE_HISTORY_MONTHS_MAX } from './scoring.types';
import {
  getLatestScoreDate,
  getScoreDatesForLocation,
  getScoreForDate,
  getLatestScoresForLocation,
  getOutcomesForLocation,
} from './scoring-queries';
import {
  findPriorHistoryIndex,
  attachTrendHistory,
  attachExtendedHistory,
} from './scoring-history-assembly';

/**
 * Get scores for a single location.
 * historyMonths > 0: fetches history, sets trend_change.
 * components === true: includes per-component breakdowns.
 */
export async function getScoreForLocation(
  supabase: SupabaseClient,
  locationId: string,
  geography: GeographyLevel,
  periodDate?: string,
  options?: { historyMonths?: number; components?: boolean },
): Promise<ScoreResult | null> {
  // When no date is specified, fetch the latest row per score_type
  // to handle v3/v4 date mismatches (different score types may have
  // been calculated on different dates).
  let result: ScoreResult | null;
  let targetDate: string;

  if (periodDate) {
    targetDate = periodDate;
    result = await getScoreForDate(supabase, locationId, geography, targetDate);
  } else {
    result = await getLatestScoresForLocation(supabase, locationId, geography);
    if (!result) return null;
    targetDate = result.score_date;
  }
  if (!result) return null;

  // Attach component breakdowns if requested. For the v4 PropertyIQ score the
  // four raw input values live in z_scores; expose them as `components` so
  // callers (market snapshot, admin) can render the score's receipts.
  if (options?.components && result.z_scores && result.scores?.propertyiq) {
    result.scores.propertyiq.components = result.z_scores;
  }

  const rawMonths = options?.historyMonths ?? 0;
  const historyMonths = Math.min(
    Math.max(0, rawMonths),
    SCORE_HISTORY_MONTHS_MAX,
  );
  if (historyMonths <= 0) return result;

  const dates = await getScoreDatesForLocation(
    supabase,
    locationId,
    geography,
    (historyMonths + 1) * 3,
  );
  if (!dates.length || dates[0] !== targetDate) return result;

  const historyByDate: Array<{ date: string; result: ScoreResult }> = [];
  for (const d of dates) {
    const r = await getScoreForDate(supabase, locationId, geography, d);
    if (r) historyByDate.push({ date: d, result: r });
  }
  if (historyByDate.length < 2) return result;

  // Find the entry closest to N months ago for the trend comparison.
  // historyByDate is sorted newest-first; find the entry whose date is
  // closest to (current date - historyMonths months).
  const priorIdx = findPriorHistoryIndex(historyByDate, historyMonths);

  const priorResult = historyByDate[priorIdx]?.result;
  if (!priorResult) return result;

  return attachTrendHistory(result, priorResult, historyByDate, historyMonths);
}

/**
 * Get score with extended history (up to 5 years) and outcome data.
 */
export async function getScoreWithExtendedHistoryForLocation(
  supabase: SupabaseClient,
  locationId: string,
  geography: GeographyLevel,
  options: { historyYears?: number; includeOutcomes?: boolean } = {},
): Promise<(ScoreResult & { extendedHistory?: any; validation?: any }) | null> {
  const { historyYears = 3, includeOutcomes = false } = options;
  const targetDate = await getLatestScoreDate(supabase, geography);
  if (!targetDate) return null;

  const result = await getScoreForDate(
    supabase,
    locationId,
    geography,
    targetDate,
  );
  if (!result) return null;

  const monthsToFetch = Math.min(historyYears * 12, 60);
  const allDates = await getScoreDatesForLocation(
    supabase,
    locationId,
    geography,
    monthsToFetch,
  );
  if (allDates.length === 0) return result;

  const historyByDate: Array<{ date: string; result: ScoreResult }> = [];
  for (const d of allDates) {
    const r = await getScoreForDate(supabase, locationId, geography, d);
    if (r) historyByDate.push({ date: d, result: r });
  }
  if (historyByDate.length < 2) return result;

  let outcomes: Map<string, any> = new Map();
  if (includeOutcomes) {
    outcomes = await getOutcomesForLocation(supabase, locationId, geography);
  }

  return attachExtendedHistory(
    result,
    historyByDate,
    allDates,
    outcomes,
    historyYears,
    includeOutcomes,
  ) as any;
}
