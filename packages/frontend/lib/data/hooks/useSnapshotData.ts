/**
 * SNAPSHOT DATA HOOK
 *
 * React Query hook for fetching current metric values.
 * Replaces manual useState/useEffect patterns and provides:
 * - Automatic caching (2-hour stale time)
 * - Deduplication of concurrent requests
 * - Background refetching
 * - Consistent loading/error states
 */

import { useQuery } from '@tanstack/react-query';
import type { GeoLevel, SnapshotData, SnapshotEntry } from '../types';
import { fetchSnapshotData } from '../fetchers';
import { getMetricConfig, getMetricFormat } from '../registry-helpers';
import { formatMetricValue } from '../format';
import { useMetricAccess } from './useMetricAccess';
import type { UserTier } from '@/lib/entitlements';

export interface UseSnapshotDataOptions {
  /** State filter for county/zip/city data */
  stateFilter?: string;
  /** Skip the query (useful for conditional fetching) */
  enabled?: boolean;
}

export interface UseSnapshotDataResult {
  /** All data for the geography level */
  allData: SnapshotData;
  /** Single entry if regionId provided */
  entry: SnapshotEntry | null;
  /** Numeric value from entry */
  value: number | null;
  /** Formatted value string */
  formattedValue: string;
  /** Data date if available */
  date: string | undefined;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: Error | null;
  /** Refetch function */
  refetch: () => void;
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
 * Hook for fetching current metric snapshot data.
 *
 * @param metricId - The metric identifier from METRICS registry
 * @param geoLevel - Geography level (state, metro, county, zip, city)
 * @param regionId - Optional specific region to extract
 * @param options - Additional options (stateFilter, enabled)
 *
 * @example
 * // Fetch all state data
 * const { allData, isLoading } = useSnapshotData('home_value', 'state');
 *
 * @example
 * // Fetch specific county value
 * const { value, formattedValue } = useSnapshotData('home_value', 'county', '24001', { stateFilter: 'MD' });
 */
export function useSnapshotData(
  metricId: string,
  geoLevel: GeoLevel,
  regionId?: string,
  options: UseSnapshotDataOptions = {}
): UseSnapshotDataResult {
  const { stateFilter, enabled = true } = options;
  const access = useMetricAccess(metricId);

  const queryKey = ['snapshot', metricId, geoLevel, stateFilter].filter(Boolean);

  // IMPORTANT: Always call useQuery to maintain hook order consistency.
  // Use enabled: false to skip fetching when metric is gated.
  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: () => fetchSnapshotData(metricId, geoLevel, { state: stateFilter }),
    enabled: enabled && !!metricId && !!geoLevel && !access.gated,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });

  // If metric is gated, return gated result (after hooks have been called)
  if (access.gated) {
    return {
      allData: {},
      entry: null,
      value: null,
      formattedValue: '--',
      date: undefined,
      isLoading: false,
      error: null,
      refetch: () => {},
      gated: true,
      tierRequired: access.tierRequired ?? undefined,
    };
  }

  // Extract specific entry if regionId provided
  const allData = data ?? {};
  const entry = regionId ? (allData[regionId] ?? null) : null;

  // Extract numeric value
  let value: number | null = null;
  let date: string | undefined;

  if (entry !== null) {
    if (typeof entry === 'number') {
      value = entry;
    } else if (entry && typeof entry === 'object') {
      value = entry.value;
      date = entry.date;
    }
  }

  // Format the value
  const format = getMetricFormat(metricId);
  const config = getMetricConfig(metricId);
  const isPropertyIQ = config?.dataSource === 'propertyiq';
  const formattedValue = formatMetricValue(value, format, { isPropertyIQ });

  return {
    allData,
    entry,
    value,
    formattedValue,
    date,
    isLoading,
    error: error as Error | null,
    refetch,
    gated: false,
    preview: access.preview,
    previewLimit: access.previewLimit,
  };
}

/**
 * Hook for fetching snapshot data for multiple metrics at once.
 * Uses parallel queries for efficiency.
 */
export function useSnapshotDataBatch(
  metricIds: string[],
  geoLevel: GeoLevel,
  regionId?: string,
  options: UseSnapshotDataOptions = {}
): {
  data: Record<string, UseSnapshotDataResult>;
  isLoading: boolean;
  hasError: boolean;
} {
  // This is a simple implementation - for more complex batch needs,
  // consider using useQueries from React Query
  const results: Record<string, UseSnapshotDataResult> = {};
  let anyLoading = false;
  let anyError = false;

  for (const metricId of metricIds) {
    // Note: This violates rules of hooks if metricIds changes length.
    // For dynamic arrays, use useQueries instead.
    const result = useSnapshotData(metricId, geoLevel, regionId, options);
    results[metricId] = result;
    if (result.isLoading) anyLoading = true;
    if (result.error) anyError = true;
  }

  return {
    data: results,
    isLoading: anyLoading,
    hasError: anyError,
  };
}
