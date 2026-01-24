/**
 * useDataCard - Card Display Hook
 *
 * Provides formatted metric data for card-style displays.
 * Includes optional trend calculation (YoY, MoM, 3-month).
 *
 * Usage:
 *   const { formattedValue, trend, loading } = useDataCard({
 *     metricId: 'home_value',
 *     geoLevel: 'metro',
 *     regionId: '31080',
 *   });
 */

'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useMetricData, MetricDataPoint } from './useMetricData';
import { getMetricConfig, GeoLevel, MetricFormat, getGeoPathSegment } from '@/app/map/config/metrics';
import { formatValue } from '@/app/map/utils/metricUtils';
import { api } from '@/lib/api/client';

const CACHE_TIME = 2 * 60 * 60 * 1000; // 2 hours

export interface TrendData {
    direction: 'up' | 'down' | 'flat' | null;
    changePercent: number | null;
    label: string | null;
}

export interface DataCardResult {
    value: number | null;
    formattedValue: string;
    format: MetricFormat;
    trend: TrendData;
    trendHistory: { date: string; value: number }[]; // Full historical data for sparklines
    date: string | undefined;
    loading: boolean;
    error: Error | null;
}

export interface UseDataCardOptions {
    metricId: string;
    geoLevel: GeoLevel;
    regionId: string;
    showTrend?: boolean; // If true, fetches historical data for trend calculation
}

export function useDataCard(options: UseDataCardOptions): DataCardResult {
    const { metricId, geoLevel, regionId, showTrend = false } = options;

    // Get current value using the core hook
    const {
        data: currentData,
        loading: dataLoading,
        error: dataError,
        formattedValue,
        format,
    } = useMetricData(metricId, geoLevel, regionId);

    // Fetch time series for trend if enabled
    const { data: trendData, isLoading: trendLoading } = useQuery({
        queryKey: ['metric-trend', metricId, geoLevel, regionId],
        queryFn: async () => {
            // Fetch last 4 months of data for 3-month trend
            const endDate = new Date().toISOString().split('T')[0];
            const startDate = new Date();
            startDate.setMonth(startDate.getMonth() - 4);
            const startDateStr = startDate.toISOString().split('T')[0];

            const response = await api.getTimeSeries(
                metricId,
                geoLevel,
                regionId,
                startDateStr,
                endDate,
            );

            if (!response.success || response.data.length < 2) {
                return null;
            }

            return response.data as { date: string; value: number }[];
        },
        staleTime: CACHE_TIME,
        gcTime: CACHE_TIME,
        enabled: showTrend && !!regionId,
    });

    // Calculate trend from time series data
    const trend = useMemo((): TrendData => {
        if (!showTrend || !trendData || trendData.length < 2) {
            return { direction: null, changePercent: null, label: null };
        }

        // Sort by date descending (most recent first)
        const sorted = [...trendData].sort((a, b) =>
            new Date(b.date).getTime() - new Date(a.date).getTime()
        );

        const currentValue = sorted[0].value;

        // Find value from approximately 3 months ago
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

        let previousValue: number | null = null;
        let closestDiff = Infinity;

        for (const point of sorted) {
            const pointDate = new Date(point.date);
            const diff = Math.abs(pointDate.getTime() - threeMonthsAgo.getTime());
            if (diff < closestDiff && pointDate < new Date(sorted[0].date)) {
                closestDiff = diff;
                previousValue = point.value;
            }
        }

        // Fallback to oldest available if no match
        if (previousValue === null && sorted.length > 1) {
            previousValue = sorted[sorted.length - 1].value;
        }

        if (previousValue === null || previousValue === 0) {
            return { direction: null, changePercent: null, label: null };
        }

        const config = getMetricConfig(metricId);
        const isPercentageMetric = config?.format === 'percent';

        let changePercent: number;
        let label: string;

        if (isPercentageMetric) {
            // For percentage metrics, show percentage point difference
            // e.g., 5% - 2% = +3.0 points
            changePercent = currentValue - previousValue;
            const sign = changePercent > 0 ? '+' : '';
            label = `${sign}${changePercent.toFixed(1)} pts`;
        } else {
            // For absolute metrics, show relative percentage change
            // e.g., ($250k - $200k) / $200k = +25%
            changePercent = ((currentValue - previousValue) / Math.abs(previousValue)) * 100;
            const sign = changePercent > 0 ? '+' : '';
            label = `${sign}${changePercent.toFixed(1)}%`;
        }

        let direction: 'up' | 'down' | 'flat';
        if (Math.abs(changePercent) < 0.1) {
            direction = 'flat';
        } else if (changePercent > 0) {
            direction = 'up';
        } else {
            direction = 'down';
        }

        return { direction, changePercent, label };
    }, [showTrend, trendData]);

    return {
        value: currentData?.value ?? null,
        formattedValue,
        format,
        trend,
        trendHistory: trendData || [],
        date: currentData?.date,
        loading: dataLoading || (showTrend && trendLoading),
        error: dataError,
    };
}

/**
 * Fetch multiple metrics for a single card (e.g., score cards with 3 sub-metrics)
 */
export function useDataCardBatch(
    metricIds: string[],
    geoLevel: GeoLevel,
    regionId: string,
    showTrend: boolean = false,
): Record<string, DataCardResult> {
    const results: Record<string, DataCardResult> = {};

    for (const metricId of metricIds) {
        // React Query handles deduplication automatically
        // eslint-disable-next-line react-hooks/rules-of-hooks
        results[metricId] = useDataCard({
            metricId,
            geoLevel,
            regionId,
            showTrend,
        });
    }

    return results;
}
