/**
 * PropertyIQ Scoring — History Assembly Helpers
 *
 * Pure (DB-free) transformation logic extracted from ScoringService. These
 * functions take score rows that have ALREADY been fetched from the database
 * (by ScoringService via scoring-queries.ts) and attach trend / history /
 * extended-history / validation payloads onto the result objects.
 *
 * Behavior is byte-for-byte identical to the original inline logic in
 * scoring.service.ts — this is a pure structural extraction, no logic changes.
 */

import { ScoreResult } from './scoring.types';

/** Score-type keys iterated when attaching trend/history payloads. */
const SCORE_TYPE_KEYS = [
  'homeready',
  'investoredge',
  'markethealth',
  'propertyiq',
] as const;

/**
 * Given the newest-first list of historical score results, find the index of
 * the entry whose date is closest to (current date - historyMonths months).
 *
 * Mirrors the original inline loop in getScore: starts at index 1 (skipping the
 * current/newest entry) and returns the closest match by absolute time diff.
 */
export function findPriorHistoryIndex(
  historyByDate: Array<{ date: string; result: ScoreResult }>,
  historyMonths: number,
): number {
  const currentDate = new Date(historyByDate[0].date);
  const targetPriorDate = new Date(currentDate);
  targetPriorDate.setMonth(targetPriorDate.getMonth() - historyMonths);
  const targetMs = targetPriorDate.getTime();

  let priorIdx = 1;
  let closestDiff = Infinity;
  for (let i = 1; i < historyByDate.length; i++) {
    const diff = Math.abs(new Date(historyByDate[i].date).getTime() - targetMs);
    if (diff < closestDiff) {
      closestDiff = diff;
      priorIdx = i;
    }
  }
  return priorIdx;
}

/**
 * Attach `trend_change` + `history` payloads onto each score type of `result`,
 * comparing against the prior-period result. Mutates and returns `result`.
 *
 * Extracted verbatim from getScore (the per-key loop).
 */
export function attachTrendHistory(
  result: ScoreResult,
  priorResult: ScoreResult,
  historyByDate: Array<{ date: string; result: ScoreResult }>,
  historyMonths: number,
): ScoreResult {
  for (const key of SCORE_TYPE_KEYS) {
    const curr = result.scores[key];
    if (!curr) continue;
    const prev = priorResult.scores[key];
    const change =
      curr &&
      prev &&
      typeof curr.score === 'number' &&
      typeof prev.score === 'number'
        ? Number((curr.score - prev.score).toFixed(1))
        : 0;
    curr.trend_change = change;

    const data = historyByDate.map(({ date, result: r }) => ({
      date,
      score: r.scores[key]?.score ?? null,
    }));
    const trend: 'up' | 'down' | 'stable' =
      change > 0.01 ? 'up' : change < -0.01 ? 'down' : 'stable';
    curr.history = {
      data,
      months: historyMonths,
      trend,
      change,
    };
  }
  return result;
}

/**
 * Attach `extendedHistory` (and optional `validation`) payloads onto each score
 * type of `result`, using the full multi-year history plus optional outcome
 * data. Mutates and returns `result`.
 *
 * Extracted verbatim from getScoreWithExtendedHistory (the per-key loop).
 */
export function attachExtendedHistory(
  result: ScoreResult,
  historyByDate: Array<{ date: string; result: ScoreResult }>,
  allDates: string[],
  outcomes: Map<string, any>,
  historyYears: number,
  includeOutcomes: boolean,
): ScoreResult {
  for (const key of SCORE_TYPE_KEYS) {
    const curr = result.scores[key];
    if (!curr) continue;
    const oldest = historyByDate[historyByDate.length - 1]?.result.scores[key];
    const scoreChange =
      curr &&
      oldest &&
      typeof curr.score === 'number' &&
      typeof oldest.score === 'number'
        ? Number((curr.score - oldest.score).toFixed(1))
        : 0;
    const trend: 'up' | 'down' | 'stable' =
      scoreChange > 2 ? 'up' : scoreChange < -2 ? 'down' : 'stable';

    const historyData = historyByDate.map(({ date, result: r }) => {
      const outcomeData = outcomes.get(date);
      return {
        date,
        score: r.scores[key]?.score ?? null,
        actualReturn1Y: outcomeData?.return1y,
        actualReturn3Y: outcomeData?.return3y,
        benchmarkReturn1Y: outcomeData?.stateReturn1y,
        benchmarkReturn3Y: outcomeData?.stateReturn3y,
        excessReturn3Y: outcomeData?.excessVsState3y,
      };
    });

    (curr as any).extendedHistory = {
      data: historyData,
      years: historyYears,
      trend,
      scoreChange,
    };

    if (includeOutcomes) {
      const latestOutcome = outcomes.get(allDates[allDates.length - 1]);
      if (latestOutcome?.excessVsState3y != null) {
        (curr as any).validation = {
          hasOutcomes: true,
          excessReturn3Y: latestOutcome.excessVsState3y,
          predictedVsActual:
            latestOutcome.excessVsState3y > 2
              ? 'outperformed'
              : latestOutcome.excessVsState3y < -2
                ? 'underperformed'
                : 'matched',
        };
      } else {
        (curr as any).validation = { hasOutcomes: false };
      }
    }
  }
  return result;
}

/**
 * Compute summary statistics (count/min/max/mean/std) for a single named metric
 * across a set of location metric rows. Returns null when no finite values
 * exist. Extracted verbatim from debugGetMetricStats — pure math, no DB access.
 */
export function computeMetricStats(
  locations: any[],
  metricName: string,
): {
  count: number;
  min: number;
  max: number;
  mean: number;
  std: number;
} | null {
  const values = locations
    .map((l) => l[metricName])
    .filter((v) => v !== null && v !== undefined && !isNaN(v));

  if (values.length === 0) return null;

  const mean =
    values.reduce((a: number, b: number) => a + b, 0) / values.length;
  const variance =
    values.reduce((a: number, b: number) => a + Math.pow(b - mean, 2), 0) /
    values.length;

  return {
    count: values.length,
    min: Math.min(...values),
    max: Math.max(...values),
    mean: Math.round(mean * 100) / 100,
    std: Math.round(Math.sqrt(variance) * 100) / 100,
  };
}
