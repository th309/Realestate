/**
 * SNAPSHOT DATA FETCHER
 *
 * Fetches current/latest metric values for all regions at a given geography level.
 * This is the primary fetcher for map displays and current value lookups.
 */

import { normalizeZipKey } from '@/lib/format/zip';
import type { GeoLevel, SnapshotData, SnapshotEntry, SnapshotFetchOptions, ApiResponseItem } from '../types';
import { METRICS } from '../registry';
import { getKeyFieldForGeo, getGeoPathSegment, getMetricConfig } from '../registry-helpers';
import { API_URL } from './base';

interface ApiResponse {
  success: boolean;
  count: number;
  data: ApiResponseItem[];
}

function extractProvenance(item: ApiResponseItem): Pick<
  SnapshotEntry,
  'source' | 'sourceGeoId' | 'sourceGeoLevel' | 'isInherited' | 'isFallback'
> {
  const sourceGeoId = typeof item.sourceGeoId === 'string'
    ? item.sourceGeoId
    : typeof item.source_geo_id === 'string'
      ? item.source_geo_id
      : null;
  const sourceGeoLevel = item.sourceGeoLevel ?? item.source_geo_level ?? null;
  const isInherited = typeof item.isInherited === 'boolean'
    ? item.isInherited
    : typeof item.is_inherited === 'boolean'
      ? item.is_inherited
      : false;
  const isFallback = typeof item.isFallback === 'boolean'
    ? item.isFallback
    : typeof item.is_fallback === 'boolean'
      ? item.is_fallback
      : false;

  return {
    source: item.source ?? null,
    sourceGeoId,
    sourceGeoLevel,
    isInherited,
    isFallback,
  };
}

/**
 * Fetch snapshot (current) data for a given metric and geography level.
 *
 * @param metricId - The metric ID (e.g., 'home_value', 'market_heat')
 * @param geoLevel - The geography level (e.g., 'state', 'metro', 'county')
 * @param options - Optional parameters (state filter, property type, forecast horizon)
 * @returns Promise<SnapshotData> - Always returns { [key]: { value, date? } }
 */
export async function fetchSnapshotData(
  metricId: string,
  geoLevel: GeoLevel,
  options?: SnapshotFetchOptions
): Promise<SnapshotData> {
  const config = getMetricConfig(metricId);
  if (!config) {
    console.warn(`[Snapshot] Unknown metric: ${metricId}`);
    return {};
  }

  // Check if metric supports this geography level
  if (config.supportedGeos && !config.supportedGeos.includes(geoLevel)) {
    console.warn(`[Snapshot] Metric ${metricId} not supported for ${geoLevel} (supported: ${config.supportedGeos.join(', ')})`);
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
    const fullUrl = `${API_URL}${url}`;
    console.log(`[Snapshot] Fetching ${metricId} at ${geoLevel}: ${fullUrl}`);
    const response = await fetch(fullUrl);
    if (!response.ok) {
      console.error(`[Snapshot] API error for ${metricId} at ${geoLevel}: ${response.status} - ${fullUrl}`);
      return {};
    }

    const rawData = await response.json();

    // Normalize response format
    const normalizedData: ApiResponse = Array.isArray(rawData)
      ? { success: true, count: rawData.length, data: rawData }
      : rawData;

    const result = transformResponse(normalizedData, geoLevel, config);

    // Log if no data returned
    if (Object.keys(result).length === 0 && normalizedData.count > 0) {
      console.warn(`[Snapshot] ${metricId}: API returned ${normalizedData.count} rows but 0 matched after transform`);
    }

    // Debug: log sample keys for ZIP level
    if (geoLevel === 'zip' && Object.keys(result).length > 0) {
      const sampleKeys = Object.keys(result).slice(0, 5);
      console.log(`[Snapshot] ${metricId} at ${geoLevel}: ${Object.keys(result).length} entries, sample keys: ${sampleKeys.join(', ')}`);
    }

    return result;
  } catch (error) {
    console.error(`[Snapshot] Failed to fetch ${metricId}:`, error);
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
  options?: SnapshotFetchOptions
): Promise<SnapshotData> {
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

  // Backend only supports metro, county, zip
  const supportedByApi: GeoLevel[] = ['metro', 'county', 'zip'];
  if (!supportedByApi.includes(geoLevel)) {
    return {};
  }

  // Build the API URL - backend expects singular forms
  const geoPathMap: Record<GeoLevel, string> = {
    metro: 'metro',
    county: 'county',
    zip: 'zip',
    state: 'state',
    city: 'city',
    national: 'national',
    tract: 'tract',
  };
  const geoPath = geoPathMap[geoLevel] || geoLevel;
  const baseUrl = `/api/scores/all/${geoPath}`;

  const params = new URLSearchParams();
  params.append('score_type', scoreType);
  if (options?.state) params.append('state', options.state);

  try {
    // Fetch all pages
    const allData: ApiResponseItem[] = [];
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

        if (pageData.pagination?.total) {
          totalRecords = pageData.pagination.total;
          maxPages = Math.ceil((totalRecords ?? 0) / pageSize) + 2;
        }

        hasMore = pageData.pagination?.hasMore || false;
        page++;
      } else {
        hasMore = false;
      }

      // Safety limit
      const safetyLimit = maxPages || 100;
      if (page >= safetyLimit) {
        console.warn(`Pagination safety limit reached for ${metricId} at ${geoLevel}`);
        break;
      }
    }

    // Transform to unified format
    const normalizedData: ApiResponse = {
      success: true,
      count: allData.length,
      data: allData,
    };

    // PropertyIQ scores use 'value' field
    const modifiedConfig = {
      ...config,
      valueField: 'value',
    };

    return transformResponse(normalizedData, geoLevel, modifiedConfig);
  } catch (error) {
    console.error(`Failed to fetch PropertyIQ score ${metricId}:`, error);
    return {};
  }
}

