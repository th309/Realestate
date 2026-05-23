/**
 * Resolve / create market region IDs for Census geographies.
 *
 * Census API returns geographies (states, MSAs, places, ZCTAs) that may or
 * may not exist in our `markets` table. This module:
 *  - Looks up an existing market matching the Census name+code (`resolveOrCreateMarket`)
 *  - If none found, creates a synthetic `CENSUS-<TYPE>-<CODE>` market row
 *
 * Extracted from CensusService to keep the service file under the 300-line
 * limit. Logic is preserved exactly from the original inline implementation.
 */

import type { Logger } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeZipKey } from '../../common/zip';

/** State FIPS code → 2-letter postal abbreviation. */
const STATE_FIPS_TO_CODE: Record<string, string> = {
  '01': 'AL',
  '02': 'AK',
  '04': 'AZ',
  '05': 'AR',
  '06': 'CA',
  '08': 'CO',
  '09': 'CT',
  '10': 'DE',
  '11': 'DC',
  '12': 'FL',
  '13': 'GA',
  '15': 'HI',
  '16': 'ID',
  '17': 'IL',
  '18': 'IN',
  '19': 'IA',
  '20': 'KS',
  '21': 'KY',
  '22': 'LA',
  '23': 'ME',
  '24': 'MD',
  '25': 'MA',
  '26': 'MI',
  '27': 'MN',
  '28': 'MS',
  '29': 'MO',
  '30': 'MT',
  '31': 'NE',
  '32': 'NV',
  '33': 'NH',
  '34': 'NJ',
  '35': 'NM',
  '36': 'NY',
  '37': 'NC',
  '38': 'ND',
  '39': 'OH',
  '40': 'OK',
  '41': 'OR',
  '42': 'PA',
  '44': 'RI',
  '45': 'SC',
  '46': 'SD',
  '47': 'TN',
  '48': 'TX',
  '49': 'UT',
  '50': 'VT',
  '51': 'VA',
  '53': 'WA',
  '54': 'WV',
  '55': 'WI',
  '56': 'WY',
};

function getStateCodeFromFIPS(fipsCode: string): string | null {
  return STATE_FIPS_TO_CODE[fipsCode.padStart(2, '0')] || null;
}

/**
 * Look up an existing markets row that matches the Census geography.
 * Returns the matching region_id or null when no match is found.
 */
async function mapCensusGeoToRegionId(
  supabase: SupabaseClient,
  name: string,
  geoCode: string,
  geoLevel: string,
  record: Record<string, string>,
): Promise<string | null> {
  if (geoLevel === 'state') {
    const stateCode = geoCode.padStart(2, '0');
    const stateName = name.replace(' State', '').trim();
    const { data } = await supabase
      .from('markets')
      .select('region_id')
      .eq('region_type', 'state')
      .or(`region_name.ilike.%${stateName}%,state_code.eq.${stateCode}`)
      .limit(1)
      .single();
    return data?.region_id || null;
  }

  if (
    geoLevel === 'metropolitan statistical area/micropolitan statistical area'
  ) {
    const metroName = name.split(',')[0].trim();
    const stateCode = record['state'] ? record['state'].padStart(2, '0') : null;
    const query = supabase
      .from('markets')
      .select('region_id')
      .eq('region_type', 'msa')
      .ilike('region_name', `%${metroName}%`);
    if (stateCode) query.eq('state_code', stateCode);
    const { data } = await query.limit(1).single();
    return data?.region_id || null;
  }

  if (geoLevel === 'place') {
    const cityName = name.split(',')[0].trim();
    const stateCode = record['state'] ? record['state'].padStart(2, '0') : null;
    const query = supabase
      .from('markets')
      .select('region_id')
      .eq('region_type', 'city')
      .ilike('region_name', `%${cityName}%`);
    if (stateCode) query.eq('state_code', stateCode);
    const { data } = await query.limit(1).single();
    return data?.region_id || null;
  }

  if (geoLevel === 'zip code tabulation area') {
    const zipCode = geoCode ? normalizeZipKey(geoCode) : '';
    const { data } = await supabase
      .from('markets')
      .select('region_id')
      .eq('region_type', 'zip')
      .ilike('region_name', `%${zipCode}%`)
      .limit(1)
      .single();
    return data?.region_id || null;
  }

  return null;
}

