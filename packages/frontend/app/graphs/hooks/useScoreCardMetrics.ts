/**
 * useScoreCardMetrics - Hook for Score Card Metric Data
 *
 * Simplifies the data fetching for score cards by leveraging useDataCardBatch.
 * Replaces the manual useEffect fetch logic in ScoreCards.tsx.
 *
 * Usage:
 *   const { indicators, loading } = useScoreCardMetrics({
 *     metricIds: ['home_value_yoy', 'days_on_market', 'for_sale_inventory'],
 *     geoLevel: 'metro',
 *     regionId: '31080',
 *   });
 */

'use client';

import { useMemo } from 'react';
import { useDataCardBatch, DataCardResult } from '@/app/map/hooks/useDataCard';
import { getMetricConfig } from '@/app/map/config/metrics';
import type { GeoLevel } from '@/app/map/config/metrics';

export interface ScoreCardIndicator {
    metricId: string;
    label: string;
    formattedValue: string;
    trend: {
        currentValue: number | null;
        previousValue: number | null;
        changePercent: number | null;
        direction: 'up' | 'down' | 'flat' | null;
    };
    history: { date: string; value: number }[]; // For sparklines
}

export interface UseScoreCardMetricsOptions {
    metricIds: string[];
    geoLevel: GeoLevel;
    regionId: string;
}

export interface UseScoreCardMetricsResult {
    indicators: ScoreCardIndicator[];
    loading: boolean;
    error: Error | null;
}

export function useScoreCardMetrics(
    options: UseScoreCardMetricsOptions
): UseScoreCardMetricsResult {
    const { metricIds, geoLevel, regionId } = options;

    // Use the batch hook to fetch all metrics with trends
    const metricResults = useDataCardBatch(metricIds, geoLevel, regionId, true);

    // Transform to the indicator format expected by ScoreCard component
    const indicators = useMemo((): ScoreCardIndicator[] => {
        return metricIds.map(id => {
            const result = metricResults[id];
            const config = getMetricConfig(id);
            const label = config?.title || id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

            return {
                metricId: id,
                label,
                formattedValue: result?.formattedValue || '--',
                trend: {
                    currentValue: result?.value ?? null,
                    previousValue: null, // Not tracked separately in new hook
                    changePercent: result?.trend.changePercent ?? null,
                    direction: result?.trend.direction ?? null,
                },
                history: result?.trendHistory || [],
            };
        });
    }, [metricIds, metricResults]);

    // Check if any metrics are still loading
    const loading = useMemo(() => {
        return Object.values(metricResults).some(r => r.loading);
    }, [metricResults]);

    // Get first error if any
    const error = useMemo(() => {
        for (const result of Object.values(metricResults)) {
            if (result.error) return result.error;
        }
        return null;
    }, [metricResults]);

    return { indicators, loading, error };
}
