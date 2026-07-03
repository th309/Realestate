/**
 * ZORDI Renter Demand Helpers
 *
 * Metro / ZIP renter demand index fetchers extracted from zillow.service.ts
 * for file-size compliance — behavior unchanged.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { normalizeStateToCode } from '../../common/geo';
import type { HomeValueData } from '../types';
import { getLatestDateForMetric, queryZordi } from './queries';
import { buildZipMappings, buildMetroMappings, lookupMetro } from './crosswalk';

export async function getMetroRenterDemand(
  supabase: SupabaseClient,
  date?: string,
  propertyType: string = 'all',
): Promise<HomeValueData[]> {
  // ZORDI data is in zillow_metro with metric_name = 'zordi', 'zordi_sfr', 'zordi_mfr'
  const targetDate =
    date || (await getLatestDateForMetric(supabase, 'zordi', 'metro'));

  // Pass propertyType directly - queryZordi handles mapping to metric name
  const zillow = await queryZordi(
    supabase,
    ['Metro', 'US'],
    targetDate,
    propertyType,
  );
  if (!zillow.length) return [];

  const { byZillowId, byCbsaCode } = await buildMetroMappings(supabase);

  return zillow
    .map((z) => {
      if (z.geography === 'US') {
        return {
          region_id: z.region_id,
          region_name: 'United States',
          value: z.value,
          date: z.date,
          property_type: z.property_type,
          geography: 'US',
        };
      }

      const { metro, cbsaCode } = lookupMetro(
        z.region_id,
        byZillowId,
        byCbsaCode,
      );

      return {
        region_id: z.region_id,
        region_name: metro?.cbsa_name || 'Unknown',
        cbsa_code: cbsaCode,
        state_abbrev: metro?.state || null,
        value: z.value,
        date: z.date,
        property_type: z.property_type,
        geography: 'Metro',
      };
    })
    .sort((a, b) => b.value - a.value);
}

export async function getZipRenterDemand(
  supabase: SupabaseClient,
  stateFilter: string,
  propertyType: string = 'all',
  date?: string,
): Promise<HomeValueData[]> {
  stateFilter = normalizeStateToCode(stateFilter);
  // ZORDI data is metro-only from Zillow
  // OPTIMIZATION: Run date lookup and ZIP mappings in parallel
  const [targetDate, zipMap] = await Promise.all([
    date
      ? Promise.resolve(date)
      : getLatestDateForMetric(supabase, 'zordi', 'metro'),
    buildZipMappings(supabase, stateFilter),
  ]);

  const zipCodes = [...zipMap.keys()];
  if (zipCodes.length === 0) return [];

  // Pass propertyType directly - queryZordi handles mapping to metric name
  const zillow = await queryZordi(
    supabase,
    'Zip',
    targetDate,
    propertyType,
    zipCodes,
  );

  return zillow
    .map((z) => {
      const zip = zipMap.get(z.region_id);
      return {
        region_id: z.region_id,
        region_name: zip ? `${z.region_id} - ${zip.city}` : z.region_id,
        zip_code: z.region_id,
        city: zip?.city || null,
        county_name: zip?.county || null,
        state_abbrev: zip?.state_abbrev || null,
        state_name: zip?.state_name || null,
        value: z.value,
        date: z.date,
        property_type: z.property_type,
        geography: 'ZIP',
      };
    })
    .sort((a, b) => b.value - a.value);
}

/**
 * Get all ZIP renter demand data without state filter (with limit for performance)
 */
export async function getAllZipRenterDemand(
  supabase: SupabaseClient,
  date?: string,
  propertyType: string = 'all',
  limit: number = 100,
): Promise<HomeValueData[]> {
  try {
    // Map propertyType to metric name - ZORDI is metro-only from Zillow
    const metricName =
      propertyType === 'sfr'
        ? 'zordi_sfr'
        : propertyType === 'mfr'
          ? 'zordi_mfr'
          : 'zordi';
    const targetDate =
      date || (await getLatestDateForMetric(supabase, 'zordi', 'metro'));

    console.log(
      `getAllZipRenterDemand: targetDate=${targetDate}, metric=${metricName}, limit=${limit}`,
    );

    // Query all ZIPs with a limit, ordered by value descending
    const { data: zipData, error } = await supabase
      .from('zillow_zip')
      .select('region_id, region_name, state_code, value, period_date')
      .eq('metric_name', metricName)
      .eq('period_date', targetDate)
      .order('value', { ascending: false })
      .limit(limit);

    if (error) {
      console.error(`getAllZipRenterDemand error: ${error.message}`);
      return [];
    }

    if (!zipData || zipData.length === 0) return [];

    // Map results
    return zipData.map((record) => ({
      region_id: String(record.region_id),
      region_name: record.region_name,
      zip_code: record.region_name,
      state_abbrev: record.state_code,
      state_name: null,
      value: Number(record.value),
      date: record.period_date,
      property_type: propertyType,
      geography: 'ZIP',
    }));
  } catch (err) {
    console.error(`getAllZipRenterDemand unexpected error:`, err);
    return [];
  }
}
