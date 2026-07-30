/**
 * Pure (stateless) helpers for cohort retention.
 * No I/O — all functions take plain data and return plain data.
 * Consumed by RetentionAnalyticsService.
 *
 * These used to do the aggregation itself, over session rows fetched into Node.
 * That is now `analytics_cohort_retention` (see the 20260729212500 migration):
 * an unranged `.select()` is capped at 1,000 rows by PostgREST without erroring,
 * so grouping in JS meant grouping a silent slice. What is left here is the part
 * that genuinely belongs in the application — turning counts into the shape the
 * dashboard renders. SQL should not be deciding percentages.
 */

import type { CohortRow } from './user-analytics.types';

/** One element of the jsonb document `analytics_cohort_retention` returns. */
export interface CohortRetentionRpcRow {
  /** Session tier, or `__all__` when the RPC was not asked to split by tier. */
  tier: string;
  /** Monday of the signup week, `YYYY-MM-DD`. */
  cohort_week: string;
  cohort_size: number;
  /** Distinct users active in week i after signup, index 0 = signup week. */
  weekly_active: number[];
}

/** Sentinel tier the RPC emits when p_by_tier is false. Never displayed. */
export const UNSPLIT_TIER = '__all__';

// ---------------------------------------------------------------------------
// Counts -> the rendered matrix
// ---------------------------------------------------------------------------

export function toCohortRows(rows: CohortRetentionRpcRow[]): CohortRow[] {
  return [...rows]
    .sort((a, b) => a.cohort_week.localeCompare(b.cohort_week))
    .map((row) => {
      const cohortSize = Number(row.cohort_size ?? 0);
      return {
        cohort: row.cohort_week,
        cohortSize,
        weeks: toWeeklyRetentionPercentages(
          row.weekly_active ?? [],
          cohortSize,
        ),
      };
    });
}

/**
 * Week 0 is pinned to 100 rather than computed: every member of a cohort is by
 * definition present in their own signup week, and a user who signed up without
 * a recorded session would otherwise render as a cohort that starts below 100%.
 *
 * The series stops at the first empty week instead of trailing zeros, so a
 * young cohort shows a short row rather than a curve that appears to collapse.
 */
export function toWeeklyRetentionPercentages(
  activeByWeek: number[],
  cohortSize: number,
): number[] {
  const weeks: number[] = [];
  for (let week = 0; week < activeByWeek.length; week++) {
    const active = Number(activeByWeek[week] ?? 0);
    if (active === 0 && week > 0) break;
    if (week === 0) {
      weeks.push(100);
      continue;
    }
    weeks.push(
      cohortSize > 0 ? parseFloat(((active / cohortSize) * 100).toFixed(1)) : 0,
    );
  }
  return weeks;
}

// ---------------------------------------------------------------------------
// Tier-curve aggregation
// ---------------------------------------------------------------------------

export function buildTierCurves(
  rows: CohortRetentionRpcRow[],
): { tier: string; curve: number[] }[] {
  const byTier = new Map<string, CohortRetentionRpcRow[]>();
  for (const row of rows) {
    if (!row.tier || row.tier === UNSPLIT_TIER) continue;
    if (!byTier.has(row.tier)) byTier.set(row.tier, []);
    byTier.get(row.tier)!.push(row);
  }

  return Array.from(byTier.entries()).map(([tier, tierRows]) => ({
    tier,
    curve: averageWeeklyCurveAcrossCohorts(toCohortRows(tierRows)),
  }));
}

/**
 * Averages only the cohorts that reached a given week. A cohort three weeks old
 * has no week-8 number, and counting its absence as 0% would drag the tail of
 * every curve down purely because recent cohorts exist.
 */
export function averageWeeklyCurveAcrossCohorts(rows: CohortRow[]): number[] {
  const maxWeeks = rows.reduce((m, r) => Math.max(m, r.weeks.length), 0);
  const curve: number[] = [];
  for (let w = 0; w < maxWeeks; w++) {
    const rates = rows.map((r) => r.weeks[w] ?? 0).filter((v) => v > 0);
    curve.push(
      rates.length > 0
        ? parseFloat(
            (rates.reduce((a, b) => a + b, 0) / rates.length).toFixed(1),
          )
        : 0,
    );
  }
  return curve;
}
