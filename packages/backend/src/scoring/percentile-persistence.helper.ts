/**
 * Percentile Persistence (I/O)
 *
 * Upserts computed percentile statistics into the metric_percentiles table.
 * Takes the SupabaseClient as an explicit parameter.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { PercentileStats, toInternalMetricName } from './percentile.types';

export async function savePercentiles(
  supabase: SupabaseClient,
  stats: PercentileStats,
): Promise<void> {
  // Convert Realtor column name to internal scoring metric name
  const internalMetricName = toInternalMetricName(stats.metricName);

  const { error } = await supabase.from('metric_percentiles').upsert(
    {
      metric_name: internalMetricName, // Use internal scoring metric names
      geography_type: stats.geographyType,
      period_date: stats.periodDate,
      p10: stats.p10,
      p20: stats.p20,
      p30: stats.p30,
      p40: stats.p40,
      p50: stats.p50,
      p60: stats.p60,
      p70: stats.p70,
      p80: stats.p80,
      p90: stats.p90,
      min_value: stats.min,
      max_value: stats.max,
      count_values: stats.count,
      mean_value: stats.mean,
      stddev_value: stats.stddev,
      calculated_at: new Date().toISOString(),
    },
    {
      onConflict: 'metric_name,geography_type,period_date',
    },
  );

  if (error) {
    console.error('Error saving percentiles:', error);
    throw error;
  }
}
