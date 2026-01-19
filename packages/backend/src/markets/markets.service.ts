import { Injectable, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';

@Injectable()
export class MarketsService {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  async getMarkets(limit = 100, offset = 0) {
    const { data, error, count } = await this.supabase
      .from('markets')
      .select('*', { count: 'exact' })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return { data, count };
  }

  async getMarketById(id: string) {
    const { data, error } = await this.supabase
      .from('markets')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  }

  async getStates() {
    // Use geographies table
    const { data, error } = await this.supabase
      .from('geographies')
      .select('geography_id, name, state_code, population')
      .eq('geography_type', 'state')
      .order('name');

    if (error) throw error;
    return (data || []).map((row) => ({
      geoid: row.geography_id,
      name: row.name,
      state_abbreviation: row.state_code,
      population: row.population,
    }));
  }

  async getCountiesByState(stateCode: string) {
    // Use geographies table - filter by state_code
    const { data, error } = await this.supabase
      .from('geographies')
      .select('geography_id, name, state_code, population, fips_code')
      .eq('geography_type', 'county')
      .eq('state_code', stateCode)
      .order('name');

    if (error) throw error;
    return (data || []).map((row) => ({
      geoid: row.fips_code || row.geography_id,
      name: row.name,
      state_abbreviation: row.state_code,
      population: row.population,
    }));
  }

  async getMetrosByState(stateCode: string) {
    // Get metros that have counties in the given state
    const { data, error } = await this.supabase
      .from('geographies')
      .select('cbsa_code, cbsa_name, zillow_metro_region_id')
      .eq('geography_type', 'county')
      .eq('state_code', stateCode)
      .not('cbsa_code', 'is', null);

    if (error) throw error;

    // Dedupe metros
    const metroMap = new Map<string, any>();
    for (const row of data || []) {
      if (row.cbsa_code && !metroMap.has(row.cbsa_code)) {
        metroMap.set(row.cbsa_code, {
          cbsa_code: row.cbsa_code,
          name: row.cbsa_name,
          zillow_region_id: row.zillow_metro_region_id,
        });
      }
    }

    return Array.from(metroMap.values()).sort((a, b) =>
      a.name?.localeCompare(b.name),
    );
  }

  async getMarketStats() {
    // Use geographies table for counts
    const { count: totalMarkets } = await this.supabase
      .from('markets')
      .select('*', { count: 'exact', head: true });

    const { count: totalStates } = await this.supabase
      .from('geographies')
      .select('*', { count: 'exact', head: true })
      .eq('geography_type', 'state');

    const { count: totalCounties } = await this.supabase
      .from('geographies')
      .select('*', { count: 'exact', head: true })
      .eq('geography_type', 'county');

    const { count: totalMetros } = await this.supabase
      .from('geographies')
      .select('*', { count: 'exact', head: true })
      .eq('geography_type', 'metro');

    const { count: totalZips } = await this.supabase
      .from('geographies')
      .select('*', { count: 'exact', head: true })
      .eq('geography_type', 'zip');

    return {
      totalMarkets,
      totalStates,
      totalCounties,
      totalMetros,
      totalZips,
    };
  }

  async getStateHomeValues() {
    try {
      // Use zillow_state table
      const { data: zhviData, error: zhviError } = await this.supabase
        .from('zillow_state')
        .select('region_id, region_name, value, period_date')
        .eq('metric_name', 'zhvi')
        .order('period_date', { ascending: false });

      if (zhviError) {
        console.error('Error fetching ZHVI data:', zhviError);
        throw zhviError;
      }

      // Build result - only use most recent value per state
      const result: Record<string, number> = {};
      const seenStates = new Set<number>();

      for (const record of zhviData || []) {
        if (seenStates.has(record.region_id)) continue;
        seenStates.add(record.region_id);

        if (record.region_name && record.value) {
          result[record.region_name] = Math.round(Number(record.value));
        }
      }

      return result;
    } catch (error) {
      console.error('getStateHomeValues error:', error);
      throw error;
    }
  }

  async getMetroHomeValues() {
    try {
      // Use zillow_metro table
      const { data: zhviData, error: zhviError } = await this.supabase
        .from('zillow_metro')
        .select('region_id, region_name, value, period_date')
        .eq('metric_name', 'zhvi')
        .order('period_date', { ascending: false });

      if (zhviError) {
        console.error('Error fetching Metro ZHVI data:', zhviError);
        throw zhviError;
      }

      // Build result - only use most recent value per metro
      const result: Record<string, number> = {};
      const seenMetros = new Set<number>();

      for (const record of zhviData || []) {
        if (seenMetros.has(record.region_id)) continue;
        seenMetros.add(record.region_id);

        if (record.value) {
          result[String(record.region_id)] = Math.round(Number(record.value));
        }
      }

      return result;
    } catch (error) {
      console.error('getMetroHomeValues error:', error);
      throw error;
    }
  }

  async getCountyHomeValues() {
    try {
      // Use zillow_county table
      const { data: zhviData, error: zhviError } = await this.supabase
        .from('zillow_county')
        .select('region_id, region_name, value, period_date')
        .eq('metric_name', 'zhvi')
        .order('period_date', { ascending: false });

      if (zhviError) {
        console.error('Error fetching County ZHVI data:', zhviError);
        throw zhviError;
      }

      // Build result - only use most recent value per county
      const result: Record<string, number> = {};
      const seenCounties = new Set<number>();

      for (const record of zhviData || []) {
        if (seenCounties.has(record.region_id)) continue;
        seenCounties.add(record.region_id);

        if (record.value) {
          result[String(record.region_id)] = Math.round(Number(record.value));
        }
      }

      return result;
    } catch (error) {
      console.error('getCountyHomeValues error:', error);
      throw error;
    }
  }

  async getZipHomeValues() {
    try {
      // Use zillow_zip table
      const { data: zhviData, error: zhviError } = await this.supabase
        .from('zillow_zip')
        .select('region_id, region_name, value, period_date')
        .eq('metric_name', 'zhvi')
        .order('period_date', { ascending: false });

      if (zhviError) {
        console.error('Error fetching Zip ZHVI data:', zhviError);
        throw zhviError;
      }

      // Build result - only use most recent value per ZIP
      const result: Record<string, number> = {};
      const seenZips = new Set<number>();

      for (const record of zhviData || []) {
        if (seenZips.has(record.region_id)) continue;
        seenZips.add(record.region_id);

        if (record.value) {
          result[String(record.region_id)] = Math.round(Number(record.value));
        }
      }

      return result;
    } catch (error) {
      console.error('getZipHomeValues error:', error);
      throw error;
    }
  }

  // Get home values with names included
  async getStateHomeValuesWithNames() {
    const { data, error } = await this.supabase
      .from('zillow_state')
      .select('region_id, region_name, state_code, value, period_date')
      .eq('metric_name', 'zhvi')
      .order('period_date', { ascending: false });

    if (error) throw error;

    // Dedupe to most recent per state
    const stateMap = new Map<number, any>();
    for (const row of data || []) {
      if (!stateMap.has(row.region_id)) {
        stateMap.set(row.region_id, {
          regionId: row.region_id,
          name: row.region_name,
          stateCode: row.state_code,
          value: row.value ? Math.round(Number(row.value)) : null,
          date: row.period_date,
        });
      }
    }

    return Array.from(stateMap.values());
  }

  async getMetroHomeValuesWithNames() {
    const { data, error } = await this.supabase
      .from('zillow_metro')
      .select('region_id, region_name, cbsa_code, value, period_date')
      .eq('metric_name', 'zhvi')
      .order('period_date', { ascending: false });

    if (error) throw error;

    // Dedupe to most recent per metro
    const metroMap = new Map<number, any>();
    for (const row of data || []) {
      if (!metroMap.has(row.region_id)) {
        metroMap.set(row.region_id, {
          regionId: row.region_id,
          name: row.region_name,
          cbsaCode: row.cbsa_code,
          value: row.value ? Math.round(Number(row.value)) : null,
          date: row.period_date,
        });
      }
    }

    return Array.from(metroMap.values());
  }

  async searchMetros(query: string, limit = 10) {
    // Search metros by name using ilike for case-insensitive partial match
    const { data, error } = await this.supabase
      .from('zillow_metro')
      .select('region_id, region_name')
      .ilike('region_name', `%${query}%`)
      .order('region_name')
      .limit(limit * 3); // Fetch more to account for duplicates

    if (error) throw error;

    // Dedupe metros by region_id
    const metroMap = new Map<number, { regionId: number; name: string }>();
    for (const row of data || []) {
      if (row.region_name && !metroMap.has(row.region_id)) {
        metroMap.set(row.region_id, {
          regionId: row.region_id,
          name: row.region_name,
        });
      }
    }

    return Array.from(metroMap.values()).slice(0, limit);
  }

  // Get all metros for client-side filtering (fast search)
  // Uses realtor_metro which has metros we actually have data for
  // Returns deduped list sorted by name - used by frontend for instant search
  async getAllMetros() {
    const { data, error } = await this.supabase
      .from('realtor_metro')
      .select('cbsa_code, cbsa_title')
      .order('cbsa_title');

    if (error) throw error;

    // Dedupe by cbsa_code, filter out nulls and "United States"
    const metroMap = new Map<string, { regionId: number; name: string }>();
    for (const row of data || []) {
      if (
        row.cbsa_title &&
        row.cbsa_code &&
        !metroMap.has(row.cbsa_code) &&
        !row.cbsa_title.toLowerCase().includes('united states')
      ) {
        metroMap.set(row.cbsa_code, {
          regionId: parseInt(row.cbsa_code, 10) || 0,
          name: row.cbsa_title,
        });
      }
    }

    return Array.from(metroMap.values());
  }

  // Get all counties for client-side filtering (fast search)
  // Uses realtor_county which has counties we actually have data for
  async getAllCounties() {
    const { data, error } = await this.supabase
      .from('realtor_county')
      .select('county_fips, county_name, state_id')
      .order('county_name');

    if (error) throw error;

    // Dedupe by county_fips
    const countyMap = new Map<
      string,
      { fips: string; name: string; state: string }
    >();
    for (const row of data || []) {
      if (row.county_name && row.county_fips && !countyMap.has(row.county_fips)) {
        countyMap.set(row.county_fips, {
          fips: row.county_fips,
          name: row.county_name,
          state: row.state_id || '',
        });
      }
    }

    return Array.from(countyMap.values());
  }

  // Get all ZIP codes for client-side filtering (fast search)
  // Uses realtor_zip which has ZIPs we actually have data for
  async getAllZips() {
    const { data, error } = await this.supabase
      .from('realtor_zip')
      .select('postal_code, zip_name')
      .order('postal_code');

    if (error) throw error;

    // Dedupe by postal_code
    const zipMap = new Map<string, { code: string; name: string }>();
    for (const row of data || []) {
      if (row.postal_code && !zipMap.has(row.postal_code)) {
        zipMap.set(row.postal_code, {
          code: row.postal_code,
          name: row.zip_name || row.postal_code,
        });
      }
    }

    return Array.from(zipMap.values());
  }

  // Get all cities for client-side filtering (fast search)
  // Uses zillow_city which has cities we have data for
  async getAllCities() {
    const { data, error } = await this.supabase
      .from('zillow_city')
      .select('region_id, region_name, state_code')
      .order('region_name');

    if (error) throw error;

    // Dedupe by region_id
    const cityMap = new Map<
      number,
      { id: number; name: string; state: string }
    >();
    for (const row of data || []) {
      if (row.region_name && row.region_id && !cityMap.has(row.region_id)) {
        cityMap.set(row.region_id, {
          id: row.region_id,
          name: row.region_name,
          state: row.state_code || '',
        });
      }
    }

    return Array.from(cityMap.values());
  }
}
