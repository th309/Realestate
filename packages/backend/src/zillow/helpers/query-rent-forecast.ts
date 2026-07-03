/**
 * Rent & Forecast Queries
 * Legacy-compatible ZHVI / ZORI / ZORDI / ZHVF query functions and the
 * property-type and forecast-horizon mappers they rely on.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { GeographyType, MetricName } from './queries.types';
import { queryWithLegacyFormat } from './query-builders';

/**
 * Map frontend property type to database metric name
 * - 'all' → 'zori' (All Homes from Metro_zori_uc_sfrcondomfr_sm_month)
 * - 'sfr' → 'zori_sfr' (Single Family from Metro_zori_uc_sfr_sm_month)
 * - 'mfr' → 'zori_mfr' (Multi-Family from Metro_zori_uc_mfr_sm_month)
 */
export function mapRentPropertyType(type: string): MetricName {
  switch (type) {
    case 'sfr':
      return 'zori_sfr';
    case 'mfr':
      return 'zori_mfr';
    case 'all':
    default:
      return 'zori';
  }
}

/**
 * Map frontend property type to database metric name for ZORDI (Renter Demand Index)
 * - 'all' → 'zordi' (All Homes from Metro_zordi_uc_sfrcondomfr_month)
 * - 'sfr' → 'zordi_sfr' (Single Family from Metro_zordi_uc_sfr_month)
 * - 'mfr' → 'zordi_mfr' (Multi-Family from Metro_zordi_uc_mfr_month)
 */
export function mapDemandPropertyType(type: string): MetricName {
  switch (type) {
    case 'sfr':
      return 'zordi_sfr';
    case 'mfr':
      return 'zordi_mfr';
    case 'all':
    default:
      return 'zordi';
  }
}

/**
 * Get forecast value based on horizon
 */
export function getForecastValue(forecast: any, horizon: string): number {
  switch (horizon) {
    case '1m':
      return forecast.forecast_1m || forecast.value || 0;
    case '3m':
      return forecast.forecast_3m || forecast.value || 0;
    case '12m':
    default:
      return forecast.forecast_12m || forecast.value || 0;
  }
}

/**
 * Query ZHVI data (legacy-compatible)
 */
export async function queryZhvi(
  supabase: SupabaseClient,
  geography: string,
  targetDate: string,
  regionIds?: string[],
) {
  const geoType = geography.toLowerCase() as GeographyType;
  const numericIds = regionIds
    ?.map((id) => parseInt(id, 10))
    .filter((id) => !isNaN(id));
  return queryWithLegacyFormat(
    supabase,
    geoType,
    'zhvi',
    targetDate,
    numericIds,
  );
}

/**
 * Query ZORI (rent) data (legacy-compatible)
 * propertyType maps to metric_name:
 * - 'all' → 'zori' (All Homes)
 * - 'sfr' → 'zori_sfr' (Single Family)
 * - 'mfr' → 'zori_mfr' (Multi-Family)
 */
export async function queryZori(
  supabase: SupabaseClient,
  geography: string | string[],
  targetDate: string,
  propertyType: string = 'all',
  regionIds?: string[],
) {
  const geoType = (
    Array.isArray(geography) ? geography[0] : geography
  ).toLowerCase() as GeographyType;
  const numericIds = regionIds
    ?.map((id) => parseInt(id, 10))
    .filter((id) => !isNaN(id));
  const metricName = mapRentPropertyType(propertyType);
  return queryWithLegacyFormat(
    supabase,
    geoType,
    metricName,
    targetDate,
    numericIds,
  );
}

/**
 * Query ZORDI (renter demand) data (legacy-compatible)
 * propertyType maps to metric_name:
 * - 'all' → 'zordi' (All Homes)
 * - 'sfr' → 'zordi_sfr' (Single Family)
 * - 'mfr' → 'zordi_mfr' (Multi-Family)
 */
export async function queryZordi(
  supabase: SupabaseClient,
  geography: string | string[],
  targetDate: string,
  propertyType: string = 'all',
  regionIds?: string[],
) {
  const geoType = (
    Array.isArray(geography) ? geography[0] : geography
  ).toLowerCase() as GeographyType;
  const numericIds = regionIds
    ?.map((id) => parseInt(id, 10))
    .filter((id) => !isNaN(id));
  const metricName = mapDemandPropertyType(propertyType);
  return queryWithLegacyFormat(
    supabase,
    geoType,
    metricName,
    targetDate,
    numericIds,
  );
}

/**
 * Query ZHVF (forecast) data from zillow_zhvf table
 */
export async function queryZhvf(
  supabase: SupabaseClient,
  geography: string | string[],
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
    .select(
      'region_id, date, forecast_1m, forecast_3m, forecast_12m, geography',
    )
    .in('geography', geoArray)
    .eq('date', latestData.date);

  if (error) {
    console.error('Error fetching ZHVF data:', error.message);
    return [];
  }

  return data || [];
}
