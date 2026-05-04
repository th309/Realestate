import { Injectable, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../../supabase/supabase.service';

/**
 * Internal service for Zillow ZHVI home-value lookups across geography levels.
 * Returns either name->value maps (legacy shape) or richer with-names rows.
 */
@Injectable()
export class MarketsHomeValuesService {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

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
}
