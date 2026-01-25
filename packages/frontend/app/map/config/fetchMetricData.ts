/**
 * UNIFIED METRIC DATA FETCHING
 *
 * Single function to fetch ANY metric data for ANY geography.
 * Always returns data in the same format: Record<string, { value: number; date?: string }>
 * The "date" field enables "as of" display in tooltips.
 */

import { normalizeZipKey } from '@/lib/format/zip';
import type { GeoLevel, HomeValues } from '../types';
import { METRICS, getKeyFieldForGeo, getGeoPathSegment, getMetricConfig } from './metrics';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Unified response format - ALWAYS includes date for "as of" display
// value may be null when metric is undefined (e.g. SF/MF ratio when total permits = 0)
export type MetricDataEntry = { value: number | null; date?: string };
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

  // Cost of living at national level: baseline 100 (US average)
  if (metricId === 'cost_of_living' && geoLevel === 'national') {
    return { 'United States': { value: 100 } };
  }

  // Special handling for PropertyIQ scores - use paginated endpoint
  if (config.dataSource === 'propertyiq') {
    return fetchPropertyIQScoreData(metricId, geoLevel, config, options);
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

    const rawData = await response.json();

    // Normalize response format: some endpoints return arrays directly,
    // others return { success, count, data } wrapper
    const normalizedData: ApiResponse = Array.isArray(rawData)
      ? { success: true, count: rawData.length, data: rawData }
      : rawData;

    return transformResponse(normalizedData, geoLevel, config);
  } catch (error) {
    console.error(`Failed to fetch ${metricId}:`, error);
    return {};
  }
}

/**
 * Fetch PropertyIQ score data with pagination support
 */
