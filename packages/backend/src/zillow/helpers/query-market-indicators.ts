/**
 * Market Indicator Queries
 * Legacy-compatible queries for market heat, generic market indicators
 * (inventory, listings, price cuts, etc.), and combined affordability metrics.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { GeographyType, MetricName } from './queries.types';
import {
  getTableForGeography,
  getLatestDate,
  paginatedQuery,
} from './query-primitives';
import { queryLatestPerRegion, queryWithLegacyFormat } from './query-builders';

/**
 * Query Market Heat Index from zillow_metro long-format table
 */
export async function queryMarketHeat(
  supabase: SupabaseClient,
  geography: string | string[],
): Promise<any[]> {
  const geoType = (
    Array.isArray(geography) ? geography[0] : geography
  ).toLowerCase() as GeographyType;
  const table = getTableForGeography(geoType);

  // Get the latest date for market_heat metric
  const latestDate = await getLatestDate(supabase, geoType, 'market_heat');

  if (!latestDate) {
    console.warn(`queryMarketHeat: No market_heat data found in ${table}`);
    return [];
  }

  // Query from long-format table
  const data = await paginatedQuery(
    supabase,
    table,
    'region_id, region_name, cbsa_code, state_code, period_date, metric_name, value',
    [
      { column: 'metric_name', value: 'market_heat' },
      { column: 'period_date', value: latestDate },
    ],
  );

  console.log(
    `queryMarketHeat: returned ${data.length} rows for date ${latestDate}`,
  );

  // Map to legacy format for backwards compatibility
  return data.map((row: any) => ({
    region_id: String(row.region_id),
    date: row.period_date,
    heat_index: row.value,
    geography: geoType.charAt(0).toUpperCase() + geoType.slice(1),
    property_type: 'sfrcondo',
  }));
}

/**
 * Generic query for market indicators.
 * @param metricName - The metric name (e.g., 'inventory', 'new_listings', 'price_cuts')
 */
export async function queryMarketIndicator(
  supabase: SupabaseClient,
  metricName: MetricName,
  geography: string | string[],
  targetDate: string,
  _propertyType?: string,
  regionIds?: string[],
) {
  const geoType = (
    Array.isArray(geography) ? geography[0] : geography
  ).toLowerCase() as GeographyType;
  const numericIds = regionIds
    ?.map((id) => parseInt(id, 10))
    .filter((id) => !isNaN(id));

  return queryWithLegacyFormat(
    supabase,
    geoType,
    metricName,
    targetDate,
    numericIds,
  );
}

/**
 * Query market indicators using latest available data per region.
 * Returns each region's most recent data point (not limited to a single global date).
 * @param metricName - The metric name (e.g., 'inventory', 'new_listings')
 */
export async function queryMarketIndicatorLatest(
  supabase: SupabaseClient,
  metricName: MetricName,
  geography: string | string[],
  regionIds?: string[],
) {
  const geoType = (
    Array.isArray(geography) ? geography[0] : geography
  ).toLowerCase() as GeographyType;
  const numericIds = regionIds
    ?.map((id) => parseInt(id, 10))
    .filter((id) => !isNaN(id));

  const data = await queryLatestPerRegion(
    supabase,
    geoType,
    metricName,
    numericIds,
  );

  // Map to legacy format with date included
  return data.map((row: any) => ({
    region_id: String(row.region_id),
    value: row.value,
    date: row.period_date,
    property_type: 'sfrcondo',
    geography: geoType.charAt(0).toUpperCase() + geoType.slice(1),
    cbsa_code: row.cbsa_code,
    region_name: row.region_name,
    state_code: row.state_code,
  }));
}

/**
 * Query affordability data from zillow_metro long-format table
 * Combines multiple affordability metrics into unified response
 */
export async function queryAffordability(
  supabase: SupabaseClient,
  geography: string | string[],
  targetDate: string,
  _propertyType?: string,
  regionIds?: string[],
): Promise<any[]> {
  const geoType = (
    Array.isArray(geography) ? geography[0] : geography
  ).toLowerCase() as GeographyType;

  // Affordability metrics are only available at metro level
  if (geoType !== 'metro') {
    console.warn(
      `queryAffordability: Affordability data only available at metro level, not ${geoType}`,
    );
    return [];
  }

  // Metric names as stored in zillow_metro
  // Some use mapped names (homeowner_income), others use original names (new_homeowner_affordability)
  const affordabilityMetrics = [
    'homeowner_income',
    'affordable_price',
    'years_to_save',
    'renter_income',
    'new_homeowner_affordability',
    'new_renter_affordability',
  ];

  // Query all affordability metrics for the given date
  const filters: {
    column: string;
    value: any;
    operator?: 'eq' | 'in' | 'gte' | 'lte';
  }[] = [
    { column: 'metric_name', value: affordabilityMetrics, operator: 'in' },
    { column: 'period_date', value: targetDate },
  ];

  if (regionIds && regionIds.length > 0) {
    const numericIds = regionIds
      .map((id) => parseInt(id, 10))
      .filter((id) => !isNaN(id));
    filters.push({ column: 'region_id', value: numericIds, operator: 'in' });
  }

  const data = await paginatedQuery(
    supabase,
    'zillow_metro',
    'region_id, region_name, cbsa_code, state_code, period_date, metric_name, value',
    filters,
  );

  if (!data.length) return [];

  // Group by region_id to combine metrics
  const byRegion = new Map<number, any>();
  for (const row of data) {
    if (!byRegion.has(row.region_id)) {
      byRegion.set(row.region_id, {
        region_id: String(row.region_id),
        region_name: row.region_name,
        cbsa_code: row.cbsa_code,
        state_code: row.state_code,
        date: row.period_date,
        geography: 'Metro',
        homeowner_income_needed: null,
        renter_income_needed: null,
        affordable_home_price: null,
        years_to_save: null,
        homeowner_affordability_percent: null,
        renter_affordability_percent: null,
        down_payment_percent: null,
        property_type: 'sfrcondo',
      });
    }
    const entry = byRegion.get(row.region_id);
    // Match metric names as stored in zillow_metro
    if (row.metric_name === 'homeowner_income')
      entry.homeowner_income_needed = row.value;
    if (row.metric_name === 'affordable_price')
      entry.affordable_home_price = row.value;
    if (row.metric_name === 'years_to_save') entry.years_to_save = row.value;
    if (row.metric_name === 'renter_income')
      entry.renter_income_needed = row.value;
    if (row.metric_name === 'new_homeowner_affordability')
      entry.homeowner_affordability_percent = row.value;
    if (row.metric_name === 'new_renter_affordability')
      entry.renter_affordability_percent = row.value;
  }

  return [...byRegion.values()];
}