/**
 * Transform API response to unified SnapshotData format
 */
function transformResponse(
  response: ApiResponse,
  geoLevel: GeoLevel,
  config: typeof METRICS[string]
): SnapshotData {
  const result: SnapshotData = {};

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
      case 'cbsa_code': {
        const raw = item.cbsa_code ?? item.region_id;
        key = raw != null ? String(raw) : undefined;
        break;
      }
      case 'county_fips':
        key = item.county_fips || item.fips_code || item.region_id;
        // Normalize FIPS codes to 5-digit strings
        if (key && geoLevel === 'county') {
          const fipsNum = parseInt(key, 10);
          if (!isNaN(fipsNum)) {
            key = String(fipsNum).padStart(5, '0');
          }
        }
        break;
      case 'postal_code': {
        // Zillow uses zip_code, Realtor uses postal_code
        const raw = item.postal_code || item.zip_code || item.zcta || item.region_id;
        key = raw ? normalizeZipKey(String(raw)) : undefined;
        break;
      }
      case 'place_fips':
        key = item.place_fips || item.region_id;
        break;
      default:
        key = item.region_id;
    }

    if (!key) return;

    // Get the value
    let value = item[valueField];

    // Fallback for PropertyIQ scores
    if (value == null && valueField === 'value' && config.dataSource === 'propertyiq') {
      value = item.score;
    }

    if (value == null) {
      if (config.includeNullValues) {
        result[key] = { value: null, date: item.date, ...extractProvenance(item) };
      }
      return;
    }

    const numValue = Number(value);
    if (isNaN(numValue)) return;

    // Apply percentage conversion if needed
    const finalValue = config.asPercent ? numValue * 100 : numValue;

    result[key] = {
      value: finalValue,
      date: item.date,
      name: item.region_name || key, // Include human-readable name
      ...extractProvenance(item),
    };
  });

  return result;
}

/**
 * Convert SnapshotData to legacy HomeValues format
 * @deprecated Use SnapshotData directly
 */
export function toHomeValues(data: SnapshotData): Record<string, number | SnapshotEntry> {
  return data;
}

// Re-export for backward compatibility
export { fetchSnapshotData as fetchMetricData };
