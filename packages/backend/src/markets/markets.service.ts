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
    // Get states with their abbreviations
    const { data: states, error: statesError } = await this.supabase
      .from('tiger_states')
      .select('geoid, name, state_abbreviation');

    if (statesError) throw statesError;

    // Get latest home values from census_housing for state-level geoids (2-digit)
    const { data: housingData, error: housingError } = await this.supabase
      .from('census_housing')
      .select('geoid, median_home_value, vintage_year')
      .in('geoid', states.map((s) => s.geoid))
      .order('vintage_year', { ascending: false });

    if (housingError) throw housingError;

    // Create a map of geoid to latest home value
    const homeValueMap = new Map<string, number>();
    for (const record of housingData || []) {
      if (!homeValueMap.has(record.geoid) && record.median_home_value) {
        homeValueMap.set(record.geoid, Number(record.median_home_value));
      }
    }

    // If no state-level census data, try aggregating from county-level zillow_metrics
    if (homeValueMap.size === 0) {
      // Get county-to-state mapping
      const { data: countyMapping, error: mappingError } = await this.supabase
        .from('geo_county_state')
        .select('county_geoid, state_geoid');

      if (mappingError) throw mappingError;

      // Get latest zillow metrics for counties
      const { data: zillowData, error: zillowError } = await this.supabase
        .from('zillow_metrics')
        .select('geoid, zhvi_all_homes, metric_date')
        .not('zhvi_all_homes', 'is', null)
        .order('metric_date', { ascending: false });

      if (zillowError) throw zillowError;

      // Create county to state mapping
      const countyToState = new Map<string, string>();
      for (const mapping of countyMapping || []) {
        countyToState.set(mapping.county_geoid, mapping.state_geoid);
      }

      // Aggregate county values to state level
      const stateValues = new Map<string, number[]>();
      for (const record of zillowData || []) {
        const stateGeoid = countyToState.get(record.geoid);
        if (stateGeoid && record.zhvi_all_homes) {
          if (!stateValues.has(stateGeoid)) {
            stateValues.set(stateGeoid, []);
          }
          stateValues.get(stateGeoid)?.push(Number(record.zhvi_all_homes));
        }
      }

      // Calculate average for each state
      for (const [stateGeoid, values] of stateValues) {
        if (values.length > 0) {
          const avg = values.reduce((a, b) => a + b, 0) / values.length;
          homeValueMap.set(stateGeoid, Math.round(avg));
        }
      }
    }

    // Build result with state name as key (for GeoJSON mapping)
    const result: Record<string, number> = {};
    for (const state of states || []) {
      const value = homeValueMap.get(state.geoid);
      if (value && state.name) {
        result[state.name] = value;
      }
    }

    return result;
  }
}