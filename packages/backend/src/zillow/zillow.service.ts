import { Injectable, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.module';

export interface HomeValueData {
  region_id: string;
  region_name: string;
  state_abbrev?: string | null;
  state_name?: string | null;
  county_fips?: string | null;
  cbsa_code?: string | null;
  zip_code?: string | null;
  city?: string | null;
  county_name?: string | null;
  value: number;
  date: string;
  property_type: string;
  geography: string;
}

export interface ForecastData {
  region_id: string;
  region_name: string;
  cbsa_code?: string | null;
  zip_code?: string | null;
  state_abbrev?: string | null;
  forecast_1m: number | null;
  forecast_3m: number | null;
  forecast_12m: number | null;
  value: number;  // We'll use forecast_12m as the main value for map coloring
  date: string;
  geography: string;
}

@Injectable()
export class ZillowService {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) { }

  private async getStateMappings(): Promise<Map<string, { abbrev: string; name: string }>> {
    const states = [
      'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN',
      'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH',
      'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT',
      'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'VI', 'PR'
    ];

    const stateMap = new Map<string, { abbrev: string; name: string }>();

    for (const st of states) {
      const { data } = await this.supabase
        .from('geography_crosswalk')
        .select('state_abbrev, state_name, zillow_state_region_id')
        .eq('state_abbrev', st)
        .limit(1);

      if (data?.[0]?.zillow_state_region_id) {
        stateMap.set(
          String(data[0].zillow_state_region_id),
          { abbrev: data[0].state_abbrev, name: data[0].state_name }
        );
      }
    }

    return stateMap;
  }

  async getStateHomeValues(date?: string): Promise<HomeValueData[]> {
    const targetDate = date || await this.getLatestDate('State');

    const { data: zillow, error } = await this.supabase
      .from('zillow_zhvi')
      .select('region_id, value, date, property_type, geography')
      .eq('geography', 'State')
      .eq('date', targetDate)
      .eq('property_type', 'sfrcondo')
      .eq('tier', '0.33_0.67');

    if (error) throw new Error(error.message);
    if (!zillow) return [];

    const stateMap = await this.getStateMappings();

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

    // Get all metro data from zillow_zhvi
    const { data: zillow, error } = await this.supabase
      .from('zillow_zhvi')
      .select('region_id, value, date, property_type, geography')
      .eq('geography', 'Metro')
      .eq('date', targetDate)
      .eq('property_type', 'sfrcondo')
      .eq('tier', '0.33_0.67');

    if (error) throw new Error(error.message);
    if (!zillow) return [];

    // Build crosswalk maps for metro lookup with pagination
    // Map 1: zillow_metro_region_id -> first matching cbsa info
    // Map 2: cbsa_code -> cbsa info (for direct CBSA code matches)
    const zillowIdToMetro = new Map<string, { cbsa_code: string; cbsa_name: string; state: string }>();
    const cbsaCodeToMetro = new Map<string, { cbsa_code: string; cbsa_name: string; state: string }>();

    // Paginate through crosswalk to get all unique CBSAs
    let page = 0;
    const pageSize = 1000;

    while (true) {
      let query = this.supabase
        .from('geography_crosswalk')
        .select('cbsa_code, cbsa_name, zillow_metro_region_id, state_abbrev')
        .not('cbsa_code', 'is', null);

      if (stateFilter) {
        query = query.eq('state_abbrev', stateFilter);
      }

      const { data: crosswalk } = await query.range(page * pageSize, (page + 1) * pageSize - 1);

      if (!crosswalk || crosswalk.length === 0) break;

      crosswalk.forEach(row => {
        // Map by Zillow metro ID
        if (row.zillow_metro_region_id && !zillowIdToMetro.has(String(row.zillow_metro_region_id))) {
          zillowIdToMetro.set(String(row.zillow_metro_region_id), {
            cbsa_code: row.cbsa_code,
            cbsa_name: row.cbsa_name,
            state: row.state_abbrev
          });
        }
        // Map by CBSA code for direct lookups
        if (row.cbsa_code && !cbsaCodeToMetro.has(row.cbsa_code)) {
          cbsaCodeToMetro.set(row.cbsa_code, {
            cbsa_code: row.cbsa_code,
            cbsa_name: row.cbsa_name,
            state: row.state_abbrev
          });
        }
      });

      page++;
      if (crosswalk.length < pageSize) break;
    }

    return zillow.map(z => {
      // Check if region_id is a 5-digit CBSA code (Zillow uses both CBSA codes and their own IDs)
      const is5DigitCode = /^\d{5}$/.test(z.region_id);

      let metro;
      let cbsaCode = null;

      if (is5DigitCode) {
        // Try direct CBSA match first
        metro = cbsaCodeToMetro.get(z.region_id);
        if (metro) {
          cbsaCode = z.region_id;
        }
      }

      if (!metro) {
        // Try Zillow metro ID lookup
        metro = zillowIdToMetro.get(z.region_id);
        if (metro) {
          cbsaCode = metro.cbsa_code;
        }
      }

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

    // Build map keyed by FIPS code using pagination (Supabase has 1000 row default limit)
    const countyMap = new Map<string, { fips: string; name: string; state_abbrev: string; state_name: string }>();
    let page = 0;
    const pageSize = 1000;

    while (true) {
      let query = this.supabase
        .from('geography_crosswalk')
        .select('county_fips, county_name, state_abbrev, state_name')
        .not('county_fips', 'is', null);

      if (stateFilter) {
        query = query.eq('state_abbrev', stateFilter);
      }

      const { data: crosswalk } = await query.range(page * pageSize, (page + 1) * pageSize - 1);

      if (!crosswalk || crosswalk.length === 0) break;

      crosswalk.forEach(row => {
        if (row.county_fips && !countyMap.has(row.county_fips)) {
          countyMap.set(row.county_fips, {
            fips: row.county_fips,
            name: row.county_name,
            state_abbrev: row.state_abbrev,
            state_name: row.state_name
          });
        }
      });

      page++;
      if (crosswalk.length < pageSize) break;
    }

    const fipsCodes = [...countyMap.keys()];
    if (fipsCodes.length === 0) return [];

    // Query zillow_zhvi using FIPS codes - also paginate for large result sets
    const results: HomeValueData[] = [];

    // Split fipsCodes into chunks to avoid query size limits
    const chunkSize = 500;
    for (let i = 0; i < fipsCodes.length; i += chunkSize) {
      const chunk = fipsCodes.slice(i, i + chunkSize);

      const { data: zillow, error } = await this.supabase
        .from('zillow_zhvi')
        .select('region_id, value, date, property_type, geography')
        .eq('geography', 'County')
        .eq('date', targetDate)
        .eq('property_type', 'sfrcondo')
        .eq('tier', '0.33_0.67')
        .in('region_id', chunk);

      if (error) throw new Error(error.message);

      zillow?.forEach(z => {
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

    let query = this.supabase
      .from('geography_crosswalk')
      .select('zip_code, zip_default_city, county_name, state_abbrev, state_name')
      .eq('state_abbrev', stateFilter);

    if (countyFilter) {
      query = query.eq('county_fips', countyFilter);
    }

    const { data: crosswalk } = await query.limit(2000);

    if (!crosswalk || crosswalk.length === 0) return [];

    const zipMap = new Map<string, { city: string; county: string; state_abbrev: string; state_name: string }>();
    crosswalk.forEach(row => {
      zipMap.set(row.zip_code, {
        city: row.zip_default_city,
        county: row.county_name,
        state_abbrev: row.state_abbrev,
        state_name: row.state_name
      });
    });

    const zipCodes = [...zipMap.keys()];

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
    const { data } = await this.supabase
      .from('zillow_zhvi')
      .select('date')
      .eq('geography', geography)
      .order('date', { ascending: false })
      .limit(1);

    return data?.[0]?.date || '2025-10-31';
  }

  async getAvailableDates(geography: string): Promise<string[]> {
    const { data } = await this.supabase
      .from('zillow_zhvi')
      .select('date')
      .eq('geography', geography)
      .order('date', { ascending: false })
      .limit(100);

    const dates = data?.map(d => d.date as string) || [];
    const uniqueDates = [...new Set(dates)];
    return uniqueDates;
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
  // ZHVF (Zillow Home Value Forecast) Methods
  // ============================================================================

  async getMetroForecast(horizon: string = '12m'): Promise<ForecastData[]> {
    // Get all metro forecasts
    const { data: forecasts, error } = await this.supabase
      .from('zillow_zhvf')
      .select('region_id, date, forecast_1m, forecast_3m, forecast_12m, geography')
      .in('geography', ['Metro', 'US'])
      .order('date', { ascending: false });

    if (error) throw new Error(error.message);
    if (!forecasts) return [];

    // Build crosswalk map for CBSA lookup
    const cbsaMap = new Map<string, { cbsa_code: string; cbsa_name: string; state: string }>();

    let page = 0;
    const pageSize = 1000;

    while (true) {
      const { data: crosswalk } = await this.supabase
        .from('geography_crosswalk')
        .select('cbsa_code, cbsa_name, zillow_metro_region_id, state_abbrev')
        .not('cbsa_code', 'is', null)
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (!crosswalk || crosswalk.length === 0) break;

      crosswalk.forEach(row => {
        // Map by Zillow metro region ID
        if (row.zillow_metro_region_id && !cbsaMap.has(String(row.zillow_metro_region_id))) {
          cbsaMap.set(String(row.zillow_metro_region_id), {
            cbsa_code: row.cbsa_code,
            cbsa_name: row.cbsa_name,
            state: row.state_abbrev
          });
        }
        // Also map by CBSA code directly (some region_ids are CBSA codes)
        if (row.cbsa_code && !cbsaMap.has(row.cbsa_code)) {
          cbsaMap.set(row.cbsa_code, {
            cbsa_code: row.cbsa_code,
            cbsa_name: row.cbsa_name,
            state: row.state_abbrev
          });
        }
      });

      page++;
      if (crosswalk.length < pageSize) break;
    }

    // Helper to get forecast value based on horizon
    const getForecastValue = (f: any): number => {
      switch (horizon) {
        case '1m': return f.forecast_1m || 0;
        case '3m': return f.forecast_3m || 0;
        case '12m':
        default: return f.forecast_12m || 0;
      }
    };

    return forecasts.map(f => {
      const metro = cbsaMap.get(f.region_id);
      const is5DigitCode = /^\d{5}$/.test(f.region_id);

      return {
        region_id: f.region_id,
        region_name: f.geography === 'US' ? 'United States' : (metro?.cbsa_name || 'Unknown'),
        cbsa_code: metro?.cbsa_code || (is5DigitCode ? f.region_id : null),
        state_abbrev: metro?.state || null,
        forecast_1m: f.forecast_1m,
        forecast_3m: f.forecast_3m,
        forecast_12m: f.forecast_12m,
        value: getForecastValue(f),  // Use selected horizon as main value
        date: f.date,
        geography: f.geography,
      };
    }).sort((a, b) => getForecastValue(b) - getForecastValue(a));
  }

  async getZipForecast(stateFilter?: string, horizon: string = '12m'): Promise<ForecastData[]> {
    // Get ZIP forecasts
    const { data: forecasts, error } = await this.supabase
      .from('zillow_zhvf')
      .select('region_id, date, forecast_1m, forecast_3m, forecast_12m, geography')
      .eq('geography', 'Zip')
      .order('date', { ascending: false });

    if (error) throw new Error(error.message);
    if (!forecasts) return [];

    // Build ZIP lookup map from crosswalk
    const zipMap = new Map<string, { city: string; state: string }>();

    let query = this.supabase
      .from('geography_crosswalk')
      .select('zip_code, zip_default_city, state_abbrev')
      .not('zip_code', 'is', null);

    if (stateFilter) {
      query = query.eq('state_abbrev', stateFilter);
    }

    const { data: crosswalk } = await query.limit(30000);

    crosswalk?.forEach(row => {
      if (row.zip_code) {
        zipMap.set(row.zip_code, {
          city: row.zip_default_city,
          state: row.state_abbrev
        });
      }
    });

    // Filter forecasts to only those in our ZIP map (if state filter applied)
    let filteredForecasts = forecasts;
    if (stateFilter) {
      const validZips = new Set(zipMap.keys());
      filteredForecasts = forecasts.filter(f => validZips.has(f.region_id));
    }

    // Helper to get forecast value based on horizon
    const getForecastValue = (f: any): number => {
      switch (horizon) {
        case '1m': return f.forecast_1m || 0;
        case '3m': return f.forecast_3m || 0;
        case '12m':
        default: return f.forecast_12m || 0;
      }
    };

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
        value: getForecastValue(f),
        date: f.date,
        geography: 'Zip',
      };
    }).sort((a, b) => getForecastValue(b) - getForecastValue(a));
  }

  // ============================================================================
  // ZORI (Rent Index) Methods
  // ============================================================================

  private mapRentPropertyType(type: string): string {
    switch (type) {
      case 'sfr': return 'SFR';
      case 'mfr': return 'Multifamily';
      case 'all':
      default: return 'All Homes Plus Multifamily';
    }
  }

  async getMetroRent(date?: string, propertyType: string = 'all'): Promise<HomeValueData[]> {
    // For Rent, we check the latest date if not provided
    // We can reuse getLatestDate but specify 'zillow_zori' table logic if needed,
    // but getLatestDate currently queries 'zillow_zhvi'.
    // Let's create a specific fetch or just reuse the logic inline.

    const dbPropertyType = this.mapRentPropertyType(propertyType);

    // Determine latest date if not provided
    let targetDate = date;
    if (!targetDate) {
      const { data } = await this.supabase
        .from('zillow_zori')
        .select('date')
        .eq('geography', 'Metro')
        .order('date', { ascending: false })
        .limit(1);
      targetDate = data?.[0]?.date || '2025-10-31';
    }

    // Get all metro data from zillow_zori
    // Note: handling 'US' as well since it's usually requested alongside Metros
    const { data: zillow, error } = await this.supabase
      .from('zillow_zori')
      .select('region_id, value, date, property_type, geography')
      .in('geography', ['Metro', 'US'])
      .eq('date', targetDate)
      .eq('property_type', dbPropertyType);

    if (error) throw new Error(error.message);
    if (!zillow) return [];

    // Build crosswalk maps
    const zillowIdToMetro = new Map<string, { cbsa_code: string; cbsa_name: string; state: string }>();
    const cbsaCodeToMetro = new Map<string, { cbsa_code: string; cbsa_name: string; state: string }>();

    let page = 0;
    const pageSize = 1000;

    while (true) {
      const { data: crosswalk } = await this.supabase
        .from('geography_crosswalk')
        .select('cbsa_code, cbsa_name, zillow_metro_region_id, state_abbrev')
        .not('cbsa_code', 'is', null)
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (!crosswalk || crosswalk.length === 0) break;

      crosswalk.forEach(row => {
        if (row.zillow_metro_region_id && !zillowIdToMetro.has(String(row.zillow_metro_region_id))) {
          zillowIdToMetro.set(String(row.zillow_metro_region_id), {
            cbsa_code: row.cbsa_code,
            cbsa_name: row.cbsa_name,
            state: row.state_abbrev
          });
        }
        if (row.cbsa_code && !cbsaCodeToMetro.has(row.cbsa_code)) {
          cbsaCodeToMetro.set(row.cbsa_code, {
            cbsa_code: row.cbsa_code,
            cbsa_name: row.cbsa_name,
            state: row.state_abbrev
          });
        }
      });
      page++;
      if (crosswalk.length < pageSize) break;
    }

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

      const is5DigitCode = /^\d{5}$/.test(z.region_id);
      let metro;
      let cbsaCode = null;

      if (is5DigitCode) {
        metro = cbsaCodeToMetro.get(z.region_id);
        if (metro) cbsaCode = z.region_id;
      }
      if (!metro) {
        metro = zillowIdToMetro.get(z.region_id);
        if (metro) cbsaCode = metro.cbsa_code;
      }

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
    const dbPropertyType = this.mapRentPropertyType(propertyType);

    let targetDate = date;
    if (!targetDate) {
      const { data } = await this.supabase
        .from('zillow_zori')
        .select('date')
        .eq('geography', 'County')
        .order('date', { ascending: false })
        .limit(1);
      targetDate = data?.[0]?.date || '2025-10-31';
    }

    // Build map keyed by FIPS code
    const countyMap = new Map<string, { fips: string; name: string; state_abbrev: string; state_name: string }>();
    let page = 0;
    const pageSize = 1000;

    while (true) {
      let query = this.supabase
        .from('geography_crosswalk')
        .select('county_fips, county_name, state_abbrev, state_name')
        .not('county_fips', 'is', null);

      if (stateFilter) {
        query = query.eq('state_abbrev', stateFilter);
      }

      const { data: crosswalk } = await query.range(page * pageSize, (page + 1) * pageSize - 1);

      if (!crosswalk || crosswalk.length === 0) break;

      crosswalk.forEach(row => {
        if (row.county_fips && !countyMap.has(row.county_fips)) {
          countyMap.set(row.county_fips, {
            fips: row.county_fips,
            name: row.county_name,
            state_abbrev: row.state_abbrev,
            state_name: row.state_name
          });
        }
      });
      page++;
      if (crosswalk.length < pageSize) break;
    }

    const fipsCodes = [...countyMap.keys()];
    if (fipsCodes.length === 0) return [];

    const results: HomeValueData[] = [];
    const chunkSize = 500;
    for (let i = 0; i < fipsCodes.length; i += chunkSize) {
      const chunk = fipsCodes.slice(i, i + chunkSize);

      const { data: zillow, error } = await this.supabase
        .from('zillow_zori')
        .select('region_id, value, date, property_type, geography')
        .eq('geography', 'County')
        .eq('date', targetDate)
        .eq('property_type', dbPropertyType)
        .in('region_id', chunk);

      if (error) throw new Error(error.message);

      zillow?.forEach(z => {
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
    const dbPropertyType = this.mapRentPropertyType(propertyType);

    let targetDate = date;
    if (!targetDate) {
      const { data } = await this.supabase
        .from('zillow_zori')
        .select('date')
        .eq('geography', 'Zip')
        .order('date', { ascending: false })
        .limit(1);
      targetDate = data?.[0]?.date || '2025-10-31';
    }

    const { data: crosswalk } = await this.supabase
      .from('geography_crosswalk')
      .select('zip_code, zip_default_city, county_name, state_abbrev, state_name')
      .eq('state_abbrev', stateFilter)
      .limit(3000);

    if (!crosswalk || crosswalk.length === 0) return [];

    const zipMap = new Map<string, { city: string; county: string; state_abbrev: string; state_name: string }>();
    crosswalk.forEach(row => {
      zipMap.set(row.zip_code, {
        city: row.zip_default_city,
        county: row.county_name,
        state_abbrev: row.state_abbrev,
        state_name: row.state_name
      });
    });

    const zipCodes = [...zipMap.keys()];

    const { data: zillow, error } = await this.supabase
      .from('zillow_zori')
      .select('region_id, value, date, property_type, geography')
      .eq('date', targetDate)
      .eq('property_type', dbPropertyType)
      .in('region_id', zipCodes)
      .limit(3000);

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
}