async function fetchPropertyIQScoreData(
  metricId: string,
  geoLevel: GeoLevel,
  config: typeof METRICS[string],
  options?: {
    state?: string;
    propertyType?: string;
    forecastHorizon?: string;
  }
): Promise<MetricData> {
  // Map metric ID to score type
  const scoreTypeMap: Record<string, string> = {
    'homeready_score': 'homeready',
    'investoredge_score': 'investoredge',
    'market_health_score': 'markethealth',
  };

  const scoreType = scoreTypeMap[metricId];
  if (!scoreType) {
    console.warn(`Unknown PropertyIQ score metric: ${metricId}`);
    return {};
  }

  // Build the API URL for PropertyIQ scores
  // Backend expects singular forms: metro, county, zip (not metros, counties, zips)
  const geoPathMap: Record<GeoLevel, string> = {
    metro: 'metro',
    county: 'county',
    zip: 'zip',
    state: 'state', // Not used but included for completeness
    city: 'city', // Not used but included for completeness
    national: 'national', // Not used but included for completeness
    tract: 'tract', // Not used but included for completeness
  };
  const geoPath = geoPathMap[geoLevel] || geoLevel;
  const baseUrl = `/api/scores/all/${geoPath}`;
  
  const params = new URLSearchParams();
  params.append('score_type', scoreType);
  if (options?.state) params.append('state', options.state);

  const url = `${baseUrl}?${params.toString()}`;

  try {
    // Fetch all pages
    const allData: any[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;
    let totalRecords: number | null = null;
    let maxPages: number | null = null;

    while (hasMore) {
      const pageParams = new URLSearchParams(params);
      pageParams.append('page', page.toString());
      pageParams.append('page_size', pageSize.toString());

      const pageUrl = `${baseUrl}?${pageParams.toString()}`;
      const response = await fetch(`${API_URL}${pageUrl}`);

      if (!response.ok) {
        console.error(`API error for ${metricId} page ${page}: ${response.status}`);
        break;
      }

      const pageData = await response.json();

      if (pageData.data && pageData.data.length > 0) {
        allData.push(...pageData.data);
        
        // Update total records from pagination info
        if (pageData.pagination?.total) {
          totalRecords = pageData.pagination.total;
          // Calculate max pages needed: ceil(total / pageSize) + 1 for safety
          maxPages = Math.ceil(totalRecords / pageSize) + 2;
        }
        
        hasMore = pageData.pagination?.hasMore || false;
        page++;
      } else {
        hasMore = false;
      }

      // Safety limit: Use calculated max pages if available, otherwise allow up to 100 pages
      // This ensures we can fetch all records even for very large datasets (e.g., 100,000+ ZIP codes)
      const safetyLimit = maxPages || 100;
      if (page >= safetyLimit) {
        console.warn(`Pagination safety limit reached for ${metricId} at ${geoLevel} (${page} pages, ${allData.length} records)`);
        if (totalRecords && allData.length < totalRecords) {
          console.error(`❌ Not all records fetched: ${allData.length} of ${totalRecords} total`);
        }
        break;
      }
    }

    // Log completion status
    if (totalRecords && allData.length < totalRecords) {
      console.error(`❌ Partial data for ${metricId} at ${geoLevel}: fetched ${allData.length} of ${totalRecords} records`);
    } else if (totalRecords && allData.length === totalRecords) {
      console.log(`✓ Successfully fetched all ${allData.length} records for ${metricId} at ${geoLevel}`);
    }
    
    // Debug: Log sample data to verify format
    if (allData.length > 0) {
      console.log(`[PropertyIQ] Sample data for ${metricId} at ${geoLevel}:`, {
        firstRecord: allData[0],
        totalRecords: allData.length,
      });
    } else {
      console.warn(`[PropertyIQ] No data returned for ${metricId} at ${geoLevel}`);
    }

    // Transform to unified format
    const normalizedData: ApiResponse = {
      success: true,
      count: allData.length,
      data: allData,
    };

    // Create a modified config with valueField set to 'value' for PropertyIQ scores
    const modifiedConfig = {
      ...config,
      valueField: 'value', // PropertyIQ scores endpoint returns 'value' field
    };

    const result = transformResponse(normalizedData, geoLevel, modifiedConfig);
    
    // Debug: Log transformed result
    const sampleKeys = Object.keys(result).slice(0, 5);
    console.log(`[PropertyIQ] Transformed ${Object.keys(result).length} records for ${metricId} at ${geoLevel}. Sample keys:`, sampleKeys);
    
    return result;
  } catch (error) {
    console.error(`Failed to fetch PropertyIQ score ${metricId}:`, error);
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
    // Handle field name variations from different data sources
    let key: string | undefined;
    switch (keyField) {
      case 'region_name':
        key = item.region_name;
        break;
      case 'cbsa_code': {
        const raw = item.cbsa_code ?? item.region_id;
        key = raw != null ? String(raw) : undefined;
        break;
      }
      case 'county_fips':
        // Census uses fips_code, other sources use county_fips
        // PropertyIQ scores use region_id which contains the FIPS code
        key = item.county_fips || item.fips_code || item.region_id;
        // Normalize FIPS codes to 5-digit strings with leading zeros (e.g., "01001")
        if (key && geoLevel === 'county') {
          const fipsNum = parseInt(key, 10);
          if (!isNaN(fipsNum)) {
            key = String(fipsNum).padStart(5, '0');
          }
        }
        break;
      case 'postal_code': {
        // Census uses zcta, other sources use postal_code. Normalize so map keys match ZCTA5CE20.
        const raw = item.postal_code || item.zcta || item.region_id;
        key = raw ? normalizeZipKey(raw) : undefined;
        break;
      }
      case 'place_fips':
        // Census cities use place_fips
        key = item.place_fips || item.region_id;
        break;
      default:
        key = item.region_id;
    }

    if (!key) return;

    // Get the value
    let value = item[valueField];
    
    // If valueField is 'value' but it's missing, try 'score' as fallback (for PropertyIQ scores)
    if (value == null && valueField === 'value' && config.dataSource === 'propertyiq') {
      value = item.score;
    }
    
    if (value == null) {
      // Include null so the same geographies appear as other permit metrics (e.g. SF/MF ratio when no permits)
      if (config.includeNullValues) {
        result[key] = { value: null, date: item.date };
      }
      return;
    }

    const numValue = Number(value);
    if (isNaN(numValue)) return;

    // Apply percentage conversion if needed
    const finalValue = config.asPercent ? numValue * 100 : numValue;

    // Store with date for "as of" display
    result[key] = {
      value: finalValue,
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
