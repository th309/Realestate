import { Injectable, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../../supabase/supabase.service';
import { normalizeStateToCode } from '../../common/geo';

/**
 * Internal service for geography lookups (states, counties, metros) keyed
 * off the `geographies` table.
 */
@Injectable()
export class MarketsGeographiesService {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

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
    stateCode = normalizeStateToCode(stateCode);
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
    stateCode = normalizeStateToCode(stateCode);
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
}
