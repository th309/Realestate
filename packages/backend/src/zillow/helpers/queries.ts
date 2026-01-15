/**
 * Query Helpers
 * Reusable database query functions for Zillow data
 *
 * Uses long-format tables: zillow_metro, zillow_county, zillow_state, zillow_zip
 */

import { SupabaseClient } from '@supabase/supabase-js';

// ============================================================================
// Type Definitions
// ============================================================================

export type GeographyType = 'state' | 'metro' | 'county' | 'city' | 'zip';
export type MetricName = 'zhvi' | 'zhvi_yoy' | 'zori' | 'zori_yoy' | 'inventory' | 'inventory_yoy' |
  'dom' | 'sale_price' | 'list_price' | 'new_listings' | 'pending_sales' |
  'sale_to_list' | 'price_cuts' | 'zhvf_1m' | 'zhvf_3m' | 'zhvf_12m' | 'market_heat';

// Map geography string to table name
function getTableForGeography(geography: string): string {
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
// Core Query Functions
// ============================================================================

/**
 * Get the latest date for a given geography and metric
 * Optimized: Uses a single region to find max date (faster than full table scan)
 */
export async function getLatestDate(
  supabase: SupabaseClient,
  geography: GeographyType,
  metricName: MetricName = 'zhvi'
): Promise<string> {
  const table = getTableForGeography(geography);

  try {
    const { data, error } = await supabase
      .from(table)
      .select('period_date')
      .eq('metric_name', metricName)
      .order('period_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error(`getLatestDate error for ${table}/${metricName}:`, error.message);
      return '2025-10-31';
    }

    return data?.period_date || '2025-10-31';
  } catch (err) {
    console.error(`getLatestDate network error for ${table}/${metricName}:`, err);
    return '2025-10-31';
  }
}

// Backwards-compatible alias
export const getLatestDateForTable = async (
  supabase: SupabaseClient,
  _table: string,
  geography: string
): Promise<string> => {
  return getLatestDate(supabase, geography.toLowerCase() as GeographyType, 'zhvi');
};

export const getLatestDateForMarketTable = getLatestDateForTable;

/**
 * Paginated query helper to overcome Supabase's 1000 row default limit
 * Automatically fetches all pages of results
 */
export async function paginatedQuery<T = any>(
  supabase: SupabaseClient,
  table: string,
  selectColumns: string,
  filters: { column: string; value: any; operator?: 'eq' | 'in' | 'gte' | 'lte' }[],
  pageSize: number = 1000
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

/**
 * Query data from long-format tables
 * Uses pagination to fetch all results (no row limit)
 */
export async function queryZillowData(
  supabase: SupabaseClient,
  geography: GeographyType,
  metricName: MetricName,
  targetDate: string,
  regionIds?: number[]
) {
  const table = getTableForGeography(geography);

  console.log(`queryZillowData: table=${table}, metric=${metricName}, date=${targetDate}`);

  const filters: { column: string; value: any; operator?: 'eq' | 'in' | 'gte' | 'lte' }[] = [
    { column: 'period_date', value: targetDate },
    { column: 'metric_name', value: metricName },
  ];

  if (regionIds && regionIds.length > 0) {
    filters.push({ column: 'region_id', value: regionIds, operator: 'in' });
  }

  const data = await paginatedQuery(
    supabase,
    table,
    'region_id, region_name, state_code, period_date, metric_name, value',
    filters
  );

  console.log(`queryZillowData: returned ${data.length} rows`);
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
  regionIds?: number[]
) {
  const data = await queryZillowData(supabase, geography, metricName, targetDate, regionIds);

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
  regionIds?: number[]
) {
  const table = getTableForGeography(geography);

  const filters: { column: string; value: any; operator?: 'eq' | 'in' | 'gte' | 'lte' }[] = [
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
    filters
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
  endDate?: string
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
  metric: MetricName = 'zhvi'
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

// ============================================================================
// Legacy-Compatible Query Functions
// These maintain the same signatures as before for easier migration
// ============================================================================

/**
 * Map frontend property type to database property type
 */
export function mapRentPropertyType(type: string): string {
  switch (type) {
    case 'sfr': return 'SFR';
    case 'mfr': return 'Multifamily';
    case 'all':
    default: return 'All Homes Plus Multifamily';
  }
}

/**
 * Get forecast value based on horizon
 */
export function getForecastValue(forecast: any, horizon: string): number {
  switch (horizon) {
    case '1m': return forecast.forecast_1m || forecast.value || 0;
    case '3m': return forecast.forecast_3m || forecast.value || 0;
    case '12m':
    default: return forecast.forecast_12m || forecast.value || 0;
  }
}

/**
 * Query ZHVI data (legacy-compatible)
 */
export async function queryZhvi(
  supabase: SupabaseClient,
  geography: string,
  targetDate: string,
  regionIds?: string[]
) {
  const geoType = geography.toLowerCase() as GeographyType;
  const numericIds = regionIds?.map(id => parseInt(id, 10)).filter(id => !isNaN(id));
  return queryWithLegacyFormat(supabase, geoType, 'zhvi', targetDate, numericIds);
}

/**
 * Query ZORI (rent) data (legacy-compatible)
 */
export async function queryZori(
  supabase: SupabaseClient,
  geography: string | string[],
  targetDate: string,
  _propertyType: string, // Not used in new schema
  regionIds?: string[]
) {
  const geoType = (Array.isArray(geography) ? geography[0] : geography).toLowerCase() as GeographyType;
  const numericIds = regionIds?.map(id => parseInt(id, 10)).filter(id => !isNaN(id));
  return queryWithLegacyFormat(supabase, geoType, 'zori', targetDate, numericIds);
}

/**
 * Query ZORDI (renter demand) data (legacy-compatible)
 * Note: ZORDI not yet migrated, returns empty for now
 */
export async function queryZordi(
  supabase: SupabaseClient,
  geography: string | string[],
  targetDate: string,
  _propertyType: string,
  regionIds?: string[]
): Promise<any[]> {
  // ZORDI data not yet in new schema - return empty array
  // TODO: Add zordi metric to new tables or keep separate table
  console.warn('queryZordi: ZORDI data not yet migrated to new schema');
  return [];
}

/**
 * Query ZHVF (forecast) data from zillow_zhvf table
 */
export async function queryZhvf(
  supabase: SupabaseClient,
  geography: string | string[]
): Promise<any[]> {
  // Get the latest date in the forecast table
  const { data: latestData } = await supabase
    .from('zillow_zhvf')
    .select('date')
    .order('date', { ascending: false })
    .limit(1)
    .single();

  if (!latestData?.date) return [];

  // Build query for the specified geography types
  const geoArray = Array.isArray(geography) ? geography : [geography];

  const { data, error } = await supabase
    .from('zillow_zhvf')
    .select('region_id, date, forecast_1m, forecast_3m, forecast_12m, geography')
    .in('geography', geoArray)
    .eq('date', latestData.date);

  if (error) {
    console.error('Error fetching ZHVF data:', error.message);
    return [];
  }

  return data || [];
}

/**
 * Query Market Heat Index from zillow_market_heat_index table
 */
export async function queryMarketHeat(
  supabase: SupabaseClient,
  geography: string | string[]
): Promise<any[]> {
  // Get the latest date in the market heat table
  const { data: latestData } = await supabase
    .from('zillow_market_heat_index')
    .select('date')
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!latestData?.date) {
    console.warn('queryMarketHeat: No data found in zillow_market_heat_index');
    return [];
  }

  // Build query for the specified geography types
  const geoArray = Array.isArray(geography) ? geography : [geography];

  const { data, error } = await supabase
    .from('zillow_market_heat_index')
    .select('region_id, date, heat_index, geography, property_type')
    .in('geography', geoArray)
    .eq('date', latestData.date);

  if (error) {
    console.error('Error fetching Market Heat data:', error.message);
    return [];
  }

  console.log(`queryMarketHeat: returned ${data?.length || 0} rows for date ${latestData.date}`);
  return data || [];
}

/**
 * Generic query for market indicators (legacy-compatible)
 */
export async function queryMarketIndicator(
  supabase: SupabaseClient,
  table: string,
  geography: string | string[],
  targetDate: string,
  _propertyType?: string,
  regionIds?: string[]
) {
  // Map old table names to new metric names
  const tableToMetricMap: Record<string, MetricName> = {
    'zillow_inventory': 'inventory',
    'zillow_new_listings': 'new_listings',
    'zillow_pending_listings': 'pending_sales',
    'zillow_median_list_price': 'list_price',
    'zillow_sales_count': 'sale_price',
    'zillow_sales_price': 'sale_price',
    'zillow_sale_to_list': 'sale_to_list',
    'zillow_days_to_pending': 'dom',
    'zillow_days_to_close': 'dom',
    'zillow_price_cut_share': 'price_cuts',
    'zillow_price_cut_amt': 'price_cuts',
    'zillow_price_cut_pct': 'price_cuts',
    'zillow_market_heat_index': 'market_heat',
    'zillow_new_construction_sales_count': 'sale_price',
    'zillow_new_construction_sale_price': 'sale_price',
    'zillow_affordability': 'zhvi',
  };

  const metricName = tableToMetricMap[table] || 'zhvi';
  const geoType = (Array.isArray(geography) ? geography[0] : geography).toLowerCase() as GeographyType;
  const numericIds = regionIds?.map(id => parseInt(id, 10)).filter(id => !isNaN(id));

  return queryWithLegacyFormat(supabase, geoType, metricName, targetDate, numericIds);
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
  regionIds?: string[]
): Promise<any[]> {
  const geoType = (Array.isArray(geography) ? geography[0] : geography).toLowerCase() as GeographyType;

  // Affordability metrics are only available at metro level
  if (geoType !== 'metro') {
    console.warn(`queryAffordability: Affordability data only available at metro level, not ${geoType}`);
    return [];
  }

  // Metric names as stored in zillow_metro
  // Some use mapped names (homeowner_income), others use original names (new_homeowner_affordability)
  const affordabilityMetrics = [
    'homeowner_income', 'affordable_price', 'years_to_save', 'renter_income',
    'new_homeowner_affordability', 'new_renter_affordability'
  ];

  // Query all affordability metrics for the given date
  const filters: { column: string; value: any; operator?: 'eq' | 'in' | 'gte' | 'lte' }[] = [
    { column: 'metric_name', value: affordabilityMetrics, operator: 'in' },
    { column: 'period_date', value: targetDate },
  ];

  if (regionIds && regionIds.length > 0) {
    const numericIds = regionIds.map(id => parseInt(id, 10)).filter(id => !isNaN(id));
    filters.push({ column: 'region_id', value: numericIds, operator: 'in' });
  }

  const data = await paginatedQuery(
    supabase,
    'zillow_metro',
    'region_id, region_name, cbsa_code, state_code, period_date, metric_name, value',
    filters
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
    if (row.metric_name === 'homeowner_income') entry.homeowner_income_needed = row.value;
    if (row.metric_name === 'affordable_price') entry.affordable_home_price = row.value;
    if (row.metric_name === 'years_to_save') entry.years_to_save = row.value;
    if (row.metric_name === 'renter_income') entry.renter_income_needed = row.value;
    if (row.metric_name === 'new_homeowner_affordability') entry.homeowner_affordability_percent = row.value;
    if (row.metric_name === 'new_renter_affordability') entry.renter_affordability_percent = row.value;
  }

  return [...byRegion.values()];
}


// ============================================================================
// Advanced Query Interface
// ============================================================================

export interface ZillowQueryOptions {
  geography: GeographyType;
  metric: MetricName;
  date?: string;
  regionIds?: number[];
  startDate?: string;
  endDate?: string;
}

/**
 * Unified query function with full options
 * Uses pagination to fetch all results
 */
export async function query(
  supabase: SupabaseClient,
  options: ZillowQueryOptions
) {
  const { geography, metric, date, regionIds, startDate, endDate } = options;

  const table = getTableForGeography(geography);

  const filters: { column: string; value: any; operator?: 'eq' | 'in' | 'gte' | 'lte' }[] = [
    { column: 'metric_name', value: metric },
  ];

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
    filters
  );
}

