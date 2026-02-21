/**
 * Region Filter & Table Name Utilities
 *
 * Pure functions for building Supabase query filters based on geography level
 * and resolving data source + geo level to a database table name.
 *
 * Extracted from TimeSeriesService to keep the service under the 300-line limit.
 */

import { normalizeZipKey } from '../common/zip';
import {
  normalizeStateRegionId,
  normalizeCountyFips,
  normalizeCbsaCode,
} from '../common/geo';

/**
 * Add region-specific filter based on geography level and data source.
 *
 * CONTRACT: This method accepts regionId in ANY format:
 *   - Numeric IDs (CBSA codes, FIPS codes, ZIP codes) -> query by code/id column
 *   - Text names (metro names, county names) -> query by name column with ILIKE
 *
 * The data binding layer (frontend hooks) relies on this contract to pass
 * regionIds directly from GeoJSON features without pre-processing.
 *
 * IMPORTANT: When checking whether to use code vs name lookup, ALWAYS check
 * if regionId is numeric FIRST using isNumericId(), not whether normalization
 * changed the value. This ensures IDs like "31080" (already 5 digits) still
 * use the code column, not the name column.
 *
 * Column names vary by data source:
 * - Realtor: state_id, cbsa_code/cbsa_title, county_fips/county_name, postal_code
 * - Zillow: region_name (for state/city/zip), cbsa_code, fips_code
 * - Census: state_fips/state_name, cbsa_code/cbsa_title, fips_code/county_name, zcta
 * - Economic: state_fips/state_name, cbsa_code/cbsa_title, fips_code/county_name
 * - Calculated: geography_id, geography_name, geography_type
 * - PropertyIQ: location_id, location_name, geography, score_type
 */
export function addRegionFilter(
  query: any,
  geoLevel: string,
  regionId: string,
  source: string,
) {
  const level = geoLevel.toLowerCase();

  // Helper: Check if regionId is a numeric code (CBSA, FIPS, ZIP)
  // CRITICAL: Use this for code vs name decisions, NOT normalization comparison
  const isNumericId = (id: string) => /^\d+$/.test(id.trim());

  // Normalize IDs so frontend can send FIPS, code, or name interchangeably
  const regionKey = level === 'zip' ? normalizeZipKey(regionId) : regionId;
  const stateNorm = level === 'state' ? normalizeStateRegionId(regionId) : null;
  const stateKey = stateNorm ? { code: stateNorm.stateCode, fips: stateNorm.stateFips, name: stateNorm.stateName } : null;
  const countyKey = level === 'county' && isNumericId(regionId) ? normalizeCountyFips(regionId) : regionId;
  const metroKey = level === 'metro' && isNumericId(regionId) ? normalizeCbsaCode(regionId) : regionId;

  // Handle calculated_metrics table (uses geography_id and geography_type)
  if (source === 'calculated') {
    return addCalculatedFilter(query, level, regionId, regionKey, stateKey, countyKey, metroKey, isNumericId);
  }

  // Handle propertyiq_scores table (uses location_id, location_name, geography, score_type)
  if (source === 'propertyiq') {
    return addPropertyIQFilter(query, level, regionId, regionKey, stateKey, countyKey, metroKey, isNumericId);
  }

  // Standard sources (realtor, zillow, census, economic, permits)
  return addStandardFilter(query, level, regionId, regionKey, stateKey, countyKey, metroKey, source, isNumericId);
}

