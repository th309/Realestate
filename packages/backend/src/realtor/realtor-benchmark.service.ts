import { Injectable, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';
import { normalizeZipKey } from '../common/zip';
import { normalizeCountyFips, normalizeCbsaCode } from '../common/geo';
import {
  safeString,
  toStateAbbr,
  processMetricValue,
  metricColumnMap,
} from './realtor.helpers';
import { RealtorNationalService } from './realtor-national.service';
import type { RealtorRow } from './realtor.types';

/**
 * State averages + the comprehensive benchmark lookup used by the
 * "how does this market compare?" UI. National averages come from
 * {@link RealtorNationalService}.
 */
@Injectable()
export class RealtorBenchmarkService {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly national: RealtorNationalService,
  ) {}

  /**
   * Get state average for a given state
   * @param stateId - Can be FIPS code (e.g., "32") or abbreviation (e.g., "NV")
   */
  async getStateAverages(
    stateId: string,
  ): Promise<Record<string, number | null>> {
    const columns = ['state_id', ...Object.values(metricColumnMap)];
    // Convert FIPS to state abbreviation (database stores abbreviations like "NV", not FIPS "32")
    const stateAbbr = toStateAbbr(stateId);
    console.log(
      `[getStateAverages] Input stateId=${stateId}, converted to stateAbbr=${stateAbbr}`,
    );

    const { data, error } = await this.supabase
      .from('realtor_state')
      .select(columns.join(','))
      .eq('state_id', stateAbbr)
      .order('period_date', { ascending: false })
      .limit(1);

    console.log(`[getStateAverages] Query result: ${data?.length || 0} rows`);

    if (error) {
      console.error('Error fetching state averages:', error);
      return {};
    }

    const row = data?.[0] || {};
    const result: Record<string, number | null> = {};

    for (const [metricId, column] of Object.entries(metricColumnMap)) {
      result[metricId] = processMetricValue(metricId, row[column]);
    }

    console.log(
      `[getStateAverages] Returning ${Object.values(result).filter((v) => v !== null).length} metrics with values`,
    );
    return result;
  }

  /**
   * Get comprehensive benchmark data for a specific geography
   * Returns location values, state averages, and national averages for all metrics
   */
  async getBenchmarks(
    geoLevel: string,
    regionId: string,
    stateId?: string,
  ): Promise<{
    location: Record<string, number | null>;
    state: Record<string, number | null>;
    national: Record<string, number | null>;
    locationName: string;
    stateName: string | null;
  }> {
    console.log(
      `[getBenchmarks] geoLevel=${geoLevel}, regionId=${regionId}, stateId=${stateId}`,
    );
    const columns = Object.values(metricColumnMap);

    // Get national averages
    const national = await this.national.getAllNationalAverages();
    console.log(
      `[getBenchmarks] National averages:`,
      Object.keys(national).length,
      'metrics',
    );

    // Get state averages if applicable
    let state: Record<string, number | null> = {};
    let stateName: string | null = null;

    if (stateId && geoLevel !== 'state') {
      // Convert FIPS to abbreviation (database stores "NV" not "32")
      const stateAbbr = toStateAbbr(stateId);
      console.log(
        `[getBenchmarks] Fetching state averages for stateId=${stateId} (abbr=${stateAbbr})`,
      );
      state = await this.getStateAverages(stateId);
      const stateMetricsWithValues = Object.values(state).filter(
        (v) => v !== null,
      ).length;
      console.log(
        `[getBenchmarks] State averages received: ${stateMetricsWithValues} metrics with values`,
      );

      // Get state name using abbreviation
      const { data: stateData } = await this.supabase
        .from('realtor_state')
        .select('state_name')
        .eq('state_id', stateAbbr)
        .limit(1);

      stateName = stateData?.[0]?.state_name || stateAbbr;
      console.log(`[getBenchmarks] State name: ${stateName}`);
    } else {
      console.log(
        `[getBenchmarks] Skipping state averages: stateId=${stateId}, geoLevel=${geoLevel}`,
      );
    }

    // Get location values based on geo level
    const location: Record<string, number | null> = {};
    let locationName = '';

    if (geoLevel === 'state') {
      // Convert FIPS to abbreviation (database stores "NV" not "32")
      const stateAbbr = toStateAbbr(regionId);
      console.log(
        `[getBenchmarks] State query for regionId=${regionId} (abbr=${stateAbbr})`,
      );

      const { data, error } = await this.supabase
        .from('realtor_state')
        .select([...columns, 'state_name'].join(','))
        .eq('state_id', stateAbbr)
        .order('period_date', { ascending: false })
        .limit(1);

      console.log(
        `[getBenchmarks] State query result:`,
        data?.length || 0,
        'rows',
        error ? `Error: ${error.message}` : '',
      );

      const row = (data as RealtorRow[] | null)?.[0];
      if (row) {
        locationName = safeString(row.state_name);
        for (const [metricId, column] of Object.entries(metricColumnMap)) {
          location[metricId] = processMetricValue(metricId, row[column]);
        }
        console.log(
          `[getBenchmarks] Found state: ${locationName}, metrics with values:`,
          Object.values(location).filter((v) => v !== null).length,
        );
      }
    } else if (geoLevel === 'metro') {
      const cbsaKey = /^\d+$/.test(regionId.trim())
        ? normalizeCbsaCode(regionId)
        : regionId;
      const { data } = await this.supabase
        .from('realtor_metro')
        .select([...columns, 'cbsa_title'].join(','))
        .eq('cbsa_code', cbsaKey)
        .order('period_date', { ascending: false })
        .limit(1);

      const row = (data as RealtorRow[] | null)?.[0];
      if (row) {
        locationName = safeString(row.cbsa_title);
        for (const [metricId, column] of Object.entries(metricColumnMap)) {
          location[metricId] = processMetricValue(metricId, row[column]);
        }
      }
    } else if (geoLevel === 'county') {
      const fipsKey = /^\d+$/.test(regionId.trim())
        ? normalizeCountyFips(regionId)
        : regionId;
      const { data } = await this.supabase
        .from('realtor_county')
        .select([...columns, 'county_name'].join(','))
        .eq('county_fips', fipsKey)
        .order('period_date', { ascending: false })
        .limit(1);

      const row = (data as RealtorRow[] | null)?.[0];
      if (row) {
        locationName = safeString(row.county_name);
        for (const [metricId, column] of Object.entries(metricColumnMap)) {
          location[metricId] = processMetricValue(metricId, row[column]);
        }
      }
    } else if (geoLevel === 'zip') {
      const zipKey = normalizeZipKey(regionId);
      const { data } = await this.supabase
        .from('realtor_zip')
        .select([...columns, 'zip_name'].join(','))
        .eq('postal_code', zipKey)
        .order('period_date', { ascending: false })
        .limit(1);

      const row = (data as RealtorRow[] | null)?.[0];
      if (row) {
        locationName = safeString(row.zip_name);
        for (const [metricId, column] of Object.entries(metricColumnMap)) {
          location[metricId] = processMetricValue(metricId, row[column]);
        }
      }
    }

    return {
      location,
      state,
      national,
      locationName,
      stateName,
    };
  }
}
