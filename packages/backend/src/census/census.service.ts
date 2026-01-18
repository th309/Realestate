import { Injectable, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.module';

export interface CensusDataPoint {
  region_id: string;
  region_name: string;
  value: number;
  year?: number;
  state_fips?: string;
  cbsa_code?: string;
  fips_code?: string;
  zcta?: string;
  place_fips?: string;
}

interface CensusRow {
  [key: string]: unknown;
}

interface CacheEntry<T> {
  data: T;
  expiry: number;
}

@Injectable()
export class CensusService {
  private readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours (census data changes annually)
  private cache = new Map<string, CacheEntry<CensusRow[]>>();

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  private getCached(key: string): CensusRow[] | null {
    const entry = this.cache.get(key);
    if (entry && entry.expiry > Date.now()) {
      return entry.data;
    }
    this.cache.delete(key);
    return null;
  }

  private setCache(key: string, data: CensusRow[]): void {
    this.cache.set(key, {
      data,
      expiry: Date.now() + this.CACHE_TTL,
    });
  }

  private async getLatestYear(table: string): Promise<number | null> {
    const { data } = await this.supabase
      .from(table)
      .select('year')
      .order('year', { ascending: false })
      .limit(1);

    return (data?.[0] as CensusRow)?.year as number | null;
  }

  // ============================================================================
  // Generic Data Fetchers
  // ============================================================================

  private async getNationalData(metric: string, year?: number): Promise<CensusDataPoint[]> {
    const latestYear = year || await this.getLatestYear('census_national');

    const { data, error } = await this.supabase
      .from('census_national')
      .select('*')
      .eq('year', latestYear)
      .limit(1);

    if (error) throw error;

    return ((data || []) as CensusRow[]).map(row => ({
      region_id: 'US',
      region_name: 'United States',
      value: Number(row[metric]) || 0,
      year: latestYear ?? undefined,
    }));
  }

  private async getStateData(metric: string, year?: number): Promise<CensusDataPoint[]> {
    const cacheKey = `census_state:${metric}:${year || 'latest'}`;
    const cached = this.getCached(cacheKey);
    if (cached) {
      return cached.map(row => ({
        region_id: String(row.state_fips || ''),
        region_name: String(row.state_name || ''),
        value: Number(row[metric]) || 0,
        year: row.year as number,
        state_fips: String(row.state_fips || ''),
      }));
    }

    const latestYear = year || await this.getLatestYear('census_state');

    const { data, error } = await this.supabase
      .from('census_state')
      .select('*')
      .eq('year', latestYear);

    if (error) throw error;
    this.setCache(cacheKey, data as CensusRow[]);

    return ((data || []) as CensusRow[]).map(row => ({
      region_id: String(row.state_fips || ''),
      region_name: String(row.state_name || ''),
      value: Number(row[metric]) || 0,
      year: latestYear ?? undefined,
      state_fips: String(row.state_fips || ''),
    }));
  }

  private async getMetroData(metric: string, year?: number): Promise<CensusDataPoint[]> {
    const cacheKey = `census_metro:${metric}:${year || 'latest'}`;
    const cached = this.getCached(cacheKey);
    if (cached) {
      return cached.map(row => ({
        region_id: String(row.cbsa_code || ''),
        region_name: String(row.cbsa_title || ''),
        value: Number(row[metric]) || 0,
        year: row.year as number,
        cbsa_code: String(row.cbsa_code || ''),
      }));
    }

    const latestYear = year || await this.getLatestYear('census_metro');

    const { data, error } = await this.supabase
      .from('census_metro')
      .select('*')
      .eq('year', latestYear);

    if (error) throw error;
    this.setCache(cacheKey, data as CensusRow[]);

    return ((data || []) as CensusRow[]).map(row => ({
      region_id: String(row.cbsa_code || ''),
      region_name: String(row.cbsa_title || ''),
      value: Number(row[metric]) || 0,
      year: latestYear ?? undefined,
      cbsa_code: String(row.cbsa_code || ''),
    }));
  }

  private async getCountyData(metric: string, year?: number): Promise<CensusDataPoint[]> {
    const cacheKey = `census_county:${metric}:${year || 'latest'}`;
    const cached = this.getCached(cacheKey);
    if (cached) {
      return cached.map(row => ({
        region_id: String(row.fips_code || ''),
        region_name: String(row.county_name || ''),
        value: Number(row[metric]) || 0,
        year: row.year as number,
        fips_code: String(row.fips_code || ''),
        state_fips: String(row.state_fips || ''),
      }));
    }

    const latestYear = year || await this.getLatestYear('census_county');

    const { data, error } = await this.supabase
      .from('census_county')
      .select('*')
      .eq('year', latestYear);

    if (error) throw error;
    this.setCache(cacheKey, data as CensusRow[]);

    return ((data || []) as CensusRow[]).map(row => ({
      region_id: String(row.fips_code || ''),
      region_name: String(row.county_name || ''),
      value: Number(row[metric]) || 0,
      year: latestYear ?? undefined,
      fips_code: String(row.fips_code || ''),
      state_fips: String(row.state_fips || ''),
    }));
  }

  private async getZipData(metric: string, year?: number, state?: string): Promise<CensusDataPoint[]> {
    const cacheKey = `census_zip:${metric}:${year || 'latest'}:${state || 'all'}`;
    const cached = this.getCached(cacheKey);
    if (cached) {
      return cached.map(row => ({
        region_id: String(row.zcta || ''),
        region_name: String(row.zcta || ''),
        value: Number(row[metric]) || 0,
        year: row.year as number,
        zcta: String(row.zcta || ''),
      }));
    }

    const latestYear = year || await this.getLatestYear('census_zip');

    let query = this.supabase
      .from('census_zip')
      .select('*')
      .eq('year', latestYear);

    if (state) {
      query = query.eq('state_fips', state.padStart(2, '0'));
    }

    const { data, error } = await query;
    if (error) throw error;
    this.setCache(cacheKey, data as CensusRow[]);

    return ((data || []) as CensusRow[]).map(row => ({
      region_id: String(row.zcta || ''),
      region_name: String(row.zcta || ''),
      value: Number(row[metric]) || 0,
      year: latestYear ?? undefined,
      zcta: String(row.zcta || ''),
    }));
  }

  // ============================================================================
  // Population
  // ============================================================================
  async getNationalPopulation(year?: number) { return this.getNationalData('total_population', year); }
  async getStatePopulation(year?: number) { return this.getStateData('total_population', year); }
  async getMetroPopulation(year?: number) { return this.getMetroData('total_population', year); }
  async getCountyPopulation(year?: number) { return this.getCountyData('total_population', year); }
  async getZipPopulation(year?: number, state?: string) { return this.getZipData('total_population', year, state); }

  // ============================================================================
  // Population Growth (YoY)
  // ============================================================================
  async getNationalPopulationGrowth(year?: number) { return this.getNationalData('population_yoy', year); }
  async getStatePopulationGrowth(year?: number) { return this.getStateData('population_yoy', year); }
  async getMetroPopulationGrowth(year?: number) { return this.getMetroData('population_yoy', year); }
  async getCountyPopulationGrowth(year?: number) { return this.getCountyData('population_yoy', year); }
  async getZipPopulationGrowth(year?: number, state?: string) { return this.getZipData('population_yoy', year, state); }

  // ============================================================================
  // Median Income
  // ============================================================================
  async getNationalMedianIncome(year?: number) { return this.getNationalData('median_household_income', year); }
  async getStateMedianIncome(year?: number) { return this.getStateData('median_household_income', year); }
  async getMetroMedianIncome(year?: number) { return this.getMetroData('median_household_income', year); }
  async getCountyMedianIncome(year?: number) { return this.getCountyData('median_household_income', year); }
  async getZipMedianIncome(year?: number, state?: string) { return this.getZipData('median_household_income', year, state); }

  // ============================================================================
  // Income Growth (YoY)
  // ============================================================================
  async getNationalIncomeGrowth(year?: number) { return this.getNationalData('income_yoy', year); }
  async getStateIncomeGrowth(year?: number) { return this.getStateData('income_yoy', year); }
  async getMetroIncomeGrowth(year?: number) { return this.getMetroData('income_yoy', year); }
  async getCountyIncomeGrowth(year?: number) { return this.getCountyData('income_yoy', year); }
  async getZipIncomeGrowth(year?: number, state?: string) { return this.getZipData('income_yoy', year, state); }

  // ============================================================================
  // Median Age
  // ============================================================================
  async getNationalMedianAge(year?: number) { return this.getNationalData('median_age', year); }
  async getStateMedianAge(year?: number) { return this.getStateData('median_age', year); }
  async getMetroMedianAge(year?: number) { return this.getMetroData('median_age', year); }
  async getCountyMedianAge(year?: number) { return this.getCountyData('median_age', year); }
  async getZipMedianAge(year?: number, state?: string) { return this.getZipData('median_age', year, state); }

  // ============================================================================
  // Homeownership Rate
  // ============================================================================
  async getNationalHomeownership(year?: number) { return this.getNationalData('homeownership_rate', year); }
  async getStateHomeownership(year?: number) { return this.getStateData('homeownership_rate', year); }
  async getMetroHomeownership(year?: number) { return this.getMetroData('homeownership_rate', year); }
  async getCountyHomeownership(year?: number) { return this.getCountyData('homeownership_rate', year); }
  async getZipHomeownership(year?: number, state?: string) { return this.getZipData('homeownership_rate', year, state); }
}