function addCalculatedFilter(
  query: any,
  level: string,
  regionId: string,
  regionKey: string,
  stateKey: { code: string; fips: string; name: string } | null,
  countyKey: string,
  metroKey: string,
  isNumericId: (id: string) => boolean,
) {
  // Add geography_type filter
  query = query.eq('geography_type', level);

  switch (level) {
    case 'national':
      if (regionId === 'United States' || regionId === 'US') {
        return query.or('geography_id.eq.US,geography_name.ilike.United States');
      }
      return query.eq('geography_id', regionId);

    case 'state':
      if (stateKey) {
        return query.or(`geography_id.eq.${stateKey.code},geography_id.eq.${stateKey.fips}`);
      }
      return query.or(`geography_id.ilike.${regionId},geography_name.ilike.${regionId}`);

    case 'metro':
      if (isNumericId(regionId)) {
        return query.eq('geography_id', metroKey);
      }
      return query.ilike('geography_name', `${regionId}%`);

    case 'county':
      if (isNumericId(regionId)) {
        return query.eq('geography_id', countyKey);
      }
      const countyParts = regionId.split(',').map(s => s.trim());
      return query.ilike('geography_name', `${countyParts[0]}%`);

    case 'zip':
      return query.eq('geography_id', regionKey);

    case 'city':
      const cityParts = regionId.split(',').map(s => s.trim());
      return query.ilike('geography_name', `${cityParts[0]}%`);

    case 'tract':
      if (isNumericId(regionId)) {
        return query.eq('geography_id', regionId.trim().padStart(11, '0'));
      }
      return query.ilike('geography_name', `${regionId}%`);

    default:
      return query.eq('geography_id', regionId);
  }
}

function addPropertyIQFilter(
  query: any,
  level: string,
  regionId: string,
  regionKey: string,
  stateKey: { code: string; fips: string; name: string } | null,
  countyKey: string,
  metroKey: string,
  isNumericId: (id: string) => boolean,
) {
  // Add geography filter (propertyiq_scores uses 'geography' column)
  query = query.eq('geography', level);

  switch (level) {
    case 'national':
      if (regionId === 'United States' || regionId === 'US') {
        return query.or('location_id.eq.US,location_name.ilike.United States');
      }
      return query.eq('location_id', regionId);

    case 'state':
      if (stateKey) {
        return query.eq('location_id', stateKey.code);
      }
      if (isNumericId(regionId) && regionId.trim().length <= 2) {
        return query.eq('location_id', regionId.trim().padStart(2, '0'));
      }
      return query.eq('location_id', regionId);

    case 'metro':
      if (isNumericId(regionId)) {
        return query.eq('location_id', metroKey);
      }
      return query.ilike('location_name', `${regionId}%`);

    case 'county':
      if (isNumericId(regionId)) {
        return query.eq('location_id', countyKey);
      }
      const countyParts = regionId.split(',').map(s => s.trim());
      return query.ilike('location_name', `${countyParts[0]}%`);

    case 'zip':
      return query.eq('location_id', regionKey);

    case 'city':
      const cityParts = regionId.split(',').map(s => s.trim());
      return query.ilike('location_name', `${cityParts[0]}%`);

    case 'tract':
      if (isNumericId(regionId)) {
        return query.eq('location_id', regionId.trim().padStart(11, '0'));
      }
      return query.ilike('location_name', `${regionId}%`);

    default:
      return query.eq('location_id', regionId);
  }
}