/**
 * Create a new markets row from a Census geography. Returns the new
 * region_id, or null when creation fails or the geo is unsupported.
 */
async function createMarketFromCensusGeo(
  supabase: SupabaseClient,
  logger: Logger,
  name: string,
  geoCode: string,
  geoLevel: string,
  record: Record<string, string>,
): Promise<string | null> {
  if (
    geoLevel === 'metropolitan statistical area/micropolitan statistical area'
  ) {
    const metroName = name.split(',')[0].trim();
    const stateName = name.split(',')[1]?.trim() || null;
    const stateCode = record['state']
      ? getStateCodeFromFIPS(record['state'])
      : null;
    const regionId = `CENSUS-MSA-${geoCode.padStart(5, '0')}`;
    const { error } = await supabase.from('markets').upsert(
      {
        region_id: regionId,
        region_name: name,
        region_type: 'msa',
        state_name: stateName || undefined,
        state_code: stateCode || undefined,
        metro_name: metroName,
      },
      { onConflict: 'region_id', ignoreDuplicates: false },
    );
    if (error) {
      logger.error(`Error creating market for ${name}: ${error.message}`);
      return null;
    }
    logger.log(`Created market: ${name} (${regionId})`);
    return regionId;
  }

  if (geoLevel === 'state') {
    const stateCode = getStateCodeFromFIPS(geoCode);
    const stateName = name.replace(' State', '').trim();
    const regionId = `CENSUS-STATE-${geoCode.padStart(2, '0')}`;
    const { error } = await supabase.from('markets').upsert(
      {
        region_id: regionId,
        region_name: stateName,
        region_type: 'state',
        state_name: stateName,
        state_code: stateCode,
      },
      { onConflict: 'region_id', ignoreDuplicates: false },
    );
    if (error) {
      logger.error(`Error creating market for ${name}: ${error.message}`);
      return null;
    }
    return regionId;
  }

  if (geoLevel === 'place') {
    const stateName = name.split(',')[1]?.trim() || null;
    const stateCode = record['state']
      ? getStateCodeFromFIPS(record['state'])
      : null;
    const regionId = `CENSUS-PLACE-${geoCode.padStart(7, '0')}`;
    const { error } = await supabase.from('markets').upsert(
      {
        region_id: regionId,
        region_name: name,
        region_type: 'city',
        state_name: stateName || undefined,
        state_code: stateCode || undefined,
      },
      { onConflict: 'region_id', ignoreDuplicates: false },
    );
    if (error) {
      logger.error(`Error creating market for ${name}: ${error.message}`);
      return null;
    }
    return regionId;
  }

  if (geoLevel === 'zip code tabulation area') {
    const zipCode = geoCode ? normalizeZipKey(geoCode) : '';
    const regionId = `CENSUS-ZIP-${zipCode}`;
    const { error } = await supabase.from('markets').upsert(
      {
        region_id: regionId,
        region_name: `ZIP Code ${zipCode}`,
        region_type: 'zip',
        state_code: record['state']
          ? getStateCodeFromFIPS(record['state'])
          : undefined,
      },
      { onConflict: 'region_id', ignoreDuplicates: false },
    );
    if (error) {
      logger.error(
        `Error creating market for ZIP ${zipCode}: ${error.message}`,
      );
      return null;
    }
    return regionId;
  }

  return null;
}

/**
 * Resolve a Census geography to a region_id: try to match an existing
 * markets row first; on miss, create a synthetic CENSUS-* row.
 * Returns null when neither lookup nor creation produced a region.
 */
export async function resolveOrCreateMarket(
  supabase: SupabaseClient,
  logger: Logger,
  name: string,
  geoCode: string,
  geoLevel: string,
  record: Record<string, string>,
): Promise<string | null> {
  const existing = await mapCensusGeoToRegionId(
    supabase,
    name,
    geoCode,
    geoLevel,
    record,
  );
  if (existing) return existing;
  return createMarketFromCensusGeo(
    supabase,
    logger,
    name,
    geoCode,
    geoLevel,
    record,
  );
}
