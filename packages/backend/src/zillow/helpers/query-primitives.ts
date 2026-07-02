/**
 * Query Primitives
 * Low-level building blocks for Zillow long-format queries:
 * geography-to-table routing, latest-date lookup (cached), and paginated fetch.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { GeographyType, MetricName } from './queries.types';

// Map geography string to table name
export function getTableForGeography(geography: string): string {
  const geoLower = geography.toLowerCase();
  if (geoLower === 'state') return 'zillow_state';
  if (geoLower === 'metro') return 'zillow_metro';
  if (geoLower === 'county') return 'zillow_county';
  if (geoLower === 'city') return 'zillow_city';
  if (geoLower === 'zip') return 'zillow_zip';
  // Default to metro for US/national level
  return 'zillow_metro';
}

// ============================================================================
// Latest Date Cache (avoids redundant queries)
// ============================================================================
const LATEST_DATE_CACHE_TTL = 60 * 60 * 1000; // 1 hour
const latestDateCache = new Map<string, { date: string; expiry: number }>();

/**
 * Get the latest date for a given geography and metric (with 1-hour cache)
 * Optimized: Uses cache + single region to find max date
 */
export async function getLatestDate(
  supabase: SupabaseClient,
  geography: GeographyType,
  metricName: MetricName = 'zhvi',
): Promise<string> {
  const table = getTableForGeography(geography);
  const cacheKey = `${table}:${metricName}`;

  // Check cache first
  const cached = latestDateCache.get(cacheKey);
  if (cached && cached.expiry > Date.now()) {
    return cached.date;
  }

  try {
    const { data, error } = await supabase
      .from(table)
      .select('period_date')
      .eq('metric_name', metricName)
      .order('period_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error(
        `getLatestDate error for ${table}/${metricName}:`,
        error.message,
      );
      return '2025-10-31';
    }

    const latestDate = data?.period_date || '2025-10-31';

    // Cache the result
    latestDateCache.set(cacheKey, {
      date: latestDate,
      expiry: Date.now() + LATEST_DATE_CACHE_TTL,
    });

    return latestDate;
  } catch (err) {
    console.error(
      `getLatestDate network error for ${table}/${metricName}:`,
      err,
    );
    return '2025-10-31';
  }
}

/**
 * Get latest date for a metric at a geography level.
 * @param metricName - The metric name (e.g., 'zori', 'zordi', 'zhvi')
 * @param geography - The geography level (e.g., 'metro', 'county', 'zip')
 */
export const getLatestDateForMetric = async (
  supabase: SupabaseClient,
  metricName: MetricName,
  geography: string,
): Promise<string> => {
  return getLatestDate(
    supabase,
    geography.toLowerCase() as GeographyType,
    metricName,
  );
};

/**
 * Paginated query helper to overcome Supabase's 1000 row default limit
 * Automatically fetches all pages of results
 */
export async function paginatedQuery<T = any>(
  supabase: SupabaseClient,
  table: string,
  selectColumns: string,
  filters: {
    column: string;
    value: any;
    operator?: 'eq' | 'in' | 'gte' | 'lte';
  }[],
  pageSize: number = 1000,
): Promise<T[]> {
  const allData: T[] = [];
  let page = 0;

  while (true) {
    let query = supabase
      .from(table)
      .select(selectColumns)
      .range(page * pageSize, (page + 1) * pageSize - 1);

    // Apply filters
    for (const filter of filters) {
      switch (filter.operator || 'eq') {
        case 'in':
          query = query.in(filter.column, filter.value);
          break;
        case 'gte':
          query = query.gte(filter.column, filter.value);
          break;
        case 'lte':
          query = query.lte(filter.column, filter.value);
          break;
        case 'eq':
        default:
          query = query.eq(filter.column, filter.value);
      }
    }

    const { data, error } = await query;

    if (error) {
      console.error(`paginatedQuery error for ${table}:`, error.message);
      break;
    }

    if (!data || data.length === 0) break;

    allData.push(...(data as T[]));

    if (data.length < pageSize) break; // Last page
    page++;
  }

  return allData;
}
