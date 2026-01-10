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

  async getStateHomeValues() {
    try {
      // Get state markets with their ZHVI values
      // Join markets (states) with zillow_zhvi to get home values
      const { data: stateMarkets, error: marketsError } = await this.supabase
        .from('markets')
        .select('region_id, region_name')
        .eq('region_type', 'state');

      if (marketsError) {
        console.error('Error fetching state markets:', marketsError);
        throw marketsError;
      }

      // Get most recent ZHVI for states
      const { data: zhviData, error: zhviError } = await this.supabase
        .from('zillow_zhvi')
        .select('region_id, value, date')
        .eq('geography', 'state')
        .eq('property_type', 'all_homes')
        .order('date', { ascending: false });

      if (zhviError) {
        console.error('Error fetching ZHVI data:', zhviError);
        throw zhviError;
      }

      // Create region_id to state name mapping
      const regionNameMap = new Map<string, string>();
      for (const market of stateMarkets || []) {
        regionNameMap.set(market.region_id, market.region_name);
      }

      // Build result - only use most recent value per state
      const result: Record<string, number> = {};
      const seenStates = new Set<string>();

      for (const record of zhviData || []) {
        if (seenStates.has(record.region_id)) continue;
        seenStates.add(record.region_id);

        const stateName = regionNameMap.get(record.region_id);
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
}