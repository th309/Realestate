import { SupabaseClient } from '@supabase/supabase-js';
import {
  GeographyLevel,
  ScoreType,
  ALERT_THRESHOLDS,
  FORMULA_VERSION,
} from './formula-weights';
import { PerformanceMetrics, AlertResult } from './performance-tracking.types';

/**
 * Performance metric aggregation + alert checks extracted from
 * PerformanceTrackingService. I/O helpers take the Supabase client as an
 * explicit first parameter instead of reading it off `this`.
 */

/**
 * Get performance metrics for a specific geography and score type.
 */
export async function fetchPerformanceMetrics(
  supabase: SupabaseClient,
  geography: GeographyLevel,
  scoreType: ScoreType,
): Promise<PerformanceMetrics> {
  // Query the performance metrics view
  const { data: metrics } = await supabase
    .from('score_performance_metrics')
    .select('*')
    .eq('geography', geography)
    .eq('score_type', scoreType)
    .single();

  // Get the active formula version
  const { data: formula } = await supabase
    .from('formula_versions')
    .select('version')
    .eq('geography', geography)
    .eq('score_type', scoreType)
    .eq('status', 'active')
    .single();

  // Get the last validation date
  const { data: lastValidation } = await supabase
    .from('score_performance_tracking')
    .select('validated_1y_at')
    .eq('geography', geography)
    .eq('score_type', scoreType)
    .not('validated_1y_at', 'is', null)
    .order('validated_1y_at', { ascending: false })
    .limit(1);

  // Calculate validation period (last 24 months of validated predictions)
  const now = new Date();
  const twoYearsAgo = new Date(now.getFullYear() - 2, now.getMonth(), 1);
  const validationPeriod = `${twoYearsAgo.toISOString().slice(0, 7)} to ${now.toISOString().slice(0, 7)}`;

  // Determine status
  const topBeatRate = metrics?.top_quintile_beat_rate ?? 0;
  const spread = metrics?.spread ?? 0;
  let status: 'healthy' | 'warning' | 'critical' = 'healthy';

  if (
    topBeatRate < ALERT_THRESHOLDS.top_quintile_beat_rate.critical ||
    spread < ALERT_THRESHOLDS.spread.critical
  ) {
    status = 'critical';
  } else if (
    topBeatRate < ALERT_THRESHOLDS.top_quintile_beat_rate.warning ||
    spread < ALERT_THRESHOLDS.spread.warning
  ) {
    status = 'warning';
  }

  return {
    geography,
    score_type: scoreType,
    validation_period: validationPeriod,
    metrics: {
      top_quintile_beat_rate: metrics?.top_quintile_beat_rate ?? null,
      top_quintile_return: metrics?.top_quintile_return ?? null,
      bottom_quintile_beat_rate: metrics?.bottom_quintile_beat_rate ?? null,
      bottom_quintile_return: metrics?.bottom_quintile_return ?? null,
      spread: metrics?.spread ?? null,
      predictions_validated: metrics?.total_predictions ?? 0,
    },
    status,
    formula_version: formula?.version ?? FORMULA_VERSION,
    last_validated: lastValidation?.[0]?.validated_1y_at ?? null,
  };
}

/**
 * Get performance metrics for all geography/score type combinations.
 */
export async function fetchAllPerformanceMetrics(
  supabase: SupabaseClient,
): Promise<PerformanceMetrics[]> {
  const geographies: GeographyLevel[] = ['metro', 'county', 'zip'];
  const scoreTypes: ScoreType[] = ['propertyiq'];
  const results: PerformanceMetrics[] = [];

  for (const geography of geographies) {
    for (const scoreType of scoreTypes) {
      const metrics = await fetchPerformanceMetrics(
        supabase,
        geography,
        scoreType,
      );
      results.push(metrics);
    }
  }

  return results;
}

/**
 * Check for performance alerts.
 */
export async function checkAlerts(
  supabase: SupabaseClient,
): Promise<AlertResult[]> {
  // Use the database function to check alerts
  const { data, error } = await supabase.rpc('check_score_performance');

  if (error) {
    console.error('Error checking alerts:', error);
    return [];
  }

  return (data || []).map((row: any) => ({
    geography: row.geography,
    score_type: row.score_type,
    metric: row.metric,
    current_value: row.current_value,
    threshold: row.threshold,
    status: row.status as 'OK' | 'WARNING' | 'CRITICAL',
  }));
}

/**
 * Get only critical and warning alerts.
 */
export async function fetchActiveAlerts(
  supabase: SupabaseClient,
): Promise<AlertResult[]> {
  const alerts = await checkAlerts(supabase);
  return alerts.filter(
    (a) => a.status === 'CRITICAL' || a.status === 'WARNING',
  );
}
