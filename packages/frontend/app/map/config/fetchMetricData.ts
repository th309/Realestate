/**
 * UNIFIED METRIC DATA FETCHING
 *
 * Single function to fetch ANY metric data for ANY geography.
 * Always returns data in the same format: Record<string, { value: number; date?: string }>
 * The "date" field enables "as of" display in tooltips.
 */

import type { GeoLevel, HomeValues } from '../types';
import { METRICS, getKeyFieldForGeo, getGeoPathSegment, getMetricConfig } from './metrics';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Unified response format - ALWAYS includes date for "as of" display
export type MetricDataEntry = { value: number; date?: string };
export type MetricData = Record<string, MetricDataEntry>;

interface ApiResponse {
  success: boolean;
  count: number;
  data: Array<{
    region_id: string;
    region_name?: string;
    value?: number;
    date?: string;
    cbsa_code?: string;
    county_fips?: string;
    postal_code?: string;
    state_abbrev?: string;
    // Allow any other fields for custom valueField
    [key: string]: any;
  }>;
}

/**
 * Fetch metric data for a given metric and geography level.
 *
 * @param metricId - The metric ID (e.g., 'home_value', 'market_heat')
 * @param geoLevel - The geography level (e.g., 'state', 'metro', 'county')
 * @param options - Optional parameters (state filter, property type, forecast horizon)
 * @returns Promise<MetricData> - Always returns { [key]: { value, date? } }
 */
export async function fetchMetricData(
  metricId: string,
  geoLevel: GeoLevel,
  options?: {
    state?: string;
    propertyType?: string;
    forecastHorizon?: string;
  }
): Promise<MetricData> {
  const config = getMetricConfig(metricId);
  if (!config) {
    console.warn(`Unknown metric: ${metricId}`);
    return {};
  }

  // Build the API URL
  const geoPath = getGeoPathSegment(geoLevel);
  let url = config.apiEndpoint.replace('{geo}', geoPath);

  // Add query parameters
  const params = new URLSearchParams();
  if (options?.state) params.append('state', options.state);
  if (options?.propertyType) params.append('propertyType', options.propertyType);
  if (options?.forecastHorizon) params.append('horizon', options.forecastHorizon);

  const queryString = params.toString();
  if (queryString) {
    url += (url.includes('?') ? '&' : '?') + queryString;
  }

  try {
    const response = await fetch(`${API_URL}${url}`);
    if (!response.ok) {
      console.error(`API error for ${metricId}: ${response.status}`);
      return {};
    }

    const data: ApiResponse = await response.json();
    return transformResponse(data, geoLevel, config);
  } catch (error) {
    console.error(`Failed to fetch ${metricId}:`, error);
    return {};
  }
}

/**
 * Transform API response to unified MetricData format.
 * ALWAYS includes date if available in response.
 */
function transformResponse(
  response: ApiResponse,
  geoLevel: GeoLevel,
  config: typeof METRICS[string]
): MetricData {
  const result: MetricData = {};

  // Determine which field to use as the key
  const keyField = config.keyField === 'auto'
    ? getKeyFieldForGeo(geoLevel)
    : config.keyField;

  // Determine which field contains the value
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
        key = item.county_fips || item.region_id;
        break;
      case 'postal_code':
        key = item.postal_code || item.region_id;
        break;
      default:
        key = item.region_id;
    }

    if (!key) return;

    // Get the value
    let value = item[valueField];
    if (value == null) return;

    value = Number(value);
    if (isNaN(value)) return;

    // Apply percentage conversion if needed
    if (config.asPercent) {
      value = value * 100;
    }

    // Store with date for "as of" display
    result[key] = {
      value,
      date: item.date,
    };
  });

  return result;
}

/**
 * Convert MetricData to HomeValues format (for backwards compatibility)
 * HomeValues supports both simple numbers and { value, date } objects
 */
export function toHomeValues(data: MetricData): HomeValues {
  // MetricData is already compatible with HomeValues
  return data as HomeValues;
}
