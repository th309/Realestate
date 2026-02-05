/**
 * TIME SERIES DATA FETCHER
 *
 * Fetches historical time series data for a specific metric/geography/region combination.
 * Used for charts, trend calculations, and historical analysis.
 */

import type { TimeSeriesResult, TimeSeriesFetchOptions, DateRangeResponse } from '../types';
import { fetchAPI } from './base';

/**
 * Fetch time series data for a specific metric, geography level, and region.
 *
 * @param metricId - The metric ID (e.g., 'home_value', 'days_on_market')
 * @param geoLevel - The geography level (e.g., 'state', 'metro', 'county')
 * @param regionId - The region identifier (e.g., state name, CBSA code, FIPS code)
 * @param options - Optional parameters (startDate, endDate, limit, historyMonths)
 * @returns Promise<TimeSeriesResult>
 */
export async function fetchTimeSeriesData(
  metricId: string,
  geoLevel: string,
  regionId: string,
  options?: TimeSeriesFetchOptions
): Promise<TimeSeriesResult> {
  const params = new URLSearchParams();

  if (options?.startDate) params.append('startDate', options.startDate);
  if (options?.endDate) params.append('endDate', options.endDate);
  if (options?.limit != null) params.append('limit', options.limit.toString());
  if (options?.historyMonths != null && options.historyMonths > 0) {
    params.append('historyMonths', Math.min(6, options.historyMonths).toString());
  }

  const queryString = params.toString();
  const url = `/api/timeseries/${metricId}/${geoLevel}/${encodeURIComponent(regionId)}${queryString ? `?${queryString}` : ''}`;

  return fetchAPI<TimeSeriesResult>(url);
}

/**
 * Get available date range for a metric/geography combination
 *
 * @param metricId - The metric ID
 * @param geoLevel - The geography level
 * @returns Promise<DateRangeResponse>
 */
export async function fetchAvailableDates(
  metricId: string,
  geoLevel: string
): Promise<DateRangeResponse> {
  return fetchAPI<DateRangeResponse>(`/api/timeseries/dates/${metricId}/${geoLevel}`);
}

/**
 * Time series API object for backward compatibility
 */
export const timeSeriesApi = {
  /**
   * Get historical time-series data for a specific metric/geography/region.
   */
  getTimeSeries: async (
    metric: string,
    geoLevel: string,
    regionId: string,
    startDate?: string,
    endDate?: string,
    limit?: number,
    historyMonths?: number
  ): Promise<TimeSeriesResult> => {
    return fetchTimeSeriesData(metric, geoLevel, regionId, {
      startDate,
      endDate,
      limit,
      historyMonths,
    });
  },

  /**
   * Get available date range for a metric/geography combination
   */
  getAvailableDates: async (metric: string, geoLevel: string): Promise<DateRangeResponse> => {
    return fetchAvailableDates(metric, geoLevel);
  },
};
