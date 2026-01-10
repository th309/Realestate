import { Injectable, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.module';

export interface HomeValueData {
  region_id: string;
  region_name: string;
  state_abbrev?: string | null;
  state_name?: string | null;
  county_fips?: string | null;
  zip_code?: string | null;
  city?: string | null;
  county_name?: string | null;
  value: number;
  date: string;
  property_type: string;
  geography: string;
}

@Injectable()
export class ZillowService {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  private async getStateMappings(): Promise<Map<string, { abbrev: string; name: string }>> {
    const states = [
      'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN',
      'IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH',
      'NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT',
      'VT','VA','WA','WV','WI','WY','VI','PR'
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
    const targetDate = date || await this.getLatestDate('City');

    let query = this.supabase
      .from('geography_crosswalk')
      .select('cbsa_code, cbsa_name, zillow_metro_region_id, state_abbrev')
      .not('zillow_metro_region_id', 'is', null);

    if (stateFilter) {
      query = query.eq('state_abbrev', stateFilter);
    }

    const { data: crosswalk } = await query.limit(10000);

    const metroMap = new Map<string, { cbsa_code: string; cbsa_name: string; state: string }>();
    crosswalk?.forEach(row => {
      if (row.zillow_metro_region_id && !metroMap.has(String(row.zillow_metro_region_id))) {
        metroMap.set(String(row.zillow_metro_region_id), {
          cbsa_code: row.cbsa_code,
          cbsa_name: row.cbsa_name,
          state: row.state_abbrev
        });
      }
    });

    const metroIds = [...metroMap.keys()];
    if (metroIds.length === 0) return [];

    const { data: zillow, error } = await this.supabase
      .from('zillow_zhvi')
      .select('region_id, value, date, property_type, geography')
      .eq('geography', 'City')
      .eq('date', targetDate)
      .eq('property_type', 'sfrcondo')
      .eq('tier', '0.33_0.67')
      .in('region_id', metroIds)
      .limit(1000);

    if (error) throw new Error(error.message);
    if (!zillow) return [];

    return zillow.map(z => {
      const metro = metroMap.get(z.region_id);
      return {
        region_id: z.region_id,
        region_name: metro?.cbsa_name || 'Unknown',
        state_abbrev: metro?.state || null,
        value: z.value,
        date: z.date,
        property_type: z.property_type,
        geography: 'Metro',
      };
    }).sort((a, b) => b.value - a.value);
  }

  async getCountyHomeValues(date?: string, stateFilter?: string): Promise<HomeValueData[]> {
    const targetDate = date || await this.getLatestDate('City');

    let query = this.supabase
      .from('geography_crosswalk')
      .select('county_fips, county_name, zillow_county_region_id, state_abbrev, state_name')
      .not('zillow_county_region_id', 'is', null);

    if (stateFilter) {
      query = query.eq('state_abbrev', stateFilter);
    }

    const { data: crosswalk } = await query.limit(10000);

    const countyMap = new Map<string, { fips: string; name: string; state_abbrev: string; state_name: string }>();
    crosswalk?.forEach(row => {
      if (row.zillow_county_region_id && !countyMap.has(String(row.zillow_county_region_id))) {
        countyMap.set(String(row.zillow_county_region_id), {
          fips: row.county_fips,
          name: row.county_name,
          state_abbrev: row.state_abbrev,
          state_name: row.state_name
        });
      }
    });

    const countyIds = [...countyMap.keys()];
    if (countyIds.length === 0) return [];

    const { data: zillow, error } = await this.supabase
      .from('zillow_zhvi')
      .select('region_id, value, date, property_type, geography')
      .eq('date', targetDate)
      .eq('property_type', 'sfrcondo')
      .eq('tier', '0.33_0.67')
      .in('region_id', countyIds)
      .limit(5000);

    if (error) throw new Error(error.message);
    if (!zillow) return [];

    return zillow.map(z => {
      const county = countyMap.get(z.region_id);
      return {
        region_id: z.region_id,
        region_name: county?.name || 'Unknown',
        county_fips: county?.fips || null,
        state_abbrev: county?.state_abbrev || null,
        state_name: county?.state_name || null,
        value: z.value,
        date: z.date,
        property_type: z.property_type,
        geography: 'County',
      };
    }).sort((a, b) => b.value - a.value);
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
}
