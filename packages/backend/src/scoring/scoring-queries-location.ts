/**
 * Scoring Queries — Single-Location Retrieval
 *
 * Read operations that fetch and assemble a single location's PropertyIQ
 * score (by date or latest) plus its backtest outcomes, from the
 * propertyiq_scores and propertyiq_backtest_outcomes tables.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { AnyScoreType, GeographyLevel } from './formula-weights';
import { ScoreResult, SingleScoreResult } from './scoring.types';
import { normalizeConfidenceLevel } from './scoring-queries-confidence';

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

  return assembleScoreResult(data, locationId, geography, scoreDate);
}

/**
 * Fetch the latest score row per score_type for a single location,
 * regardless of score_date. This handles the case where different
 * score types (v3 homeready/investoredge/markethealth vs v4 propertyiq)
 * were calculated on different dates.
 *
 * For each score_type, fetches the most recent row, then assembles
 * them into a unified ScoreResult. The returned score_date is the
 * newest date across all score types found.
 */
export async function getLatestScoresForLocation(
  supabase: SupabaseClient,
  locationId: string,
  geography: GeographyLevel,
): Promise<ScoreResult | null> {
  // Only query propertyiq — legacy score types are historical
  const scoreTypes: AnyScoreType[] = ['propertyiq'];

  // Fetch the latest row per score_type in parallel
  const queries = scoreTypes.map((scoreType) => {
    let query = supabase
      .from('propertyiq_scores')
      .select('*')
      .eq('geography', geography)
      .eq('score_type', scoreType)
      .order('score_date', { ascending: false })
      .limit(1);

    if (/^\d+$/.test(locationId)) {
      query = query.eq('location_id', locationId);
    } else {
      query = query.ilike('location_name', `${locationId}%`);
    }

    return query;
  });

  const results = await Promise.all(queries);
  const allRows = results.flatMap((r) => r.data ?? []);

  if (allRows.length === 0) return null;

  // Use the newest score_date across all rows
  const newestDate = allRows.reduce(
    (latest, row) => (row.score_date > latest ? row.score_date : latest),
    allRows[0].score_date,
  );

  return assembleScoreResult(allRows, locationId, geography, newestDate);
}

/**
 * Assemble raw DB rows into a unified ScoreResult.
 * Shared by getScoreForDate and getLatestScoresForLocation.
 */
function assembleScoreResult(
  data: any[],
  locationId: string,
  geography: GeographyLevel,
  scoreDate: string,
): ScoreResult {
  const scoresByType: Record<AnyScoreType, SingleScoreResult | null> = {
    propertyiq: null,
    homeready: null,
    investoredge: null,
    markethealth: null,
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
    const scoreType = row.score_type as AnyScoreType;
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
      propertyiq: scoresByType.propertyiq || null,
      // Legacy keys — populated only when reading old DB rows
      homeready: scoresByType.homeready || null,
      investoredge: scoresByType.investoredge || null,
      markethealth: scoresByType.markethealth || null,
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
