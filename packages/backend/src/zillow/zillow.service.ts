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
  getLatestDateForMarketTable,
  mapRentPropertyType,
  getForecastValue,
  queryZhvi,
  queryZori,
  queryZordi,
  queryZhvf,
  queryMarketIndicator,
  queryAffordability
} from './helpers/queries';

import type { MarketIndicatorData, AffordabilityData, PriceCutsData, NewConstructionData, MarketIndicatorTable } from './types';

@Injectable()
export class ZillowService {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) { }

  // ============================================================================
  // ZHVI (Home Value) Methods
  // ============================================================================

  async getStateHomeValues(date?: string): Promise<HomeValueData[]> {
    // Query zillow_state table directly - it has region_name (state name) built in
    const { data: stateData, error } = await this.supabase
      .from('zillow_state')
      .select('region_id, region_name, state_code, value, period_date')
      .eq('metric_name', 'zhvi')
      .order('period_date', { ascending: false });

    if (error) {
      throw new Error(`Error fetching state home values: ${error.message}`);
    }

    if (!stateData || stateData.length === 0) return [];

    // Get the most recent value per state (data is ordered by date desc)
    const seenStates = new Set<number>();
    const results: HomeValueData[] = [];

    for (const record of stateData) {
      if (seenStates.has(record.region_id)) continue;
      seenStates.add(record.region_id);

      results.push({
        region_id: String(record.region_id),
        region_name: record.region_name,
        state_abbrev: record.state_code,
        state_name: record.region_name,
        value: Number(record.value),
        date: record.period_date,
        property_type: 'sfrcondo',
        geography: 'State',
      });
    }

    return results.sort((a, b) => b.value - a.value);
  }

  async getMetroHomeValues(date?: string, stateFilter?: string): Promise<HomeValueData[]> {
    // First get the latest date if not provided
    let targetDate = date;
    if (!targetDate) {
      const { data: latestData } = await this.supabase
        .from('zillow_metro')
        .select('period_date')
        .eq('metric_name', 'zhvi')
        .order('period_date', { ascending: false })
        .limit(1)
        .single();
      targetDate = latestData?.period_date;
    }

    // Query zillow_metro table directly - filter by date for efficiency
    let query = this.supabase
      .from('zillow_metro')
      .select('region_id, region_name, state_code, cbsa_code, value, period_date')
      .eq('metric_name', 'zhvi');

    if (targetDate) {
      query = query.eq('period_date', targetDate);
    }

    if (stateFilter) {
      query = query.eq('state_code', stateFilter.toUpperCase());
    }

    const { data: metroData, error } = await query.limit(2000);

    if (error) {
      throw new Error(`Error fetching metro home values: ${error.message}`);
    }

    if (!metroData || metroData.length === 0) return [];

    // Map results (already filtered by date, no dedup needed)
    const results: HomeValueData[] = metroData
      .filter(record => record.cbsa_code) // Skip records without cbsa_code
      .map(record => ({
        region_id: String(record.region_id),
        region_name: record.region_name,
        cbsa_code: record.cbsa_code,
        state_abbrev: record.state_code,
        value: Number(record.value),
        date: record.period_date,
        property_type: 'sfrcondo',
        geography: 'Metro',
      }));

    return results.sort((a, b) => b.value - a.value);
  }

  async getCountyHomeValues(date?: string, stateFilter?: string): Promise<HomeValueData[]> {
    // First get the latest date if not provided
    let targetDate = date;
    if (!targetDate) {
      const { data: latestData } = await this.supabase
        .from('zillow_county')
        .select('period_date')
        .eq('metric_name', 'zhvi')
        .order('period_date', { ascending: false })
        .limit(1)
        .single();
      targetDate = latestData?.period_date;
    }

    // Supabase has a 1000 row limit per request, so we need to paginate
    // to get all ~3200 counties
    const allData: any[] = [];
    const pageSize = 1000;
    let page = 0;

    while (true) {
      let query = this.supabase
        .from('zillow_county')
        .select('region_id, region_name, state_code, fips_code, value, period_date')
        .eq('metric_name', 'zhvi');

      if (targetDate) {
        query = query.eq('period_date', targetDate);
      }

      if (stateFilter) {
        query = query.eq('state_code', stateFilter.toUpperCase());
      }

      const { data: pageData, error } = await query.range(page * pageSize, (page + 1) * pageSize - 1);

      if (error) {
        throw new Error(`Error fetching county home values: ${error.message}`);
      }

      if (!pageData || pageData.length === 0) break;

      allData.push(...pageData);

      if (pageData.length < pageSize) break; // Last page
      page++;
    }

    if (allData.length === 0) return [];

    // Map results (already filtered by date, no dedup needed)
    const results: HomeValueData[] = allData
      .filter(record => record.fips_code) // Skip records without fips_code
      .map(record => ({
        region_id: String(record.region_id),
        region_name: record.region_name,
        county_fips: record.fips_code,
        state_abbrev: record.state_code,
        state_name: null,
        value: Number(record.value),
        date: record.period_date,
        property_type: 'sfrcondo',
        geography: 'County',
      }));

    return results.sort((a, b) => b.value - a.value);
  }

  async getZipHomeValues(stateFilter: string, countyFilter?: string, date?: string): Promise<HomeValueData[]> {
    // State filter is required for ZIP data
    if (!stateFilter) {
      return [];
    }

    // First get the latest date if not provided
    let targetDate = date;
    if (!targetDate) {
      const { data: latestData } = await this.supabase
        .from('zillow_zip')
        .select('period_date')
        .eq('metric_name', 'zhvi')
        .eq('state_code', stateFilter.toUpperCase())
        .order('period_date', { ascending: false })
        .limit(1)
        .single();
      targetDate = latestData?.period_date;
    }

    // Supabase has a 1000 row limit per request, so we need to paginate
    // for states with many ZIPs (CA has ~1700)
    const allData: any[] = [];
    const pageSize = 1000;
    let page = 0;

    while (true) {
      let query = this.supabase
        .from('zillow_zip')
        .select('region_id, region_name, state_code, county_fips, value, period_date')
        .eq('metric_name', 'zhvi')
        .eq('state_code', stateFilter.toUpperCase());

      if (targetDate) {
        query = query.eq('period_date', targetDate);
      }

      const { data: pageData, error } = await query.range(page * pageSize, (page + 1) * pageSize - 1);

      if (error) {
        throw new Error(`Error fetching ZIP home values: ${error.message}`);
      }

      if (!pageData || pageData.length === 0) break;

      allData.push(...pageData);

      if (pageData.length < pageSize) break; // Last page
      page++;
    }

    if (allData.length === 0) return [];

    // Map results (already filtered by date, no dedup needed)
    const results: HomeValueData[] = allData.map(record => ({
      region_id: String(record.region_id),
      region_name: record.region_name,
      zip_code: record.region_name,
      state_abbrev: record.state_code,
      state_name: null,
      value: Number(record.value),
      date: record.period_date,
      property_type: 'sfrcondo',
      geography: 'ZIP',
    }));

    return results.sort((a, b) => b.value - a.value);
  }

  async getCityHomeValues(stateFilter?: string): Promise<HomeValueData[]> {
    // City data requires a state filter due to large dataset (5M+ records)
    if (!stateFilter) {
      return []; // Return empty - cities require state filter
    }

    // First get the latest date
    const { data: latestData } = await this.supabase
      .from('zillow_city')
      .select('period_date')
      .eq('metric_name', 'zhvi')
      .eq('state_code', stateFilter.toUpperCase())
      .order('period_date', { ascending: false })
      .limit(1)
      .single();

    const targetDate = latestData?.period_date;
    if (!targetDate) return [];

    // Query zillow_city table - filter by state AND date for efficiency
    const { data: cityData, error } = await this.supabase
      .from('zillow_city')
      .select('region_id, region_name, state_code, metro_region_id, value, period_date')
      .eq('metric_name', 'zhvi')
      .eq('state_code', stateFilter.toUpperCase())
      .eq('period_date', targetDate)
      .limit(5000);

    if (error) {
      throw new Error(`Error fetching city home values: ${error.message}`);
    }

    if (!cityData || cityData.length === 0) return [];

    // Map results (already filtered by date, no dedup needed)
    const results: HomeValueData[] = cityData.map(record => ({
      region_id: String(record.region_id),
      region_name: record.region_name,
      state_abbrev: record.state_code,
      state_name: null,
      value: Number(record.value),
      date: record.period_date,
      property_type: 'sfrcondo',
      geography: 'City',
    }));

    return results.sort((a, b) => b.value - a.value);
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

    // Build ZIP lookup with pagination to get ALL ZIP codes
    const zipMap = new Map<string, { city: string; state: string }>();
    let page = 0;
    const pageSize = 1000;

    while (true) {
      let query = this.supabase
        .from('geography_crosswalk')
        .select('zip_code, zip_default_city, state_abbrev')
        .not('zip_code', 'is', null);

      if (stateFilter) {
        query = query.eq('state_abbrev', stateFilter.toUpperCase());
      }

      const { data: crosswalk } = await query.range(page * pageSize, (page + 1) * pageSize - 1);
      if (!crosswalk || crosswalk.length === 0) break;

      crosswalk.forEach(row => {
        if (row.zip_code) {
          zipMap.set(row.zip_code, { city: row.zip_default_city, state: row.state_abbrev });
        }
      });

      page++;
      if (crosswalk.length < pageSize) break;
    }

    // Filter forecasts to only include valid ZIP codes
    // zhvf region_id IS the ZIP code when it's a valid 5-digit ZIP
    const validZips = new Set(zipMap.keys());
    const filteredForecasts = forecasts.filter(f => validZips.has(f.region_id));

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

  // ============================================================================
  // Market Indicators Methods
  // ============================================================================

  /**
   * Generic method to get market indicator data for metros
   */
  async getMetroMarketIndicator(
    table: MarketIndicatorTable,
    date?: string,
    propertyType: string = 'sfrcondo'
  ): Promise<MarketIndicatorData[]> {
    const targetDate = date || await getLatestDateForMarketTable(this.supabase, table, 'Metro');
    const data = await queryMarketIndicator(this.supabase, table, ['Metro', 'US'], targetDate, propertyType);

    if (!data.length) return [];

    const { byZillowId, byCbsaCode } = await buildMetroMappings(this.supabase);

    return data.map(d => {
      if (d.geography === 'US') {
        return {
          region_id: d.region_id,
          region_name: 'United States',
          value: d.value,
          date: d.date,
          property_type: d.property_type,
          geography: 'US',
        };
      }

      const { metro, cbsaCode } = lookupMetro(d.region_id, byZillowId, byCbsaCode);

      return {
        region_id: d.region_id,
        region_name: metro?.cbsa_name || 'Unknown',
        cbsa_code: cbsaCode,
        state_abbrev: metro?.state || null,
        value: d.value,
        date: d.date,
        property_type: d.property_type,
        geography: 'Metro',
      };
    }).sort((a, b) => b.value - a.value);
  }

  // Inventory
  async getMetroInventory(date?: string): Promise<MarketIndicatorData[]> {
    return this.getMetroMarketIndicator('zillow_inventory', date);
  }

  // New Listings
  async getMetroNewListings(date?: string): Promise<MarketIndicatorData[]> {
    return this.getMetroMarketIndicator('zillow_new_listings', date);
  }

  // Pending Listings
  async getMetroPendingListings(date?: string): Promise<MarketIndicatorData[]> {
    return this.getMetroMarketIndicator('zillow_pending_listings', date);
  }

  // Median List Price
  async getMetroListPrice(date?: string): Promise<MarketIndicatorData[]> {
    return this.getMetroMarketIndicator('zillow_median_list_price', date);
  }

  // Sales Count
  async getMetroSalesCount(date?: string): Promise<MarketIndicatorData[]> {
    return this.getMetroMarketIndicator('zillow_sales_count', date);
  }

  // Median Sale Price
  async getMetroSalePrice(date?: string): Promise<MarketIndicatorData[]> {
    return this.getMetroMarketIndicator('zillow_sales_price', date);
  }

  // Sale-to-List Ratio
  async getMetroSaleToList(date?: string): Promise<MarketIndicatorData[]> {
    return this.getMetroMarketIndicator('zillow_sale_to_list', date);
  }

  // Days to Pending
  async getMetroDaysToPending(date?: string): Promise<MarketIndicatorData[]> {
    return this.getMetroMarketIndicator('zillow_days_to_pending', date);
  }

  // Days to Close
  async getMetroDaysToClose(date?: string): Promise<MarketIndicatorData[]> {
    return this.getMetroMarketIndicator('zillow_days_to_close', date);
  }

  // Market Heat Index
  async getMetroMarketHeat(date?: string): Promise<MarketIndicatorData[]> {
    return this.getMetroMarketIndicator('zillow_market_heat_index', date);
  }

  // ============================================================================
  // Price Cuts (Combined Metrics)
  // ============================================================================

  async getMetroPriceCuts(date?: string): Promise<PriceCutsData[]> {
    const targetDate = date || await getLatestDateForMarketTable(this.supabase, 'zillow_price_cut_share', 'Metro');

    const [shareData, amtData, pctData] = await Promise.all([
      queryMarketIndicator(this.supabase, 'zillow_price_cut_share', ['Metro', 'US'], targetDate),
      queryMarketIndicator(this.supabase, 'zillow_price_cut_amt', ['Metro', 'US'], targetDate),
      queryMarketIndicator(this.supabase, 'zillow_price_cut_pct', ['Metro', 'US'], targetDate),
    ]);

    const { byZillowId, byCbsaCode } = await buildMetroMappings(this.supabase);

    // Combine the data by region_id
    const combinedMap = new Map<string, PriceCutsData>();

    for (const d of shareData) {
      const { metro, cbsaCode } = lookupMetro(d.region_id, byZillowId, byCbsaCode);
      combinedMap.set(d.region_id, {
        region_id: d.region_id,
        region_name: d.geography === 'US' ? 'United States' : (metro?.cbsa_name || 'Unknown'),
        cbsa_code: cbsaCode,
        state_abbrev: metro?.state || null,
        date: d.date,
        geography: d.geography,
        share_with_price_cut: d.value,
        median_price_cut_amount: null,
        median_price_cut_percent: null,
      });
    }

    for (const d of amtData) {
      const existing = combinedMap.get(d.region_id);
      if (existing) {
        existing.median_price_cut_amount = d.value;
      }
    }

    for (const d of pctData) {
      const existing = combinedMap.get(d.region_id);
      if (existing) {
        existing.median_price_cut_percent = d.value;
      }
    }

    return Array.from(combinedMap.values()).sort((a, b) =>
      (b.share_with_price_cut || 0) - (a.share_with_price_cut || 0)
    );
  }

  // ============================================================================
  // New Construction (Combined Metrics)
  // ============================================================================

  async getMetroNewConstruction(date?: string): Promise<NewConstructionData[]> {
    const targetDate = date || await getLatestDateForMarketTable(this.supabase, 'zillow_new_construction_sales_count', 'Metro');

    const [salesCountData, salePriceData] = await Promise.all([
      queryMarketIndicator(this.supabase, 'zillow_new_construction_sales_count', ['Metro', 'US'], targetDate),
      queryMarketIndicator(this.supabase, 'zillow_new_construction_sale_price', ['Metro', 'US'], targetDate),
    ]);

    const { byZillowId, byCbsaCode } = await buildMetroMappings(this.supabase);

    // Combine the data by region_id
    const combinedMap = new Map<string, NewConstructionData>();

    for (const d of salesCountData) {
      const { metro, cbsaCode } = lookupMetro(d.region_id, byZillowId, byCbsaCode);
      combinedMap.set(d.region_id, {
        region_id: d.region_id,
        region_name: d.geography === 'US' ? 'United States' : (metro?.cbsa_name || 'Unknown'),
        cbsa_code: cbsaCode,
        state_abbrev: metro?.state || null,
        date: d.date,
        geography: d.geography,
        sales_count: d.value,
        median_sale_price: null,
        price_per_sqft: null,
      });
    }

    for (const d of salePriceData) {
      const existing = combinedMap.get(d.region_id);
      if (existing) {
        existing.median_sale_price = d.value;
        existing.price_per_sqft = (d as any).price_per_sqft || null;
      } else {
        const { metro, cbsaCode } = lookupMetro(d.region_id, byZillowId, byCbsaCode);
        combinedMap.set(d.region_id, {
          region_id: d.region_id,
          region_name: d.geography === 'US' ? 'United States' : (metro?.cbsa_name || 'Unknown'),
          cbsa_code: cbsaCode,
          state_abbrev: metro?.state || null,
          date: d.date,
          geography: d.geography,
          sales_count: null,
          median_sale_price: d.value,
          price_per_sqft: (d as any).price_per_sqft || null,
        });
      }
    }

    return Array.from(combinedMap.values()).sort((a, b) =>
      (b.sales_count || 0) - (a.sales_count || 0)
    );
  }

  // ============================================================================
  // Affordability
  // ============================================================================

  async getMetroAffordability(date?: string): Promise<AffordabilityData[]> {
    const targetDate = date || await getLatestDateForMarketTable(this.supabase, 'zillow_affordability', 'Metro');
    const data = await queryAffordability(this.supabase, ['Metro', 'US'], targetDate);

    if (!data.length) return [];

    const { byZillowId, byCbsaCode } = await buildMetroMappings(this.supabase);

    return data.map(d => {
      if (d.geography === 'US') {
        return {
          region_id: d.region_id,
          region_name: 'United States',
          date: d.date,
          geography: 'US',
          homeowner_income_needed: d.homeowner_income_needed,
          renter_income_needed: d.renter_income_needed,
          affordable_home_price: d.affordable_home_price,
          years_to_save: d.years_to_save,
          homeowner_affordability_percent: d.homeowner_affordability_percent,
          renter_affordability_percent: d.renter_affordability_percent,
          down_payment_percent: d.down_payment_percent,
          property_type: d.property_type,
        };
      }

      const { metro, cbsaCode } = lookupMetro(d.region_id, byZillowId, byCbsaCode);

      return {
        region_id: d.region_id,
        region_name: metro?.cbsa_name || 'Unknown',
        cbsa_code: cbsaCode,
        state_abbrev: metro?.state || null,
        date: d.date,
        geography: 'Metro',
        homeowner_income_needed: d.homeowner_income_needed,
        renter_income_needed: d.renter_income_needed,
        affordable_home_price: d.affordable_home_price,
        years_to_save: d.years_to_save,
        homeowner_affordability_percent: d.homeowner_affordability_percent,
        renter_affordability_percent: d.renter_affordability_percent,
        down_payment_percent: d.down_payment_percent,
        property_type: d.property_type,
      };
    }).sort((a, b) => (b.homeowner_income_needed || 0) - (a.homeowner_income_needed || 0));
  }
}
