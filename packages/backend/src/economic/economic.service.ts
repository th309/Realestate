/**
 * Economic Service
 * Provides unemployment rate, job growth, GDP growth, and cost of living data
 * Data sources: BLS (369 metros), BEA, FRED
 */
import { Injectable, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';

export interface EconomicDataPoint {
  region_id: string;
  region_name: string;
  value: number | null;
  date?: string;
  state_fips?: string;
  cbsa_code?: string;
  fips_code?: string;
}

interface EconomicRow {
  [key: string]: unknown;
}

interface CacheEntry<T> {
  data: T;
  expiry: number;
}

/**
 * Safely convert a value to number, returning null for missing/invalid values.
 * This prevents converting missing data (null/undefined) to 0.
 */
function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  return isNaN(num) ? null : num;
}

@Injectable()
export class EconomicService {
  private readonly CACHE_TTL = 4 * 60 * 60 * 1000; // 4 hours
  private cache = new Map<string, CacheEntry<EconomicRow[]>>();

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  private getCached(key: string): EconomicRow[] | null {
    const entry = this.cache.get(key);
    if (entry && entry.expiry > Date.now()) {
      return entry.data;
    }
    this.cache.delete(key);
    return null;
  }

  private setCache(key: string, data: EconomicRow[]): void {
    this.cache.set(key, {
      data,
      expiry: Date.now() + this.CACHE_TTL,
    });
  }

  // ============================================================================
  // Generic Data Fetchers - Use optimized database functions
  // ============================================================================

  private async getNationalData(
    metric: string,
    date?: string,
  ): Promise<EconomicDataPoint[]> {
    // For national, just get the most recent record with non-null metric value
    let query = this.supabase
      .from('economic_national')
      .select('*')
      .not(metric, 'is', null)
      .order('period_date', { ascending: false })
      .limit(1);

    if (date) {
      query = this.supabase
        .from('economic_national')
        .select('*')
        .eq('period_date', date)
        .limit(1);
    }

    const { data, error } = await query;
    if (error) throw error;

    // If specific date was requested but had no data, fall back to latest available
    if (date && (!data || data.length === 0 || toNumberOrNull((data[0] as EconomicRow)[metric]) === null)) {
      const { data: fallbackData, error: fallbackError } = await this.supabase
        .from('economic_national')
        .select('*')
        .not(metric, 'is', null)
        .order('period_date', { ascending: false })
        .limit(1);

      if (fallbackError) throw fallbackError;
      if (fallbackData && fallbackData.length > 0) {
        const row = fallbackData[0] as EconomicRow;
        return [{
          region_id: 'US',
          region_name: 'United States',
          value: toNumberOrNull(row[metric]),
          date: row.period_date as string,
        }];
      }
    }

    return ((data || []) as EconomicRow[]).map((row) => ({
      region_id: 'US',
      region_name: 'United States',
      value: toNumberOrNull(row[metric]),
      date: row.period_date as string,
    }));
  }

  private async getStateData(
    metric: string,
    date?: string,
  ): Promise<EconomicDataPoint[]> {
    const cacheKey = `economic_state:${metric}:${date || 'latest'}`;
    const cached = this.getCached(cacheKey);
    if (cached) {
      return cached.map((row) => ({
        region_id: String(row.state_fips || ''),
        region_name: String(row.state_name || ''),
        value: toNumberOrNull(row.metric_value),
        date: row.period_date as string,
        state_fips: String(row.state_fips || ''),
      }));
    }

    // Use optimized database function to get only latest data per state
    const { data, error } = await this.supabase.rpc('get_latest_economic_state', {
      p_metric: metric,
    });

    if (error) throw error;

    const rows = (data || []) as EconomicRow[];
    this.setCache(cacheKey, rows);

    return rows.map((row) => ({
      region_id: String(row.state_fips || ''),
      region_name: String(row.state_name || ''),
      value: toNumberOrNull(row.metric_value),
      date: row.period_date as string,
      state_fips: String(row.state_fips || ''),
    }));
  }

