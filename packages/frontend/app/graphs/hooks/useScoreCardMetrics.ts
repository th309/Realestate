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
import { useDataCardBatch } from '@/app/map/hooks/useDataCard';
import { getMetricConfig, type GeoLevel } from '@/lib/data';

export interface ScoreCardIndicator {
    metricId: string;
    label: string;
    formattedValue: string;
    source: string | null;
    sourceGeoId: string | null;
    sourceGeoLevel: 'metro' | 'county' | 'zip' | 'state' | 'national' | null;
    isInherited: boolean;
    isFallback: boolean;
    trend: {
        currentValue: number | null;
        previousValue: number | null;
        changePercent: number | null;
        direction: 'up' | 'down' | 'flat' | null;
    };
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
    // Only include metrics that have actual data (useDataCardBatch already filters nulls)
    const indicators = useMemo((): ScoreCardIndicator[] => {
        return metricIds
            .filter(id => {
                const result = metricResults[id];
                // Keep while loading; drop if loaded with no data
                return result?.loading || (result?.value != null);
            })
            .map(id => {
                const result = metricResults[id];
                const config = getMetricConfig(id);
                const label = config?.title || id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

                return {
                    metricId: id,
                    label,
                    formattedValue: result?.formattedValue || '--',
                    source: result?.source ?? null,
                    sourceGeoId: result?.sourceGeoId ?? null,
                    sourceGeoLevel: result?.sourceGeoLevel ?? null,
                    isInherited: result?.isInherited ?? false,
                    isFallback: result?.isFallback ?? false,
                    trend: {
                        currentValue: result?.value ?? null,
                        previousValue: null, // Not tracked separately in new hook
                        changePercent: result?.trend.changePercent ?? null,
                        direction: result?.trend.direction ?? null,
                    },
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
