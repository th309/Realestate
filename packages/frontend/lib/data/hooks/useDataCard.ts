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
import { useMetricAccess } from './useMetricAccess';
import { isMetricSupportedForGeo } from '../registry-helpers';
import type { UserTier } from '@/lib/entitlements';

const IS_DEV = process.env.NODE_ENV === 'development';

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
  /** Resolved source/provider */
  source: string | null;
  /** Source geography ID used for resolution */
  sourceGeoId: string | null;
  /** Source geography level used for resolution */
  sourceGeoLevel: 'metro' | 'county' | 'zip' | 'state' | 'national' | null;
  /** Was value inherited from parent geography */
  isInherited: boolean;
  /** Was value resolved via fallback source */
  isFallback: boolean;
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
  /** Whether metric is gated by entitlements */
  gated: boolean;
  /** Tier required to unlock */
  tierRequired?: UserTier;
  /** Whether in preview mode */
  preview?: boolean;
  /** Preview limit */
  previewLimit?: number | null;
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

  const access = useMetricAccess(metricId);

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
    source: snapshot.source,
    sourceGeoId: snapshot.sourceGeoId,
    sourceGeoLevel: snapshot.sourceGeoLevel,
    isInherited: snapshot.isInherited,
    isFallback: snapshot.isFallback,
    trend: trend.trend,
    percentChange: trend.percentChange,
    direction: trend.direction,
    sparklineData: trend.sparklineData,
    isLoading,
    isSnapshotLoading,
    isTrendLoading,
    error,
    gated: access.gated,
    tierRequired: access.tierRequired ?? undefined,
    preview: access.preview,
    previewLimit: access.previewLimit,
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
  const allCards: Record<string, UseDataCardResult> = {};
  let anyLoading = false;
  let anyError = false;

  // Note: This approach works for static arrays. For dynamic arrays,
  // consider restructuring to use useQueries directly.
  for (const metricId of metricIds) {
    const result = useDataCard(metricId, geoLevel, regionId, options);
    allCards[metricId] = result;
    if (result.isLoading) anyLoading = true;
    if (result.error) anyError = true;
  }

  // Keep all entries (including nulls) so the UI can render "unavailable" placeholders.
  // Previously nulls were silently dropped, causing cards to disappear instead of
  // showing a clear "no data" state.
  if (IS_DEV) {
    for (const [metricId, result] of Object.entries(allCards)) {
      if (!result.isLoading && result.value == null && isMetricSupportedForGeo(metricId, geoLevel)) {
        console.warn(`[useDataCardBatch] ${metricId} returned null for ${geoLevel}/${regionId} — expected data based on supportedGeos`);
      }
    }
  }

  return {
    cards: allCards,
    isLoading: anyLoading,
    hasError: anyError,
  };
}
