import { SupabaseClient } from '@supabase/supabase-js';
import { normalizeZipKey } from '../common/zip';
import {
  normalizeStateToCode,
  normalizeStateToFips,
  normalizeCountyFips,
  normalizeCbsaCode,
} from '../common/geo';

/**
 * Fetch a metric value from a specific table.
 * Extracted from InheritanceService — takes the Supabase client as a
 * parameter instead of reading it off `this`.
 */
export async function fetchMetricValue(
  supabase: SupabaseClient,
  geographyId: string,
  geographyType: string,
  metricName: string,
  tableName: string,
  periodDate: string,
): Promise<number | null> {
  try {
    // Handle different table structures
    // Some tables use geography_id, others use specific ID columns

    let query = supabase.from(tableName).select(metricName);

    // Add geography filter based on table type
    if (tableName.startsWith('economic_')) {
      switch (geographyType) {
        case 'state':
          query = query.eq('state_fips', normalizeStateToFips(geographyId));
          break;
        case 'metro':
          query = query.eq(
            'cbsa_code',
            /^\d+$/.test(geographyId.trim())
              ? normalizeCbsaCode(geographyId)
              : geographyId,
          );
          break;
        case 'county':
          query = query.eq(
            'fips_code',
            /^\d+$/.test(geographyId.trim())
              ? normalizeCountyFips(geographyId)
              : geographyId,
          );
          break;
        case 'national':
          // National table might use 'US' or have a single row
          query = query.limit(1);
          break;
        default:
          return null;
      }
    } else if (tableName.startsWith('calculated_metrics')) {
      let id = geographyId;
      if (geographyType === 'zip') id = normalizeZipKey(geographyId);
      else if (geographyType === 'state')
        id = normalizeStateToCode(geographyId);
      else if (geographyType === 'county' && /^\d+$/.test(geographyId.trim()))
        id = normalizeCountyFips(geographyId);
      else if (geographyType === 'metro' && /^\d+$/.test(geographyId.trim()))
        id = normalizeCbsaCode(geographyId);
      query = query.eq('geography_id', id);
    } else if (tableName.startsWith('permits_')) {
      switch (geographyType) {
        case 'state':
          query = query.eq('state_fips', normalizeStateToFips(geographyId));
          break;
        case 'metro':
          query = query.eq(
            'cbsa_code',
            /^\d+$/.test(geographyId.trim())
              ? normalizeCbsaCode(geographyId)
              : geographyId,
          );
          break;
        case 'county':
          query = query.eq(
            'fips_code',
            /^\d+$/.test(geographyId.trim())
              ? normalizeCountyFips(geographyId)
              : geographyId,
          );
          break;
        default:
          return null;
      }
    } else if (tableName.startsWith('census_')) {
      switch (geographyType) {
        case 'state':
          query = query.eq('state_fips', normalizeStateToFips(geographyId));
          break;
        case 'metro':
          query = query.eq(
            'cbsa_code',
            /^\d+$/.test(geographyId.trim())
              ? normalizeCbsaCode(geographyId)
              : geographyId,
          );
          break;
        case 'county':
          query = query.eq(
            'fips_code',
            /^\d+$/.test(geographyId.trim())
              ? normalizeCountyFips(geographyId)
              : geographyId,
          );
          break;
        case 'zip':
          query = query.eq('zcta', normalizeZipKey(geographyId));
          break;
        case 'national':
          query = query.limit(1);
          break;
        default:
          return null;
      }
    } else {
      let id = geographyId;
      if (geographyType === 'zip') id = normalizeZipKey(geographyId);
      else if (geographyType === 'state')
        id = normalizeStateToCode(geographyId);
      else if (geographyType === 'county' && /^\d+$/.test(geographyId.trim()))
        id = normalizeCountyFips(geographyId);
      else if (geographyType === 'metro' && /^\d+$/.test(geographyId.trim()))
        id = normalizeCbsaCode(geographyId);
      query = query.eq('geography_id', id);
    }

    // Add period date filter
    query = query.eq('period_date', periodDate);

    const { data, error } = await query.limit(1).single();

    if (error || !data) {
      return null;
    }

    const value = data[metricName];
    return typeof value === 'number' ? value : null;
  } catch (err) {
    console.warn(
      `Error fetching ${metricName} from ${tableName} for ${geographyId}:`,
      err,
    );
    return null;
  }
}
