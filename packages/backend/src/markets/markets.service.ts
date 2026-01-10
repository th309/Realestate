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
      // Get states with their names
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

      // Get latest Zillow metrics - county geoids are 5 digits (state 2 + county 3)
      const { data: zillowData, error: zillowError } = await this.supabase
        .from('zillow_metrics')
        .select('geoid, zhvi_all_homes, metric_date')
        .not('zhvi_all_homes', 'is', null)
        .order('metric_date', { ascending: false })
        .limit(5000);

      if (zillowError) {
        console.error('Error fetching zillow data:', zillowError);
        throw zillowError;
      }

      // Aggregate county values to state level
      // County geoid format: first 2 digits = state FIPS code
      const stateValues = new Map<string, number[]>();
      const seenCounties = new Set<string>(); // Only use most recent per county

      for (const record of zillowData || []) {
        if (!record.geoid || record.geoid.length < 2) continue;
        if (seenCounties.has(record.geoid)) continue; // Skip older records for same county

        seenCounties.add(record.geoid);
        const stateGeoid = record.geoid.substring(0, 2); // Extract state FIPS

        if (record.zhvi_all_homes && stateNameMap.has(stateGeoid)) {
          if (!stateValues.has(stateGeoid)) {
            stateValues.set(stateGeoid, []);
          }
          stateValues.get(stateGeoid)?.push(Number(record.zhvi_all_homes));
        }
      }

      // Calculate median for each state (more accurate than average)
      const result: Record<string, number> = {};
      for (const [stateGeoid, values] of stateValues) {
        if (values.length > 0) {
          // Sort and get median
          values.sort((a, b) => a - b);
          const mid = Math.floor(values.length / 2);
          const median = values.length % 2 !== 0
            ? values[mid]
            : Math.round((values[mid - 1] + values[mid]) / 2);

          const stateName = stateNameMap.get(stateGeoid);
          if (stateName) {
            result[stateName] = median;
          }
        }
      }

      return result;
    } catch (error) {
      console.error('getStateHomeValues error:', error);
      throw error;
    }
  }
}