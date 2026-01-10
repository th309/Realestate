import { Injectable, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.module';

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
    const { data, error } = await this.supabase
      .from('tiger_states')
      .select('geoid, name, state_abbreviation, population')
      .order('name');

    if (error) throw error;
    return data;
  }

  async getCountiesByState(stateGeoid: string) {
    const { data, error } = await this.supabase
      .from('tiger_counties')
      .select('geoid, name, state_abbreviation, population')
      .eq('geoid', stateGeoid)
      .order('name');

    if (error) throw error;
    return data;
  }

  async getMarketStats() {
    const { count: totalMarkets } = await this.supabase
      .from('markets')
      .select('*', { count: 'exact', head: true });

    const { count: totalStates } = await this.supabase
      .from('tiger_states')
      .select('*', { count: 'exact', head: true });

    const { count: totalCounties } = await this.supabase
      .from('tiger_counties')
      .select('*', { count: 'exact', head: true });

    const { count: totalZips } = await this.supabase
      .from('tiger_zcta')
      .select('*', { count: 'exact', head: true });

    return {
      totalMarkets,
      totalStates,
      totalCounties,
      totalZips,
    };
  }

  // Zillow RegionID to State Name mapping
  private readonly ZILLOW_STATE_MAP: Record<string, string> = {
    '3': 'Alaska', '4': 'Alabama', '6': 'Arkansas', '8': 'Arizona',
    '9': 'California', '10': 'Colorado', '11': 'Connecticut',
    '12': 'District of Columbia', '13': 'Delaware', '14': 'Florida',
    '16': 'Georgia', '18': 'Hawaii', '19': 'Iowa', '20': 'Idaho',
    '21': 'Illinois', '22': 'Indiana', '23': 'Kansas', '24': 'Kentucky',
    '25': 'Louisiana', '26': 'Massachusetts', '27': 'Maryland', '28': 'Maine',
    '30': 'Michigan', '31': 'Minnesota', '32': 'Missouri', '34': 'Mississippi',
    '35': 'Montana', '36': 'North Carolina', '37': 'North Dakota',
    '38': 'Nebraska', '39': 'New Hampshire', '40': 'New Jersey',
    '41': 'New Mexico', '42': 'Nevada', '43': 'New York', '44': 'Ohio',
    '45': 'Oklahoma', '46': 'Oregon', '47': 'Pennsylvania', '50': 'Rhode Island',
    '51': 'South Carolina', '52': 'South Dakota', '53': 'Tennessee',
    '54': 'Texas', '55': 'Utah', '56': 'Virginia', '58': 'Vermont',
    '59': 'Washington', '60': 'Wisconsin', '61': 'West Virginia', '62': 'Wyoming',
  };

  async getStateHomeValues() {
    try {
      // Get ZHVI data for specific state region_ids (efficient IN query)
      const stateRegionIds = Object.keys(this.ZILLOW_STATE_MAP);

      const { data: zhviData, error: zhviError } = await this.supabase
        .from('zillow_zhvi')
        .select('region_id, value, date')
        .in('region_id', stateRegionIds)
        .order('date', { ascending: false })
        .limit(500);

      if (zhviError) {
        console.error('Error fetching ZHVI data:', zhviError);
        throw zhviError;
      }

      // Build result - only use most recent value per state
      const result: Record<string, number> = {};
      const seenStates = new Set<string>();

      for (const record of zhviData || []) {
        if (seenStates.has(record.region_id)) continue;
        seenStates.add(record.region_id);

        const stateName = this.ZILLOW_STATE_MAP[record.region_id];
        if (stateName && record.value) {
          result[stateName] = Math.round(Number(record.value));
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
      // Get most recent ZHVI for metros
      const { data: zhviData, error: zhviError } = await this.supabase
        .from('zillow_zhvi')
        .select('region_id, value, date')
        .eq('geography', 'Metro')
        .order('date', { ascending: false })
        .limit(2000);

      if (zhviError) {
        console.error('Error fetching Metro ZHVI data:', zhviError);
        throw zhviError;
      }

      // Build result - only use most recent value per metro
      const result: Record<string, number> = {};
      const seenMetros = new Set<string>();

      for (const record of zhviData || []) {
        if (seenMetros.has(record.region_id)) continue;
        seenMetros.add(record.region_id);

        if (record.value) {
          result[record.region_id] = Math.round(Number(record.value));
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
      // Get most recent ZHVI for counties (need enough rows for all ~3000 counties)
      const { data: zhviData, error: zhviError } = await this.supabase
        .from('zillow_zhvi')
        .select('region_id, value, date')
        .eq('geography', 'County')
        .order('date', { ascending: false })
        .limit(50000);

      if (zhviError) {
        console.error('Error fetching County ZHVI data:', zhviError);
        throw zhviError;
      }

      // Build result - only use most recent value per county
      const result: Record<string, number> = {};
      const seenCounties = new Set<string>();

      for (const record of zhviData || []) {
        if (seenCounties.has(record.region_id)) continue;
        seenCounties.add(record.region_id);

        if (record.value) {
          result[record.region_id] = Math.round(Number(record.value));
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
      // Get most recent ZHVI for ZIP codes
      const { data: zhviData, error: zhviError } = await this.supabase
        .from('zillow_zhvi')
        .select('region_id, value, date')
        .eq('geography', 'Zip')
        .order('date', { ascending: false })
        .limit(50000);

      if (zhviError) {
        console.error('Error fetching Zip ZHVI data:', zhviError);
        throw zhviError;
      }

      // Build result - only use most recent value per ZIP
      const result: Record<string, number> = {};
      const seenZips = new Set<string>();

      for (const record of zhviData || []) {
        if (seenZips.has(record.region_id)) continue;
        seenZips.add(record.region_id);

        if (record.value) {
          result[record.region_id] = Math.round(Number(record.value));
        }
      }

      return result;
    } catch (error) {
      console.error('getZipHomeValues error:', error);
      throw error;
    }
  }
}