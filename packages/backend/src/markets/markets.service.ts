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
      // Get states with their names (geoid is 2-digit state FIPS)
      const { data: states, error: statesError } = await this.supabase
        .from('tiger_states')
        .select('geoid, name');

      if (statesError) {
        console.error('Error fetching states:', statesError);
        throw statesError;
      }

      // Create state geoid to name mapping
      const stateNameMap = new Map<string, string>();
      for (const state of states || []) {
        stateNameMap.set(state.geoid, state.name);
      }

      // Get most recent ZHVI for each state (2-digit geoids)
      // ZHVI is already calculated by Zillow - no aggregation needed
      const stateGeoids = states?.map((s) => s.geoid) || [];
      const { data: zillowData, error: zillowError } = await this.supabase
        .from('zillow_metrics')
        .select('geoid, zhvi_all_homes, metric_date')
        .in('geoid', stateGeoids)
        .not('zhvi_all_homes', 'is', null)
        .order('metric_date', { ascending: false });

      if (zillowError) {
        console.error('Error fetching zillow data:', zillowError);
        throw zillowError;
      }

      // Build result - only use most recent value per state
      const result: Record<string, number> = {};
      const seenStates = new Set<string>();

      for (const record of zillowData || []) {
        if (seenStates.has(record.geoid)) continue;
        seenStates.add(record.geoid);

        const stateName = stateNameMap.get(record.geoid);
        if (stateName && record.zhvi_all_homes) {
          result[stateName] = Math.round(Number(record.zhvi_all_homes));
        }
      }

      return result;
    } catch (error) {
      console.error('getStateHomeValues error:', error);
      throw error;
    }
  }
}