/**
 * Query Helpers
 * Reusable database query functions
 */

import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Get the latest date for a given table and geography
 */
export async function getLatestDateForTable(
  supabase: SupabaseClient,
  table: 'zillow_zhvi' | 'zillow_zori' | 'zillow_zordi' | 'zillow_zhvf',
  geography: string
): Promise<string> {
  const { data } = await supabase
    .from(table)
    .select('date')
    .eq('geography', geography)
    .order('date', { ascending: false })
    .limit(1);

  return data?.[0]?.date || '2025-10-31';
}

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
    case '1m': return forecast.forecast_1m || 0;
    case '3m': return forecast.forecast_3m || 0;
    case '12m':
    default: return forecast.forecast_12m || 0;
  }
}

/**
 * Query ZHVI data with standard filters
 */
export async function queryZhvi(
  supabase: SupabaseClient,
  geography: string,
  targetDate: string,
  regionIds?: string[]
) {
  let query = supabase
    .from('zillow_zhvi')
    .select('region_id, value, date, property_type, geography')
    .eq('geography', geography)
    .eq('date', targetDate)
    .eq('property_type', 'sfrcondo')
    .eq('tier', '0.33_0.67');

  if (regionIds) {
    query = query.in('region_id', regionIds);
  }

  const { data, error } = await query;

  if (error) throw new Error(error.message);
  return data || [];
}

/**
 * Query ZORI (rent) data with standard filters
 */
export async function queryZori(
  supabase: SupabaseClient,
  geography: string | string[],
  targetDate: string,
  propertyType: string,
  regionIds?: string[]
) {
  let query = supabase
    .from('zillow_zori')
    .select('region_id, value, date, property_type, geography');

  if (Array.isArray(geography)) {
    query = query.in('geography', geography);
  } else {
    query = query.eq('geography', geography);
  }

  query = query.eq('date', targetDate).eq('property_type', propertyType);

  if (regionIds) {
    query = query.in('region_id', regionIds);
  }

  const { data, error } = await query;

  if (error) throw new Error(error.message);
  return data || [];
}

/**
 * Query ZORDI (renter demand) data with standard filters
 */
export async function queryZordi(
  supabase: SupabaseClient,
  geography: string | string[],
  targetDate: string,
  propertyType: string,
  regionIds?: string[]
) {
  let query = supabase
    .from('zillow_zordi')
    .select('region_id, value, date, property_type, geography');

  if (Array.isArray(geography)) {
    query = query.in('geography', geography);
  } else {
    query = query.eq('geography', geography);
  }

  query = query.eq('date', targetDate).eq('property_type', propertyType);

  if (regionIds) {
    query = query.in('region_id', regionIds);
  }

  const { data, error } = await query;

  if (error) throw new Error(error.message);
  return data || [];
}

/**
 * Query ZHVF (forecast) data
 */
export async function queryZhvf(
  supabase: SupabaseClient,
  geography: string | string[]
) {
  let query = supabase
    .from('zillow_zhvf')
    .select('region_id, date, forecast_1m, forecast_3m, forecast_12m, geography');

  if (Array.isArray(geography)) {
    query = query.in('geography', geography);
  } else {
    query = query.eq('geography', geography);
  }

  const { data, error } = await query.order('date', { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}
