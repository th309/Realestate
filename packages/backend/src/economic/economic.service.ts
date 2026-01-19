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
  value: number;
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

  private async getLatestDate(
    table: string,
    metric?: string,
  ): Promise<string | null> {
    let query = this.supabase
      .from(table)
      .select('period_date')
      .order('period_date', { ascending: false });

    // For metrics that might be NULL on many dates (like GDP, RPP),
    // filter to only dates where the metric has data
    if (metric) {
      query = query.not(metric, 'is', null);
    }

    const { data } = await query.limit(1);
    return (data?.[0] as EconomicRow)?.period_date as string | null;
  }

  // ============================================================================
  // Generic Data Fetchers
  // ============================================================================

  private async getNationalData(
    metric: string,
    date?: string,
  ): Promise<EconomicDataPoint[]> {
    // Pass metric to getLatestDate so it finds the latest date with non-null data for this metric
    const latestDate =
      date || (await this.getLatestDate('economic_national', metric));

    const { data, error } = await this.supabase
      .from('economic_national')
      .select('*')
      .eq('period_date', latestDate)
      .limit(1);

    if (error) throw error;

    return ((data || []) as EconomicRow[]).map((row) => ({
      region_id: 'US',
      region_name: 'United States',
      value: Number(row[metric]) || 0,
      date: latestDate ?? undefined,
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
        value: Number(row[metric]) || 0,
        date: row.period_date as string,
        state_fips: String(row.state_fips || ''),
      }));
    }

    // Pass metric to getLatestDate so it finds the latest date with non-null data for this metric
    const latestDate =
      date || (await this.getLatestDate('economic_state', metric));

    const { data, error } = await this.supabase
      .from('economic_state')
      .select('*')
      .eq('period_date', latestDate);

    if (error) throw error;
    this.setCache(cacheKey, data as EconomicRow[]);

    return ((data || []) as EconomicRow[]).map((row) => ({
      region_id: String(row.state_fips || ''),
      region_name: String(row.state_name || ''),
      value: Number(row[metric]) || 0,
      date: latestDate ?? undefined,
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
        value: Number(row[metric]) || 0,
        date: row.period_date as string,
        cbsa_code: String(row.cbsa_code || ''),
      }));
    }

    // Pass metric to getLatestDate so it finds the latest date with non-null data for this metric
    const latestDate =
      date || (await this.getLatestDate('economic_metro', metric));

    const { data, error } = await this.supabase
      .from('economic_metro')
      .select('*')
      .eq('period_date', latestDate);

    if (error) throw error;
    this.setCache(cacheKey, data as EconomicRow[]);

    return ((data || []) as EconomicRow[]).map((row) => ({
      region_id: String(row.cbsa_code || ''),
      region_name: String(row.cbsa_title || ''),
      value: Number(row[metric]) || 0,
      date: latestDate ?? undefined,
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
        value: Number(row[metric]) || 0,
        date: row.period_date as string,
        fips_code: String(row.fips_code || ''),
        state_fips: String(row.state_fips || ''),
      }));
    }

    // Pass metric to getLatestDate so it finds the latest date with non-null data for this metric
    const latestDate =
      date || (await this.getLatestDate('economic_county', metric));

    const { data, error } = await this.supabase
      .from('economic_county')
      .select('*')
      .eq('period_date', latestDate);

    if (error) throw error;
    this.setCache(cacheKey, data as EconomicRow[]);

    return ((data || []) as EconomicRow[]).map((row) => ({
      region_id: String(row.fips_code || ''),
      region_name: String(row.county_name || ''),
      value: Number(row[metric]) || 0,
      date: latestDate ?? undefined,
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
