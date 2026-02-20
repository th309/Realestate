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
import { getMetricConfig, isMetricSupportedForGeo } from '../registry-helpers';
import { formatMetricValue } from '../format';
import type { GeoLevel, MetricFormat } from '../types';
import { useEntitlements } from '@/lib/entitlements';

const IS_DEV = process.env.NODE_ENV === 'development';

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
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
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
    staleTime: 10 * 60 * 1000, // 10 minutes (trend data)
    gcTime: 30 * 60 * 1000, // 30 minutes
  });

  // Build cards from snapshot + trend data, filtering out gated metrics
  const { isMetricGated } = useEntitlements();
  const cards: Record<string, MarketSnapshotCard> = {};

  if (snapshotQuery.data) {
    const { metrics } = snapshotQuery.data;
    const trends = trendQuery.data ?? {};

    for (const [metricId, metric] of Object.entries(metrics)) {
      // Skip metrics the user doesn't have access to
      if (isMetricGated(metricId)) continue;

      const config = getMetricConfig(metricId);
      const format: MetricFormat = config?.format ?? 'number';

      // Backend market-snapshot endpoint returns display-ready values
      // (Realtor percent cols, sale_to_list, rent_to_price_ratio already converted)
      const value = metric.value;

      // Skip metrics with no data — consumers only see metrics with values
      // Warn in dev when a metric that should be supported returns null (potential bug)
      if (value == null) {
        if (IS_DEV && geoType && isMetricSupportedForGeo(metricId, geoType as GeoLevel)) {
          console.warn(`[useMarketSnapshot] ${metricId} returned null for ${geoType}/${geoId} — expected data based on supportedGeos`);
        }
        continue;
      }

      const formatted = formatMetricValue(value, format);
      const trend = trends[metricId];

      // For 'percent' metrics (rates of change like home_value_yoy), show
      // percentage-point change instead of relative percent change.
      // E.g. YoY going from 0.7% → 1.4% should show "+0.7 pp" not "+100%".
      // For 'percent_abs' metrics (absolute rates like cap_rate, gross_yield),
      // keep the relative percent change since pp differences are tiny.
      let trendChange = trend?.percentChange ?? null;
      if (format === 'percent' && trend?.current != null && trend?.prior != null) {
        trendChange = Number((trend.current - trend.prior).toFixed(1));
      }

      cards[metricId] = {
        value,
        formattedValue: formatted,
        percentChange: trendChange,
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
