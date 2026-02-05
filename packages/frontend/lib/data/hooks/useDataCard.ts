/**
 * DATA CARD HOOK
 *
 * Composite hook that combines snapshot data with trend data.
 * Provides everything needed to render a data card: current value,
 * formatted display, trend direction, and sparkline.
 */

import type { GeoLevel, TrendResult, TrendDirection } from '../types';
import { useSnapshotData, type UseSnapshotDataOptions } from './useSnapshotData';
import { useTrendData } from './useTrendData';

export interface UseDataCardOptions extends UseSnapshotDataOptions {
  /** Number of months for trend calculation */
  trendMonths?: number;
  /** Whether to fetch trend data (default: true) */
  includeTrend?: boolean;
}

export interface UseDataCardResult {
  /** Numeric value */
  value: number | null;
  /** Formatted value string */
  formattedValue: string;
  /** Data date */
  date: string | undefined;
  /** Trend result */
  trend: TrendResult | null;
  /** Percent change over trend period */
  percentChange: number | null;
  /** Trend direction */
  direction: TrendDirection | null;
  /** Sparkline data points */
  sparklineData: number[];
  /** Combined loading state */
  isLoading: boolean;
  /** Whether snapshot is loading */
  isSnapshotLoading: boolean;
  /** Whether trend is loading */
  isTrendLoading: boolean;
  /** Combined error */
  error: Error | null;
}

/**
 * Hook for data card display - combines current value with trend data.
 *
 * @param metricId - The metric identifier
 * @param geoLevel - Geography level
 * @param regionId - Specific region identifier
 * @param options - Query options
 *
 * @example
 * const {
 *   formattedValue,
 *   percentChange,
 *   direction,
 *   sparklineData,
 *   isLoading
 * } = useDataCard('home_value', 'county', '24001');
 */
export function useDataCard(
  metricId: string,
  geoLevel: GeoLevel,
  regionId: string,
  options: UseDataCardOptions = {}
): UseDataCardResult {
  const {
    trendMonths = 12,
    includeTrend = true,
    stateFilter,
    enabled = true,
  } = options;

  // Fetch current snapshot value
  const snapshot = useSnapshotData(metricId, geoLevel, regionId, {
    stateFilter,
    enabled,
  });

  // Fetch trend data
  const trend = useTrendData(metricId, geoLevel, regionId, {
    months: trendMonths,
    enabled: enabled && includeTrend,
  });

  // Combine loading states
  const isSnapshotLoading = snapshot.isLoading;
  const isTrendLoading = includeTrend ? trend.isLoading : false;
  const isLoading = isSnapshotLoading || isTrendLoading;

  // Combine errors (prefer snapshot error)
  const error = snapshot.error || trend.error;

  return {
    value: snapshot.value,
    formattedValue: snapshot.formattedValue,
    date: snapshot.date,
    trend: trend.trend,
    percentChange: trend.percentChange,
    direction: trend.direction,
    sparklineData: trend.sparklineData,
    isLoading,
    isSnapshotLoading,
    isTrendLoading,
    error,
  };
}

/**
 * Hook for multiple data cards at once.
 * Efficiently fetches data for several metrics.
 */
export function useDataCardBatch(
  metricIds: string[],
  geoLevel: GeoLevel,
  regionId: string,
  options: UseDataCardOptions = {}
): {
  cards: Record<string, UseDataCardResult>;
  isLoading: boolean;
  hasError: boolean;
} {
  const cards: Record<string, UseDataCardResult> = {};
  let anyLoading = false;
  let anyError = false;

  // Note: This approach works for static arrays. For dynamic arrays,
  // consider restructuring to use useQueries directly.
  for (const metricId of metricIds) {
    const result = useDataCard(metricId, geoLevel, regionId, options);
    cards[metricId] = result;
    if (result.isLoading) anyLoading = true;
    if (result.error) anyError = true;
  }

  return {
    cards,
    isLoading: anyLoading,
    hasError: anyError,
  };
}
