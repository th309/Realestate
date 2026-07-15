import { SupabaseClient } from '@supabase/supabase-js';

/**
 * metric_id -> column name for metrics that live in propertyiq_scores_v2
 * (the live score table), not calculated_metrics. median_price is the
 * region's ZHVI captured at score-computation time (see
 * propertyiq-data-fetcher.ts's `median_price: now` assignment, `now` being
 * the current-month ZHVI) — same underlying value as the map's home_value
 * metric, just sourced from the score table instead of calculated_metrics.
 */
const SCORE_TABLE_COLUMNS: Record<string, string> = {
  propertyiq_score: 'score',
  median_price: 'median_price',
};

/**
 * Resolves the current value of a user_alerts metric_name for a geography,
 * routing to propertyiq_scores_v2 for score-table metrics and falling back
 * to calculated_metrics for everything else.
 */
export async function fetchCurrentMetricValue(
  client: SupabaseClient,
  metricId: string,
  geoType: string,
  geoId: string,
): Promise<number | null> {
  // Metrics that live in propertyiq_scores_v2 rather than calculated_metrics.
  // Take the latest score_date for this geography.
  const scoreTableColumn = SCORE_TABLE_COLUMNS[metricId];
  if (scoreTableColumn) {
    const { data: scoreRow } = await client
      .from('propertyiq_scores_v2')
      .select(scoreTableColumn)
      .eq('geography', geoType)
      .eq('location_id', geoId)
      .eq('score_type', 'propertyiq')
      .order('score_date', { ascending: false })
      .limit(1)
      .single();

    const value = (scoreRow as any)?.[scoreTableColumn];
    return value != null ? Number(value) : null;
  }

  // Try calculated_metrics first (most metrics are there)
  const { data } = await client
    .from('calculated_metrics')
    .select(metricId)
    .eq('geography_type', geoType)
    .eq('geography_id', geoId)
    .order('period_date', { ascending: false })
    .limit(1)
    .single();

  if ((data as any)?.[metricId] != null) return Number((data as any)[metricId]);
  return null;
}