function addStandardFilter(
  query: any,
  level: string,
  regionId: string,
  regionKey: string,
  stateKey: { code: string; fips: string; name: string } | null,
  countyKey: string,
  metroKey: string,
  source: string,
  isNumericId: (id: string) => boolean,
) {
  switch (level) {
    case 'national':
      if (source === 'realtor') {
        return query.eq('country', 'United States');
      }
      // Census and Economic national tables have one row per period, no region filter needed
      return query;

    case 'state':
      if (stateKey) {
        if (source === 'realtor') return query.eq('state_id', stateKey.code);
        if (source === 'zillow') return query.eq('region_name', stateKey.name);
        return query.eq('state_fips', stateKey.fips);
      }
      if (source === 'realtor') {
        if (regionId.length === 2 && /^[A-Za-z]{2}$/.test(regionId)) {
          return query.eq('state_id', regionId.toUpperCase());
        }
        return query.eq('state_name', regionId);
      }
      if (source === 'zillow') return query.eq('region_name', regionId);
      if (isNumericId(regionId) && regionId.trim().length <= 2) {
        return query.eq('state_fips', regionId.trim().padStart(2, '0'));
      }
      return query.eq('state_name', regionId);

    case 'metro':
      if (isNumericId(regionId)) return query.eq('cbsa_code', metroKey);
      if (source === 'zillow') return query.eq('region_name', regionId);
      if (source === 'realtor') return query.ilike('cbsa_title', `${regionId}%`);
      return query.ilike('cbsa_title', `${regionId}%`);

    case 'county':
      if (isNumericId(regionId)) {
        if (source === 'realtor') return query.eq('county_fips', countyKey);
        return query.eq('fips_code', countyKey);
      }
      const countyParts = regionId.split(',').map(s => s.trim());
      const countyName = countyParts[0];
      const countyState = countyParts[1];
      if (source === 'realtor') {
        const searchPattern = countyState
          ? `${countyName.toLowerCase()}, ${countyState.toLowerCase()}`
          : countyName.toLowerCase();
        return query.ilike('county_name', `${searchPattern}%`);
      }
      return query.ilike('county_name', `${countyName}%`);

    case 'zip':
      if (source === 'realtor') return query.eq('postal_code', regionKey);
      if (source === 'zillow') return query.eq('region_name', regionKey);
      if (source === 'census') return query.eq('zcta', regionKey);
      return query.eq('postal_code', regionKey);

    case 'city':
      const cityParts = regionId.split(',').map(s => s.trim());
      const cityName = cityParts[0];
      const stateCode = cityParts[1];
      if (source === 'zillow') {
        if (stateCode) return query.eq('region_name', cityName).eq('state_code', stateCode);
        return query.eq('region_name', cityName);
      }
      return query.ilike('place_name', `${cityName}%`);

    case 'tract':
      if (isNumericId(regionId)) {
        const tractId = regionId.trim().padStart(11, '0');
        if (source === 'census') return query.eq('tract_geoid', tractId);
        return query.eq('geoid', tractId);
      }
      return query.ilike('tract_name', `${regionId}%`);

    default:
      return query.eq('region_id', regionId);
  }
}

/**
 * Resolve data source + geography level to a database table name.
 * Returns null if no table exists for the combination.
 */
export function getTableName(source: string, geoLevel: string): string | null {
  const level = geoLevel.toLowerCase();

  if (source === 'zillow') {
    if (level === 'metro') return 'zillow_metro';
    if (level === 'state') return 'zillow_state';
    if (level === 'county') return 'zillow_county';
    if (level === 'zip') return 'zillow_zip';
    if (level === 'city') return 'zillow_city';
  }

  if (source === 'realtor') {
    if (level === 'national') return 'realtor_national';
    if (level === 'metro') return 'realtor_metro';
    if (level === 'state') return 'realtor_state';
    if (level === 'county') return 'realtor_county';
    if (level === 'zip') return 'realtor_zip';
  }

  if (source === 'census') {
    if (level === 'national') return 'census_national';
    if (level === 'state') return 'census_state';
    if (level === 'metro') return 'census_metro';
    if (level === 'county') return 'census_county';
    if (level === 'city') return 'census_city';
    if (level === 'zip') return 'census_zip';
  }

  if (source === 'economic') {
    if (level === 'national') return 'economic_national';
    if (level === 'state') return 'economic_state';
    if (level === 'metro') return 'economic_metro';
    if (level === 'county') return 'economic_county';
  }

  if (source === 'permits') {
    if (level === 'state' || level === 'national') return 'permits_state';
    if (level === 'county') return 'permits_county';
  }

  if (source === 'calculated') return 'calculated_metrics';
  if (source === 'propertyiq') return 'propertyiq_scores';

  return null;
}
