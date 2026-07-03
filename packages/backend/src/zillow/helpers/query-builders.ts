/**
 * Query Builders
 * Generic long-format query functions built on the query primitives:
 * point-in-time and latest-per-region reads, multi-metric fetch,
 * time series, available dates, and the unified query interface.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type {
  GeographyType,
  MetricName,
  ZillowQueryOptions,
} from './queries.types';
import {
  getTableForGeography,
  getLatestDate,
  paginatedQuery,
} from './query-primitives';

/**
 * Query data from long-format tables
 * Uses pagination to fetch all results (no row limit)
 */
export async function queryZillowData(
  supabase: SupabaseClient,
  geography: GeographyType,
  metricName: MetricName,
  targetDate: string,
  regionIds?: number[],
) {
  const table = getTableForGeography(geography);

  console.log(
    `queryZillowData: table=${table}, metric=${metricName}, date=${targetDate}`,
  );

  const filters: {
    column: string;
    value: any;
    operator?: 'eq' | 'in' | 'gte' | 'lte';
  }[] = [
    { column: 'period_date', value: targetDate },
    { column: 'metric_name', value: metricName },
  ];

  if (regionIds && regionIds.length > 0) {
    filters.push({ column: 'region_id', value: regionIds, operator: 'in' });
  }

  const data = await paginatedQuery(
    supabase,
    table,
    'region_id, region_name, state_code, cbsa_code, period_date, metric_name, value',
    filters,
  );

  console.log(`queryZillowData: returned ${data.length} rows`);
  return data;
}

/**
 * Query the most recent data for each region
 * OPTIMIZED: Gets the latest date first, then queries only that date's data
 * This avoids fetching all historical records and filtering in JS
 */
export async function queryLatestPerRegion(
  supabase: SupabaseClient,
  geography: GeographyType,
  metricName: MetricName,
  regionIds?: number[],
) {
  const table = getTableForGeography(geography);

  // Step 1: Get the latest date for this metric (single fast query)
  const latestDate = await getLatestDate(supabase, geography, metricName);

  console.log(
    `queryLatestPerRegion: table=${table}, metric=${metricName}, latestDate=${latestDate}`,
  );

  // Step 2: Query only the latest date's data (much smaller dataset)
  const filters: {
    column: string;
    value: any;
    operator?: 'eq' | 'in' | 'gte' | 'lte';
  }[] = [
    { column: 'metric_name', value: metricName },
    { column: 'period_date', value: latestDate },
  ];

  if (regionIds && regionIds.length > 0) {
    filters.push({ column: 'region_id', value: regionIds, operator: 'in' });
  }

  const data = await paginatedQuery(
    supabase,
    table,
    'region_id, region_name, state_code, cbsa_code, period_date, metric_name, value',
    filters,
  );

  console.log(
    `queryLatestPerRegion: returned ${data.length} rows for date ${latestDate}`,
  );
  return data;
}

/**
 * Query data with legacy-compatible response format
 */
export async function queryWithLegacyFormat(
  supabase: SupabaseClient,
  geography: GeographyType,
  metricName: MetricName,
  targetDate: string,
  regionIds?: number[],
) {
  const data = await queryZillowData(
    supabase,
    geography,
    metricName,
    targetDate,
    regionIds,
  );

  // Map to legacy format for compatibility with existing service code
  return data.map((row: any) => ({
    region_id: String(row.region_id),
    value: row.value,
    date: row.period_date,
    property_type: 'sfrcondo', // Default for compatibility
    geography: geography.charAt(0).toUpperCase() + geography.slice(1),
  }));
}

/**
 * Query multiple metrics at once
 * Uses pagination to fetch all results
 */
export async function queryMultipleMetrics(
  supabase: SupabaseClient,
  geography: GeographyType,
  metricNames: MetricName[],
  targetDate: string,
  regionIds?: number[],
) {
  const table = getTableForGeography(geography);

  const filters: {
    column: string;
    value: any;
    operator?: 'eq' | 'in' | 'gte' | 'lte';
  }[] = [
    { column: 'metric_name', value: metricNames, operator: 'in' },
    { column: 'period_date', value: targetDate },
  ];

  if (regionIds && regionIds.length > 0) {
    filters.push({ column: 'region_id', value: regionIds, operator: 'in' });
  }

  return paginatedQuery(
    supabase,
    table,
    'region_id, region_name, state_code, period_date, metric_name, value',
    filters,
  );
}

/**
 * Get time series data for a specific region
 */
export async function queryTimeSeries(
  supabase: SupabaseClient,
  geography: GeographyType,
  regionId: number,
  metricName: MetricName,
  startDate?: string,
  endDate?: string,
) {
  const table = getTableForGeography(geography);

  let query = supabase
    .from(table)
    .select('region_id, region_name, period_date, metric_name, value')
    .eq('region_id', regionId)
    .eq('metric_name', metricName)
    .order('period_date', { ascending: true });

  if (startDate) {
    query = query.gte('period_date', startDate);
  }
  if (endDate) {
    query = query.lte('period_date', endDate);
  }

  const { data, error } = await query;

  if (error) throw new Error(error.message);
  return data || [];
}

/**
 * Get available dates for a geography/metric combination
 */
export async function getAvailableDates(
  supabase: SupabaseClient,
  geography: GeographyType,
  metric: MetricName = 'zhvi',
): Promise<string[]> {
  const table = getTableForGeography(geography);

  const { data, error } = await supabase
    .from(table)
    .select('period_date')
    .eq('metric_name', metric)
    .order('period_date', { ascending: false });

  if (error) throw new Error(error.message);

  // Get unique dates
  const uniqueDates = [...new Set((data || []).map((d: any) => d.period_date))];
  return uniqueDates as string[];
}

/**
 * Unified query function with full options
 * Uses pagination to fetch all results
 */
export async function query(
  supabase: SupabaseClient,
  options: ZillowQueryOptions,
) {
  const { geography, metric, date, regionIds, startDate, endDate } = options;

  const table = getTableForGeography(geography);

  const filters: {
    column: string;
    value: any;
    operator?: 'eq' | 'in' | 'gte' | 'lte';
  }[] = [{ column: 'metric_name', value: metric }];

  if (date) {
    filters.push({ column: 'period_date', value: date });
  }
  if (startDate) {
    filters.push({ column: 'period_date', value: startDate, operator: 'gte' });
  }
  if (endDate) {
    filters.push({ column: 'period_date', value: endDate, operator: 'lte' });
  }
  if (regionIds && regionIds.length > 0) {
    filters.push({ column: 'region_id', value: regionIds, operator: 'in' });
  }

  return paginatedQuery(
    supabase,
    table,
    'region_id, region_name, state_code, period_date, metric_name, value',
    filters,
  );
}
