/**
 * Zillow Service
 * Provides home value, forecast, rent, and renter demand data
 *
 * Refactored to use helper modules for crosswalk and query operations
 */

import { Injectable, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.module';

// Import types
import type { HomeValueData, ForecastData } from './types';
export type { HomeValueData, ForecastData };

// Import helpers
import {
  buildStateMappings,
  buildMetroMappings,
  buildCountyMappings,
  buildZipMappings,
  lookupMetro
} from './helpers/crosswalk';

import {
  getLatestDateForTable,
  mapRentPropertyType,
  getForecastValue,
  queryZhvi,
  queryZori,
  queryZordi,
  queryZhvf
} from './helpers/queries';

@Injectable()
export class ZillowService {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) { }

  // ============================================================================
  // ZHVI (Home Value) Methods
  // ============================================================================

  async getStateHomeValues(date?: string): Promise<HomeValueData[]> {
    const targetDate = date || await this.getLatestDate('State');
    const zillow = await queryZhvi(this.supabase, 'State', targetDate);
    if (!zillow.length) return [];

    const stateMap = await buildStateMappings(this.supabase);

    return zillow.map(z => {
      const state = stateMap.get(z.region_id);
      return {
        region_id: z.region_id,
        region_name: state?.name || 'Unknown',
        state_abbrev: state?.abbrev || null,
        state_name: state?.name || null,
        value: z.value,
        date: z.date,
        property_type: z.property_type,
        geography: z.geography,
      };
    }).sort((a, b) => b.value - a.value);
  }

  async getMetroHomeValues(date?: string, stateFilter?: string): Promise<HomeValueData[]> {
    const targetDate = date || await this.getLatestDate('Metro');
    const zillow = await queryZhvi(this.supabase, 'Metro', targetDate);
    if (!zillow.length) return [];

    const { byZillowId, byCbsaCode } = await buildMetroMappings(this.supabase, stateFilter);

    return zillow.map(z => {
      const { metro, cbsaCode } = lookupMetro(z.region_id, byZillowId, byCbsaCode);

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
    }).sort((a, b) => b.value - a.value);
  }

  async getCountyHomeValues(date?: string, stateFilter?: string): Promise<HomeValueData[]> {
    const targetDate = date || await this.getLatestDate('County');
    const countyMap = await buildCountyMappings(this.supabase, stateFilter);

    const fipsCodes = [...countyMap.keys()];
    if (fipsCodes.length === 0) return [];

    const results: HomeValueData[] = [];
    const chunkSize = 500;

    for (let i = 0; i < fipsCodes.length; i += chunkSize) {
      const chunk = fipsCodes.slice(i, i + chunkSize);
      const zillow = await queryZhvi(this.supabase, 'County', targetDate, chunk);

      zillow.forEach(z => {
        const county = countyMap.get(z.region_id);
        results.push({
          region_id: z.region_id,
          region_name: county?.name || 'Unknown',
          county_fips: z.region_id,
          state_abbrev: county?.state_abbrev || null,
          state_name: county?.state_name || null,
          value: z.value,
          date: z.date,
          property_type: z.property_type,
          geography: 'County',
        });
      });
    }

    return results.sort((a, b) => b.value - a.value);
  }

  async getZipHomeValues(stateFilter: string, countyFilter?: string, date?: string): Promise<HomeValueData[]> {
    const targetDate = date || await this.getLatestDate('City');
    const zipMap = await buildZipMappings(this.supabase, stateFilter, countyFilter);

    const zipCodes = [...zipMap.keys()];
    if (zipCodes.length === 0) return [];

    const { data: zillow, error } = await this.supabase
      .from('zillow_zhvi')
      .select('region_id, value, date, property_type, geography')
      .eq('date', targetDate)
      .eq('property_type', 'sfrcondo')
      .eq('tier', '0.33_0.67')
      .in('region_id', zipCodes)
      .limit(2000);

    if (error) throw new Error(error.message);
    if (!zillow) return [];

    return zillow.map(z => {
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
    }).sort((a, b) => b.value - a.value);
  }

  async getLatestDate(geography: string): Promise<string> {
    return getLatestDateForTable(this.supabase, 'zillow_zhvi', geography);
  }

  async getAvailableDates(geography: string): Promise<string[]> {
    const { data } = await this.supabase
      .from('zillow_zhvi')
      .select('date')
      .eq('geography', geography)
      .order('date', { ascending: false })
      .limit(100);

    const dates = data?.map(d => d.date as string) || [];
    return [...new Set(dates)];
  }

  async getTimeSeries(regionId: string, geography: string): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('zillow_zhvi')
      .select('date, value, property_type')
      .eq('region_id', regionId)
      .eq('geography', geography)
      .eq('property_type', 'sfrcondo')
      .eq('tier', '0.33_0.67')
      .order('date', { ascending: true });

    if (error) throw new Error(error.message);
    return data || [];
  }

  // ============================================================================
  // ZHVF (Forecast) Methods
  // ============================================================================

  async getMetroForecast(horizon: string = '12m'): Promise<ForecastData[]> {
    const forecasts = await queryZhvf(this.supabase, ['Metro', 'US']);
    if (!forecasts.length) return [];

    const { byZillowId, byCbsaCode } = await buildMetroMappings(this.supabase);

    return forecasts.map(f => {
      const { metro, cbsaCode } = lookupMetro(f.region_id, byZillowId, byCbsaCode);
      const is5DigitCode = /^\d{5}$/.test(f.region_id);

      return {
        region_id: f.region_id,
        region_name: f.geography === 'US' ? 'United States' : (metro?.cbsa_name || 'Unknown'),
        cbsa_code: metro?.cbsa_code || (is5DigitCode ? f.region_id : null),
        state_abbrev: metro?.state || null,
        forecast_1m: f.forecast_1m,
        forecast_3m: f.forecast_3m,
        forecast_12m: f.forecast_12m,
        value: getForecastValue(f, horizon),
        date: f.date,
        geography: f.geography,
      };
    }).sort((a, b) => getForecastValue(b, horizon) - getForecastValue(a, horizon));
  }

  async getZipForecast(stateFilter?: string, horizon: string = '12m'): Promise<ForecastData[]> {
    const forecasts = await queryZhvf(this.supabase, 'Zip');
    if (!forecasts.length) return [];

    // Build ZIP lookup
    let query = this.supabase
      .from('geography_crosswalk')
      .select('zip_code, zip_default_city, state_abbrev')
      .not('zip_code', 'is', null);

    if (stateFilter) {
      query = query.eq('state_abbrev', stateFilter);
    }

    const { data: crosswalk } = await query.limit(30000);

    const zipMap = new Map<string, { city: string; state: string }>();
    crosswalk?.forEach(row => {
      if (row.zip_code) {
        zipMap.set(row.zip_code, { city: row.zip_default_city, state: row.state_abbrev });
      }
    });

    let filteredForecasts = forecasts;
    if (stateFilter) {
      const validZips = new Set(zipMap.keys());
      filteredForecasts = forecasts.filter(f => validZips.has(f.region_id));
    }

    return filteredForecasts.map(f => {
      const zip = zipMap.get(f.region_id);
      return {
        region_id: f.region_id,
        region_name: zip ? `${f.region_id} - ${zip.city}` : f.region_id,
        zip_code: f.region_id,
        state_abbrev: zip?.state || null,
        forecast_1m: f.forecast_1m,
        forecast_3m: f.forecast_3m,
        forecast_12m: f.forecast_12m,
        value: getForecastValue(f, horizon),
        date: f.date,
        geography: 'Zip',
      };
    }).sort((a, b) => getForecastValue(b, horizon) - getForecastValue(a, horizon));
  }

  // ============================================================================
  // ZORI (Rent Index) Methods
  // ============================================================================

  async getMetroRent(date?: string, propertyType: string = 'all'): Promise<HomeValueData[]> {
    const dbPropertyType = mapRentPropertyType(propertyType);
    const targetDate = date || await getLatestDateForTable(this.supabase, 'zillow_zori', 'Metro');

    const zillow = await queryZori(this.supabase, ['Metro', 'US'], targetDate, dbPropertyType);
    if (!zillow.length) return [];

    const { byZillowId, byCbsaCode } = await buildMetroMappings(this.supabase);

    return zillow.map(z => {
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

      const { metro, cbsaCode } = lookupMetro(z.region_id, byZillowId, byCbsaCode);

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
    }).sort((a, b) => b.value - a.value);
  }

  async getCountyRent(date?: string, propertyType: string = 'all', stateFilter?: string): Promise<HomeValueData[]> {
    const dbPropertyType = mapRentPropertyType(propertyType);
    const targetDate = date || await getLatestDateForTable(this.supabase, 'zillow_zori', 'County');

    const countyMap = await buildCountyMappings(this.supabase, stateFilter);
    const fipsCodes = [...countyMap.keys()];
    if (fipsCodes.length === 0) return [];

    const results: HomeValueData[] = [];
    const chunkSize = 500;

    for (let i = 0; i < fipsCodes.length; i += chunkSize) {
      const chunk = fipsCodes.slice(i, i + chunkSize);
      const zillow = await queryZori(this.supabase, 'County', targetDate, dbPropertyType, chunk);

      zillow.forEach(z => {
        const county = countyMap.get(z.region_id);
        results.push({
          region_id: z.region_id,
          region_name: county?.name || 'Unknown',
          county_fips: z.region_id,
          state_abbrev: county?.state_abbrev || null,
          state_name: county?.state_name || null,
          value: z.value,
          date: z.date,
          property_type: z.property_type,
          geography: 'County',
        });
      });
    }

    return results.sort((a, b) => b.value - a.value);
  }

  async getZipRent(stateFilter: string, propertyType: string = 'all', date?: string): Promise<HomeValueData[]> {
    const dbPropertyType = mapRentPropertyType(propertyType);
    const targetDate = date || await getLatestDateForTable(this.supabase, 'zillow_zori', 'Zip');

    const zipMap = await buildZipMappings(this.supabase, stateFilter);
    const zipCodes = [...zipMap.keys()];
    if (zipCodes.length === 0) return [];

    const zillow = await queryZori(this.supabase, 'Zip', targetDate, dbPropertyType, zipCodes);

    return zillow.map(z => {
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
    }).sort((a, b) => b.value - a.value);
  }

  // ============================================================================
  // ZORDI (Renter Demand Index) Methods
  // ============================================================================

  async getMetroRenterDemand(date?: string, propertyType: string = 'all'): Promise<HomeValueData[]> {
    const dbPropertyType = mapRentPropertyType(propertyType);
    const targetDate = date || await getLatestDateForTable(this.supabase, 'zillow_zordi', 'Metro');

    const zillow = await queryZordi(this.supabase, ['Metro', 'US'], targetDate, dbPropertyType);
    if (!zillow.length) return [];

    const { byZillowId, byCbsaCode } = await buildMetroMappings(this.supabase);

    return zillow.map(z => {
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

      const { metro, cbsaCode } = lookupMetro(z.region_id, byZillowId, byCbsaCode);

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
    }).sort((a, b) => b.value - a.value);
  }

  async getZipRenterDemand(stateFilter: string, propertyType: string = 'all', date?: string): Promise<HomeValueData[]> {
    const dbPropertyType = mapRentPropertyType(propertyType);
    const targetDate = date || await getLatestDateForTable(this.supabase, 'zillow_zordi', 'Zip');

    const zipMap = await buildZipMappings(this.supabase, stateFilter);
    const zipCodes = [...zipMap.keys()];
    if (zipCodes.length === 0) return [];

    const zillow = await queryZordi(this.supabase, 'Zip', targetDate, dbPropertyType, zipCodes);

    return zillow.map(z => {
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
    }).sort((a, b) => b.value - a.value);
  }
}
