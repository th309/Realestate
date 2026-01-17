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
  getLatestDate,
  getLatestDateForTable,
  getLatestDateForMarketTable,
  mapRentPropertyType,
  getForecastValue,
  queryZhvi,
  queryZori,
  queryZordi,
  queryZhvf,
  queryMarketIndicator,
  queryMarketIndicatorLatest,
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
    // Use cached latest date if not provided
    const targetDate = date || await getLatestDate(this.supabase, 'metro', 'zhvi');

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
    // Use cached latest date if not provided
    const targetDate = date || await getLatestDate(this.supabase, 'county', 'zhvi');

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

    // Use cached latest date if not provided
    const targetDate = date || await getLatestDate(this.supabase, 'zip', 'zhvi');

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

    // Use cached latest date
    const targetDate = await getLatestDate(this.supabase, 'city', 'zhvi');
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
  // ZHVF (Forecast) Methods - Query from zillow_metro and zillow_zip tables
  // ============================================================================

  async getMetroForecast(horizon: string = '12m'): Promise<ForecastData[]> {
    // Use cached latest date for forecast data
    const latestDate = await getLatestDate(this.supabase, 'metro', 'zhvf_12m');
    if (!latestDate) return [];

    // Query all forecast metrics for that date
    // Need to paginate because there are ~2685 records (895 metros × 3 horizons)
    // and Supabase has a default 1000 row limit
    const allForecasts: any[] = [];
    const pageSize = 1000;
    let page = 0;

    while (true) {
      const { data: pageData, error } = await this.supabase
        .from('zillow_metro')
        .select('region_id, region_name, cbsa_code, state_code, metric_name, value, period_date')
        .in('metric_name', ['zhvf_1m', 'zhvf_3m', 'zhvf_12m'])
        .eq('period_date', latestDate)
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (error) {
        console.error('Error fetching metro forecasts:', error.message);
        break;
      }

      if (!pageData || pageData.length === 0) break;

      allForecasts.push(...pageData);

      if (pageData.length < pageSize) break; // Last page
      page++;
    }

    if (allForecasts.length === 0) return [];
    const forecasts = allForecasts;

    // Group by region_id to combine forecast metrics
    const byRegion = new Map<number, any>();
    for (const f of forecasts) {
      if (!byRegion.has(f.region_id)) {
        byRegion.set(f.region_id, {
          region_id: String(f.region_id),
          region_name: f.region_name,
          cbsa_code: f.cbsa_code,
          state_abbrev: f.state_code,
          forecast_1m: null,
          forecast_3m: null,
          forecast_12m: null,
          date: f.period_date,
          geography: 'Metro',
        });
      }
      const entry = byRegion.get(f.region_id);
      if (f.metric_name === 'zhvf_1m') entry.forecast_1m = f.value;
      if (f.metric_name === 'zhvf_3m') entry.forecast_3m = f.value;
      if (f.metric_name === 'zhvf_12m') entry.forecast_12m = f.value;
    }

    return [...byRegion.values()]
      .map(f => ({ ...f, value: getForecastValue(f, horizon) }))
      .sort((a, b) => getForecastValue(b, horizon) - getForecastValue(a, horizon));
  }

  async getZipForecast(stateFilter?: string, horizon: string = '12m'): Promise<ForecastData[]> {
    // Use cached latest date for forecast data
    const latestDate = await getLatestDate(this.supabase, 'zip', 'zhvf_12m');
    if (!latestDate) return [];

    // Query all forecast metrics for that date with pagination
    const allForecasts: any[] = [];
    const pageSize = 1000;
    let page = 0;

    while (true) {
      let query = this.supabase
        .from('zillow_zip')
        .select('region_id, region_name, state_code, metric_name, value, period_date')
        .in('metric_name', ['zhvf_1m', 'zhvf_3m', 'zhvf_12m'])
        .eq('period_date', latestDate)
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (stateFilter) {
        query = query.eq('state_code', stateFilter.toUpperCase());
      }

      const { data: pageData, error } = await query;

      if (error) {
        console.error('Error fetching zip forecasts:', error.message);
        break;
      }

      if (!pageData || pageData.length === 0) break;

      allForecasts.push(...pageData);

      if (pageData.length < pageSize) break; // Last page
      page++;
    }

    if (allForecasts.length === 0) return [];
    const forecasts = allForecasts;

    // Group by region_id to combine forecast metrics
    const byRegion = new Map<number, any>();
    for (const f of forecasts) {
      if (!byRegion.has(f.region_id)) {
        byRegion.set(f.region_id, {
          region_id: String(f.region_id),
          region_name: f.region_name,
          zip_code: f.region_name, // region_name IS the ZIP code
          state_abbrev: f.state_code,
          forecast_1m: null,
          forecast_3m: null,
          forecast_12m: null,
          date: f.period_date,
          geography: 'Zip',
        });
      }
      const entry = byRegion.get(f.region_id);
      if (f.metric_name === 'zhvf_1m') entry.forecast_1m = f.value;
      if (f.metric_name === 'zhvf_3m') entry.forecast_3m = f.value;
      if (f.metric_name === 'zhvf_12m') entry.forecast_12m = f.value;
    }

    return [...byRegion.values()]
      .map(f => ({ ...f, value: getForecastValue(f, horizon) }))
      .sort((a, b) => getForecastValue(b, horizon) - getForecastValue(a, horizon));
  }

  // ============================================================================
  // ZORI (Rent Index) Methods
  // ============================================================================

  async getMetroRent(date?: string, propertyType: string = 'all'): Promise<HomeValueData[]> {
    const targetDate = date || await getLatestDateForTable(this.supabase, 'zillow_zori', 'Metro');

    // Pass propertyType directly - queryZori handles mapping to metric name
    const zillow = await queryZori(this.supabase, ['Metro', 'US'], targetDate, propertyType);
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
    const targetDate = date || await getLatestDateForTable(this.supabase, 'zillow_zori', 'County');

    const countyMap = await buildCountyMappings(this.supabase, stateFilter);
    const fipsCodes = [...countyMap.keys()];
    if (fipsCodes.length === 0) return [];

    const results: HomeValueData[] = [];
    const chunkSize = 500;

    for (let i = 0; i < fipsCodes.length; i += chunkSize) {
      const chunk = fipsCodes.slice(i, i + chunkSize);
      // Pass propertyType directly - queryZori handles mapping to metric name
      const zillow = await queryZori(this.supabase, 'County', targetDate, propertyType, chunk);

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
    // OPTIMIZATION: Run date lookup and ZIP mappings in parallel
    const [targetDate, zipMap] = await Promise.all([
      date ? Promise.resolve(date) : getLatestDateForTable(this.supabase, 'zillow_zori', 'Zip'),
      buildZipMappings(this.supabase, stateFilter)
    ]);

    const zipCodes = [...zipMap.keys()];
    if (zipCodes.length === 0) return [];

    // Pass propertyType directly - queryZori handles mapping to metric name
    const zillow = await queryZori(this.supabase, 'Zip', targetDate, propertyType, zipCodes);

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
    // ZORDI data is in zillow_metro with metric_name = 'zordi', 'zordi_sfr', 'zordi_mfr'
    const targetDate = date || await getLatestDateForTable(this.supabase, 'zillow_zordi', 'Metro');

    // Pass propertyType directly - queryZordi handles mapping to metric name
    const zillow = await queryZordi(this.supabase, ['Metro', 'US'], targetDate, propertyType);
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
    // ZORDI data is in zillow_metro (metro only for now)
    // OPTIMIZATION: Run date lookup and ZIP mappings in parallel
    const [targetDate, zipMap] = await Promise.all([
      date ? Promise.resolve(date) : getLatestDateForTable(this.supabase, 'zillow_zordi', 'Zip'),
      buildZipMappings(this.supabase, stateFilter)
    ]);

    const zipCodes = [...zipMap.keys()];
    if (zipCodes.length === 0) return [];

    // Pass propertyType directly - queryZordi handles mapping to metric name
    const zillow = await queryZordi(this.supabase, 'Zip', targetDate, propertyType, zipCodes);

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
   * When no date is provided, returns the latest available data per region
   */
  async getMetroMarketIndicator(
    table: MarketIndicatorTable,
    date?: string,
    propertyType: string = 'sfrcondo'
  ): Promise<MarketIndicatorData[]> {
    // Use latest-per-region when no specific date requested
    const data = date
      ? await queryMarketIndicator(this.supabase, table, ['Metro', 'US'], date, propertyType)
      : await queryMarketIndicatorLatest(this.supabase, table, ['Metro', 'US']);

    if (!data.length) return [];

    const { byZillowId, byCbsaCode } = await buildMetroMappings(this.supabase);

    return data.map((d: any) => {
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

      // Use data from query if available, fallback to crosswalk lookup
      const { metro, cbsaCode } = lookupMetro(d.region_id, byZillowId, byCbsaCode);

      return {
        region_id: d.region_id,
        region_name: d.region_name || metro?.cbsa_name || 'Unknown',
        cbsa_code: d.cbsa_code || cbsaCode,
        state_abbrev: d.state_code || metro?.state || null,
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
  // New Construction (Combined Metrics from zillow_metro)
  // ============================================================================

  async getMetroNewConstruction(date?: string): Promise<NewConstructionData[]> {
    // Get latest date for new construction metrics
    const targetDate = date || await getLatestDate(this.supabase, 'metro', 'new_con_sales' as any);

    // Query all new construction metrics from zillow_metro in one call
    const newConMetrics = ['new_con_sales', 'new_con_median_price', 'new_con_median_price_per_sqft'];

    const { data, error } = await this.supabase
      .from('zillow_metro')
      .select('region_id, region_name, cbsa_code, state_code, period_date, metric_name, value')
      .in('metric_name', newConMetrics)
      .eq('period_date', targetDate)
      .limit(5000);

    if (error) {
      console.error('Error fetching new construction data:', error.message);
      return [];
    }

    if (!data || data.length === 0) return [];

    // Group by region_id to combine metrics
    const combinedMap = new Map<string, NewConstructionData>();

    for (const row of data) {
      const regionId = String(row.region_id);

      if (!combinedMap.has(regionId)) {
        combinedMap.set(regionId, {
          region_id: regionId,
          region_name: row.region_name || 'Unknown',
          cbsa_code: row.cbsa_code || null,
          state_abbrev: row.state_code || null,
          date: row.period_date,
          geography: 'Metro',
          sales_count: null,
          median_sale_price: null,
          price_per_sqft: null,
        });
      }

      const entry = combinedMap.get(regionId)!;

      // Map metric names to fields
      if (row.metric_name === 'new_con_sales' || row.metric_name === 'new_con_sales_count') {
        entry.sales_count = row.value;
      }
      if (row.metric_name === 'new_con_median_price') {
        entry.median_sale_price = row.value;
      }
      if (row.metric_name === 'new_con_median_price_per_sqft') {
        entry.price_per_sqft = row.value;
      }
    }

    // Filter out entries with no cbsa_code (can't be displayed on map)
    return Array.from(combinedMap.values())
      .filter(d => d.cbsa_code)
      .sort((a, b) => (b.sales_count || 0) - (a.sales_count || 0));
  }

  // ============================================================================
  // Affordability
  // ============================================================================

  async getMetroAffordability(date?: string): Promise<AffordabilityData[]> {
    // Use cached latest date for affordability metrics
    const targetDate = date || await getLatestDate(this.supabase, 'metro', 'homeowner_income');
    if (!targetDate) return [];

    const data = await queryAffordability(this.supabase, ['Metro'], targetDate);

    if (!data.length) return [];

    // Use cbsa_code directly from zillow_metro data (same approach as getMetroHomeValues)
    // Filter out records without cbsa_code - they can't be displayed on the map
    return data
      .filter(d => d.cbsa_code) // Skip records without cbsa_code
      .map(d => ({
        region_id: d.region_id,
        region_name: d.region_name || 'Unknown',
        cbsa_code: d.cbsa_code,
        state_abbrev: d.state_code || null,
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
      }))
      .sort((a, b) => (b.homeowner_income_needed || 0) - (a.homeowner_income_needed || 0));
  }
}
