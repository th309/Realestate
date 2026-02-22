import { useQuery } from '@tanstack/react-query';
import type { GeoLevel } from '../types';
import { fetchDataFreshness, type DataFreshnessResponse } from '../fetchers/freshness';
import { formatMetricFreshnessDate, resolveMetricFreshnessDate } from '../freshness';

export interface UseDataFreshnessResult {
  data: DataFreshnessResponse | undefined;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useDataFreshness(): UseDataFreshnessResult {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['data-freshness'],
    queryFn: fetchDataFreshness,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  return {
    data,
    isLoading,
    error: error as Error | null,
    refetch,
  };
}

export interface UseMetricFreshnessResult extends UseDataFreshnessResult {
  rawDate: string | null;
  formattedDate: string;
}

export function useMetricFreshness(metricId: string, geoLevel?: GeoLevel | null): UseMetricFreshnessResult {
  const base = useDataFreshness();
  const rawDate = resolveMetricFreshnessDate(metricId, base.data, geoLevel);
  const formattedDate = formatMetricFreshnessDate(metricId, base.data, geoLevel);

  return {
    ...base,
    rawDate,
    formattedDate,
  };
}