  private async getMetroData(
    metric: string,
    date?: string,
  ): Promise<EconomicDataPoint[]> {
    const cacheKey = `economic_metro:${metric}:${date || 'latest'}`;
    const cached = this.getCached(cacheKey);
    if (cached) {
      return cached.map((row) => ({
        region_id: String(row.cbsa_code || ''),
        region_name: String(row.cbsa_title || ''),
        value: toNumberOrNull(row.metric_value),
        date: row.period_date as string,
        cbsa_code: String(row.cbsa_code || ''),
      }));
    }

    // Use optimized database function to get only latest data per metro
    // Paginate for consistency (369 metros should fit in one call, but be safe)
    const allRows: EconomicRow[] = [];
    const batchSize = 1000;
    let offset = 0;

    while (true) {
      const { data, error } = await this.supabase
        .rpc('get_latest_economic_metro', { p_metric: metric })
        .range(offset, offset + batchSize - 1);

      if (error) throw error;
      if (!data || data.length === 0) break;

      allRows.push(...(data as EconomicRow[]));
      if (data.length < batchSize) break;
      offset += batchSize;
    }

    this.setCache(cacheKey, allRows);

    return allRows.map((row) => ({
      region_id: String(row.cbsa_code || ''),
      region_name: String(row.cbsa_title || ''),
      value: toNumberOrNull(row.metric_value),
      date: row.period_date as string,
      cbsa_code: String(row.cbsa_code || ''),
    }));
  }

  private async getCountyData(
    metric: string,
    date?: string,
  ): Promise<EconomicDataPoint[]> {
    const cacheKey = `economic_county:${metric}:${date || 'latest'}`;
    const cached = this.getCached(cacheKey);
    if (cached) {
      return cached.map((row) => ({
        region_id: String(row.fips_code || ''),
        region_name: String(row.county_name || ''),
        value: toNumberOrNull(row.metric_value),
        date: row.period_date as string,
        fips_code: String(row.fips_code || ''),
        state_fips: String(row.state_fips || ''),
      }));
    }

    // Use optimized database function to get only latest data per county
    // Paginate RPC results since Supabase enforces 1000-row limit regardless of .limit()
    const allRows: EconomicRow[] = [];
    const batchSize = 1000;
    let offset = 0;

    while (true) {
      const { data, error } = await this.supabase
        .rpc('get_latest_economic_county', { p_metric: metric })
        .range(offset, offset + batchSize - 1);

      if (error) throw error;
      if (!data || data.length === 0) break;

      allRows.push(...(data as EconomicRow[]));
      if (data.length < batchSize) break;
      offset += batchSize;
    }

    this.setCache(cacheKey, allRows);

    return allRows.map((row) => ({
      region_id: String(row.fips_code || ''),
      region_name: String(row.county_name || ''),
      value: toNumberOrNull(row.metric_value),
      date: row.period_date as string,
      fips_code: String(row.fips_code || ''),
      state_fips: String(row.state_fips || ''),
    }));
  }

  // ============================================================================
  // Unemployment Rate
  // ============================================================================
  async getNationalUnemployment(date?: string) {
    return this.getNationalData('unemployment_rate', date);
  }
  async getStateUnemployment(date?: string) {
    return this.getStateData('unemployment_rate', date);
  }
  async getMetroUnemployment(date?: string) {
    return this.getMetroData('unemployment_rate', date);
  }
  async getCountyUnemployment(date?: string) {
    return this.getCountyData('unemployment_rate', date);
  }

  // ============================================================================
  // Job Growth (Employment YoY)
  // ============================================================================
  async getNationalJobGrowth(date?: string) {
    return this.getNationalData('employment_yoy', date);
  }
  async getStateJobGrowth(date?: string) {
    return this.getStateData('employment_yoy', date);
  }
  async getMetroJobGrowth(date?: string) {
    return this.getMetroData('employment_yoy', date);
  }
  async getCountyJobGrowth(date?: string) {
    return this.getCountyData('employment_yoy', date);
  }

  // ============================================================================
  // GDP Growth
  // ============================================================================
  async getNationalGdpGrowth(date?: string) {
    return this.getNationalData('gdp_yoy', date);
  }
  async getStateGdpGrowth(date?: string) {
    return this.getStateData('gdp_yoy', date);
  }
  async getMetroGdpGrowth(date?: string) {
    return this.getMetroData('gdp_yoy', date);
  }
  async getCountyGdpGrowth(date?: string) {
    return this.getCountyData('gdp_yoy', date);
  }

  // ============================================================================
  // Cost of Living (RPP)
  // ============================================================================
  async getStateCostOfLiving(date?: string) {
    return this.getStateData('rpp_all_items', date);
  }
  async getMetroCostOfLiving(date?: string) {
    return this.getMetroData('rpp_all_items', date);
  }
}
