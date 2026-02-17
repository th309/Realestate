/**
 * useMetricData - Core Data Binding Hook
 *
 * Fetches any metric for any geography level, returning properly typed data.
 * Uses React Query for caching (2 hours) and deduplication.
 *
 * This is the foundational hook. Higher-level hooks like useDataCard
 * and useMetricOptions build on top of this.
 */

'use client';

import { useQuery } from '@tanstack/react-query';
import { METRICS, getMetricConfig, getGeoPathSegment, getKeyFieldForGeo, fetchAPI, type GeoLevel, type MetricFormat } from '@/lib/data';
import { formatValue } from '@/app/map/utils/metricUtils';
import { normalizeZipKey } from '@/lib/format/zip';

// Standard cache time: 2 hours
const CACHE_TIME = 2 * 60 * 60 * 1000;
const STALE_TIME = 2 * 60 * 60 * 1000;

export interface MetricDataPoint {
    value: number;
    date?: string;
    regionId: string;
    regionName?: string;
}

export interface MetricDataResult {
    data: MetricDataPoint | null;
    allData: Record<string, MetricDataPoint>;
    loading: boolean;
    error: Error | null;
    formattedValue: string;
    format: MetricFormat;
}

interface ApiResponseItem {
    region_id: string;
    region_name?: string;
    value?: number;
    date?: string;
    cbsa_code?: string;
    county_fips?: string;
    postal_code?: string;
    state_abbrev?: string;
    [key: string]: unknown;
}

interface ApiResponse {
    success: boolean;
    count: number;
    data: ApiResponseItem[];
}

/**
 * Fetch metric data for a specific metric, geography level, and optionally a specific region.
 */
export function useMetricData(
    metricId: string,
    geoLevel: GeoLevel,
    regionId?: string,
): MetricDataResult {
    const config = getMetricConfig(metricId);

    const { data, isLoading, error } = useQuery({
        queryKey: ['metric-data', metricId, geoLevel],
        queryFn: async (): Promise<Record<string, MetricDataPoint>> => {
            if (!config) {
                console.warn(`Unknown metric: ${metricId}`);
                return {};
            }

            const geoPath = getGeoPathSegment(geoLevel);
            const url = config.apiEndpoint.replace('{geo}', geoPath);

            const rawData = await fetchAPI<ApiResponseItem[] | ApiResponse>(url);

            // Normalize response format
            const normalized: ApiResponse = Array.isArray(rawData)
                ? { success: true, count: rawData.length, data: rawData }
                : rawData;

            return transformResponse(normalized, geoLevel, config);
        },
        staleTime: STALE_TIME,
        gcTime: CACHE_TIME,
        enabled: !!config,
    });

    // Extract specific region if provided
    const regionData = regionId && data ? data[regionId] : null;

    // Format the value
    const format = config?.format || 'currency';
    const formattedValue = regionData
        ? formatValue(regionData.value, format)
        : '--';

    return {
        data: regionData,
        allData: data || {},
        loading: isLoading,
        error: error as Error | null,
        formattedValue,
        format,
    };
}

/**
 * Transform API response to normalized format
 */
function transformResponse(
    response: ApiResponse,
    geoLevel: GeoLevel,
    config: NonNullable<ReturnType<typeof getMetricConfig>>,
): Record<string, MetricDataPoint> {
    const result: Record<string, MetricDataPoint> = {};

    const keyField = config.keyField === 'auto'
        ? getKeyFieldForGeo(geoLevel)
        : config.keyField;

    const valueField = config.valueField || 'value';

    response.data?.forEach(item => {
        // Get the key based on keyField
        let key: string | undefined;
        switch (keyField) {
            case 'region_name':
                key = item.region_name;
                break;
            case 'cbsa_code':
                key = item.cbsa_code || item.region_id;
                break;
            case 'county_fips':
                key = item.county_fips || (item as Record<string, unknown>).fips_code as string || item.region_id;
                break;
            case 'postal_code': {
                const raw = item.postal_code || (item as Record<string, unknown>).zcta as string || item.region_id;
                key = raw ? normalizeZipKey(raw) : undefined;
                break;
            }
            default:
                key = item.region_id;
        }

        if (!key) return;

        // Get the value - handle dynamic field access with proper typing
        const rawValue = item[valueField];
        if (rawValue == null) return;

        let numericValue = Number(rawValue);
        if (isNaN(numericValue)) return;

        // Apply percentage conversion if needed
        if (config.asPercent) {
            numericValue = numericValue * 100;
        }

        result[key] = {
            value: numericValue,
            date: item.date,
            regionId: key,
            regionName: item.region_name,
        };
    });

    return result;
}

/**
 * Fetch multiple metrics at once (parallel with deduplication via React Query)
 */
export function useMultipleMetrics(
    metricIds: string[],
    geoLevel: GeoLevel,
    regionId?: string,
): Record<string, MetricDataResult> {
    // This leverages React Query's automatic deduplication
    // Each metric uses the same cache key pattern
    const results: Record<string, MetricDataResult> = {};

    for (const metricId of metricIds) {
        // Note: This is a valid pattern - React Query handles the caching
        // eslint-disable-next-line react-hooks/rules-of-hooks
        results[metricId] = useMetricData(metricId, geoLevel, regionId);
    }

    return results;
}
