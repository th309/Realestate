/**
 * USE MARKET SNAPSHOT HOOK
 *
 * Single hook that fetches ALL metric values + scores + trends for one region.
 * Replaces 116 individual HTTP calls with 2 parallel calls.
 *
 * Usage:
 *   const { cards, scores, geography, isLoading, error } = useMarketSnapshot('metro', '12420');
 */

import { useQuery } from '@tanstack/react-query';
import { fetchMarketSnapshot, type MarketSnapshotResponse } from '../fetchers/market-snapshot';
import { fetchBatchTrendsServer, type BatchTrendEntry } from '../fetchers/trend';
import { getMetricConfig } from '../registry-helpers';
import { formatMetricValue } from '../format';
import type { GeoLevel, MetricFormat } from '../types';

export interface MarketSnapshotCard {
  value: number | null;
  formattedValue: string;
  percentChange: number | null;
  direction: 'up' | 'down' | 'stable' | null;
  isLoading: boolean;
  date: string | null;
}

export interface UseMarketSnapshotOptions {
  state?: string;
  trendMonths?: number;
  enabled?: boolean;
}

export interface UseMarketSnapshotResult {
  cards: Record<string, MarketSnapshotCard>;
  scores: MarketSnapshotResponse['scores'] | null;
  geography: MarketSnapshotResponse['geography'] | null;
  lastUpdated: string | null;
  isLoading: boolean;
  error: Error | null;
}

export function useMarketSnapshot(
  geoType: string | undefined,
  geoId: string | undefined,
  options: UseMarketSnapshotOptions = {},
): UseMarketSnapshotResult {
  const { state, trendMonths = 6, enabled = true } = options;

  const isEnabled = enabled && !!geoType && !!geoId;

  // Query 1: Fetch all snapshot data (metrics + scores) in a single call
  const snapshotQuery = useQuery<MarketSnapshotResponse>({
    queryKey: ['market-snapshot', geoType, geoId, state],
    queryFn: () => fetchMarketSnapshot(geoType!, geoId!, state),
    enabled: isEnabled,
    staleTime: 2 * 60 * 60 * 1000, // 2 hours
    gcTime: 4 * 60 * 60 * 1000, // 4 hours
  });

  // Get metric IDs from snapshot response for trend query
  const metricIds = snapshotQuery.data
    ? Object.keys(snapshotQuery.data.metrics)
    : [];

  // Query 2: Fetch all trends in a single call (fires as soon as snapshot returns)
  const trendQuery = useQuery<Record<string, BatchTrendEntry>>({
    queryKey: ['market-snapshot-trends', geoType, geoId, trendMonths, metricIds.join(',')],
    queryFn: () =>
      fetchBatchTrendsServer(
        metricIds,
        geoType as GeoLevel,
        geoId!,
        trendMonths,
      ),
    enabled: isEnabled && metricIds.length > 0,
    staleTime: 2 * 60 * 60 * 1000,
    gcTime: 4 * 60 * 60 * 1000,
  });

  // Build cards from snapshot + trend data
  const cards: Record<string, MarketSnapshotCard> = {};

  if (snapshotQuery.data) {
    const { metrics } = snapshotQuery.data;
    const trends = trendQuery.data ?? {};

    for (const [metricId, metric] of Object.entries(metrics)) {
      const config = getMetricConfig(metricId);
      const format: MetricFormat = config?.format ?? 'number';

      // Apply asPercent transformation (some metrics store decimals that need *100)
      let value = metric.value;
      if (value != null && config?.asPercent) {
        value = value * 100;
      }

      const formatted = formatMetricValue(value, format);
      const trend = trends[metricId];

      cards[metricId] = {
        value,
        formattedValue: formatted,
        percentChange: trend?.percentChange ?? null,
        direction: trend?.direction ?? null,
        isLoading: false,
        date: metric.date,
      };
    }
  }

  // If still loading, provide placeholder cards
  const isLoading = snapshotQuery.isLoading;

  return {
    cards,
    scores: snapshotQuery.data?.scores ?? null,
    geography: snapshotQuery.data?.geography ?? null,
    lastUpdated: snapshotQuery.data?.lastUpdated ?? null,
    isLoading,
    error: (snapshotQuery.error as Error) ?? (trendQuery.error as Error) ?? null,
  };
}
