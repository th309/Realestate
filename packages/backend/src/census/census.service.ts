import { Injectable, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';

export interface CensusDataPoint {
  region_id: string;
  region_name: string;
  value: number | null;  // null indicates no data (vs 0 which is a valid value)
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

// State abbreviation to FIPS code mapping
const STATE_ABBREV_TO_FIPS: Record<string, string> = {
  AL: '01', AK: '02', AZ: '04', AR: '05', CA: '06', CO: '08', CT: '09',
  DE: '10', DC: '11', FL: '12', GA: '13', HI: '15', ID: '16', IL: '17',
  IN: '18', IA: '19', KS: '20', KY: '21', LA: '22', ME: '23', MD: '24',
  MA: '25', MI: '26', MN: '27', MS: '28', MO: '29', MT: '30', NE: '31',
  NV: '32', NH: '33', NJ: '34', NM: '35', NY: '36', NC: '37', ND: '38',
  OH: '39', OK: '40', OR: '41', PA: '42', RI: '44', SC: '45', SD: '46',
  TN: '47', TX: '48', UT: '49', VT: '50', VA: '51', WA: '53', WV: '54',
  WI: '55', WY: '56', PR: '72', VI: '78', GU: '66', AS: '60', MP: '69',
};

/**
 * Convert state parameter to FIPS code
 * Accepts either state abbreviation (CA) or FIPS code (06)
 */
function toStateFips(state: string): string {
  const upper = state.toUpperCase();
  // If it's a 2-letter abbreviation, convert to FIPS
  if (STATE_ABBREV_TO_FIPS[upper]) {
    return STATE_ABBREV_TO_FIPS[upper];
  }
  // Otherwise assume it's already a FIPS code, pad to 2 digits
  return state.padStart(2, '0');
}

/**
 * Safely convert a metric value to number, returning null for missing data.
 * Unlike `Number(x) || 0`, this preserves the distinction between:
 * - 0 (actual zero value, e.g., 0% growth)
 * - null (no data available)
 */
function toMetricValue(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const num = Number(value);
  return isNaN(num) ? null : num;
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

  private async getNationalData(
    metric: string,
    year?: number,
  ): Promise<CensusDataPoint[]> {
    const latestYear = year || (await this.getLatestYear('census_national'));

    const { data, error } = await this.supabase
      .from('census_national')
      .select('*')
      .eq('year', latestYear)
      .limit(1);

    if (error) throw error;

    return ((data || []) as CensusRow[]).map((row) => ({
      region_id: 'US',
      region_name: 'United States',
      value: toMetricValue(row[metric]),
      year: latestYear ?? undefined,
    }));
  }

  private async getStateData(
    metric: string,
    year?: number,
  ): Promise<CensusDataPoint[]> {
    const cacheKey = `census_state:${metric}:${year || 'latest'}`;
    const cached = this.getCached(cacheKey);
    if (cached) {
      return cached.map((row) => ({
        region_id: String(row.state_fips || ''),
        region_name: String(row.state_name || ''),
        value: toMetricValue(row[metric]),
        year: row.year as number,
        state_fips: String(row.state_fips || ''),
      }));
    }

    const latestYear = year || (await this.getLatestYear('census_state'));

    const { data, error } = await this.supabase
      .from('census_state')
      .select('*')
      .eq('year', latestYear);

    if (error) throw error;
    this.setCache(cacheKey, data as CensusRow[]);

    return ((data || []) as CensusRow[]).map((row) => ({
      region_id: String(row.state_fips || ''),
      region_name: String(row.state_name || ''),
      value: toMetricValue(row[metric]),
      year: latestYear ?? undefined,
      state_fips: String(row.state_fips || ''),
    }));
  }

  private async getMetroData(
    metric: string,
    year?: number,
  ): Promise<CensusDataPoint[]> {
    const cacheKey = `census_metro:${metric}:${year || 'latest'}`;
    const cached = this.getCached(cacheKey);
    if (cached) {
      return cached.map((row) => ({
        region_id: String(row.cbsa_code || ''),
        region_name: String(row.cbsa_title || ''),
        value: toMetricValue(row[metric]),
        year: row.year as number,
        cbsa_code: String(row.cbsa_code || ''),
      }));
    }

    const latestYear = year || (await this.getLatestYear('census_metro'));

    const { data, error } = await this.supabase
      .from('census_metro')
      .select('*')
      .eq('year', latestYear);

    if (error) throw error;
    this.setCache(cacheKey, data as CensusRow[]);

    return ((data || []) as CensusRow[]).map((row) => ({
      region_id: String(row.cbsa_code || ''),
      region_name: String(row.cbsa_title || ''),
      value: toMetricValue(row[metric]),
      year: latestYear ?? undefined,
      cbsa_code: String(row.cbsa_code || ''),
    }));
  }

  private async getCountyData(
    metric: string,
    year?: number,
  ): Promise<CensusDataPoint[]> {
    const cacheKey = `census_county:${metric}:${year || 'latest'}`;
    const cached = this.getCached(cacheKey);
    if (cached) {
      return cached.map((row) => ({
        region_id: String(row.fips_code || ''),
        region_name: String(row.county_name || ''),
        value: toMetricValue(row[metric]),
        year: row.year as number,
        fips_code: String(row.fips_code || ''),
        state_fips: String(row.state_fips || ''),
      }));
    }

    const latestYear = year || (await this.getLatestYear('census_county'));

    // Paginate to handle all ~3,200 US counties (Supabase default limit is 1000)
    const allData: CensusRow[] = [];
    const batchSize = 1000;
    let offset = 0;

    while (true) {
      const { data, error } = await this.supabase
        .from('census_county')
        .select('*')
        .eq('year', latestYear)
        .range(offset, offset + batchSize - 1);

      if (error) throw error;
      if (!data || data.length === 0) break;

      allData.push(...(data as CensusRow[]));
      if (data.length < batchSize) break;
      offset += batchSize;
    }

    this.setCache(cacheKey, allData);

    return allData.map((row) => ({
      region_id: String(row.fips_code || ''),
      region_name: String(row.county_name || ''),
      value: toMetricValue(row[metric]),
      year: latestYear ?? undefined,
      fips_code: String(row.fips_code || ''),
      state_fips: String(row.state_fips || ''),
    }));
  }

  private async getCityData(
    metric: string,
    year?: number,
    state?: string,
  ): Promise<CensusDataPoint[]> {
    const cacheKey = `census_city:${metric}:${year || 'latest'}:${state || 'all'}`;
    const cached = this.getCached(cacheKey);
    if (cached) {
      return cached.map((row) => ({
        region_id: String(row.place_fips || ''),
        region_name: String(row.place_name || ''),
        value: toMetricValue(row[metric]),
        year: row.year as number,
        place_fips: String(row.place_fips || ''),
        state_fips: String(row.state_fips || ''),
      }));
    }

    const latestYear = year || (await this.getLatestYear('census_city'));

    // Paginate to handle states with >1000 cities (Supabase default limit)
    const allData: CensusRow[] = [];
    const batchSize = 1000;
    let offset = 0;

    while (true) {
      let query = this.supabase
        .from('census_city')
        .select('*')
        .eq('year', latestYear)
        .range(offset, offset + batchSize - 1);

      if (state) {
        query = query.eq('state_fips', toStateFips(state));
      }

      const { data, error } = await query;
      if (error) throw error;
      if (!data || data.length === 0) break;

      allData.push(...(data as CensusRow[]));
      if (data.length < batchSize) break;
      offset += batchSize;
    }

    this.setCache(cacheKey, allData);

    return allData.map((row) => ({
      region_id: String(row.place_fips || ''),
      region_name: String(row.place_name || ''),
      value: toMetricValue(row[metric]),
      year: latestYear ?? undefined,
      place_fips: String(row.place_fips || ''),
      state_fips: String(row.state_fips || ''),
    }));
  }

  private async getZipData(
    metric: string,
    year?: number,
    _state?: string, // Note: state filter ignored - ZCTAs can span state boundaries and Census API doesn't provide state info
  ): Promise<CensusDataPoint[]> {
    // Cache key ignores state since we always load all ZCTAs (map handles geographic filtering)
    const cacheKey = `census_zip:${metric}:${year || 'latest'}`;
    const cached = this.getCached(cacheKey);
    if (cached) {
      return cached.map((row) => ({
        region_id: String(row.zcta || ''),
        region_name: String(row.zcta || ''),
        value: toMetricValue(row.metric_value),
        year: row.year as number,
        zcta: String(row.zcta || ''),
      }));
    }

    // Use optimized database function to get only latest data per ZCTA
    // This returns ~33,000 rows in a single query instead of 33+ paginated API calls
    // Must set limit > 1000 (Supabase default) to get all ~33,000 US ZCTAs
    const { data, error } = await this.supabase
      .rpc('get_latest_census_zip', { p_metric: metric })
      .limit(50000);

    if (error) throw error;

    const rows = (data || []) as CensusRow[];
    this.setCache(cacheKey, rows);

    return rows.map((row) => ({
      region_id: String(row.zcta || ''),
      region_name: String(row.zcta || ''),
      value: toMetricValue(row.metric_value),
      year: row.year as number,
      zcta: String(row.zcta || ''),
    }));
  }

  // ============================================================================
  // Population
  // ============================================================================
  async getNationalPopulation(year?: number) {
    return this.getNationalData('total_population', year);
  }
  async getStatePopulation(year?: number) {
    return this.getStateData('total_population', year);
  }
  async getMetroPopulation(year?: number) {
    return this.getMetroData('total_population', year);
  }
  async getCountyPopulation(year?: number) {
    return this.getCountyData('total_population', year);
  }
  async getCityPopulation(year?: number, state?: string) {
    return this.getCityData('total_population', year, state);
  }
  async getZipPopulation(year?: number, state?: string) {
    return this.getZipData('total_population', year, state);
  }

  // ============================================================================
  // Population Growth (YoY)
  // ============================================================================
  async getNationalPopulationGrowth(year?: number) {
    return this.getNationalData('population_yoy', year);
  }
  async getStatePopulationGrowth(year?: number) {
    return this.getStateData('population_yoy', year);
  }
  async getMetroPopulationGrowth(year?: number) {
    return this.getMetroData('population_yoy', year);
  }
  async getCountyPopulationGrowth(year?: number) {
    return this.getCountyData('population_yoy', year);
  }
  async getCityPopulationGrowth(year?: number, state?: string) {
    return this.getCityData('population_yoy', year, state);
  }
  async getZipPopulationGrowth(year?: number, state?: string) {
    return this.getZipData('population_yoy', year, state);
  }

  // ============================================================================
  // Median Income
  // ============================================================================
  async getNationalMedianIncome(year?: number) {
    return this.getNationalData('median_household_income', year);
  }
  async getStateMedianIncome(year?: number) {
    return this.getStateData('median_household_income', year);
  }
  async getMetroMedianIncome(year?: number) {
    return this.getMetroData('median_household_income', year);
  }
  async getCountyMedianIncome(year?: number) {
    return this.getCountyData('median_household_income', year);
  }
  async getCityMedianIncome(year?: number, state?: string) {
    return this.getCityData('median_household_income', year, state);
  }
  async getZipMedianIncome(year?: number, state?: string) {
    return this.getZipData('median_household_income', year, state);
  }

  // ============================================================================
  // Income Growth (YoY)
  // ============================================================================
  async getNationalIncomeGrowth(year?: number) {
    return this.getNationalData('income_yoy', year);
  }
  async getStateIncomeGrowth(year?: number) {
    return this.getStateData('income_yoy', year);
  }
  async getMetroIncomeGrowth(year?: number) {
    return this.getMetroData('income_yoy', year);
  }
  async getCountyIncomeGrowth(year?: number) {
    return this.getCountyData('income_yoy', year);
  }
  async getCityIncomeGrowth(year?: number, state?: string) {
    return this.getCityData('income_yoy', year, state);
  }
  async getZipIncomeGrowth(year?: number, state?: string) {
    return this.getZipData('income_yoy', year, state);
  }

  // ============================================================================
  // Median Age
  // ============================================================================
  async getNationalMedianAge(year?: number) {
    return this.getNationalData('median_age', year);
  }
  async getStateMedianAge(year?: number) {
    return this.getStateData('median_age', year);
  }
  async getMetroMedianAge(year?: number) {
    return this.getMetroData('median_age', year);
  }
  async getCountyMedianAge(year?: number) {
    return this.getCountyData('median_age', year);
  }
  async getCityMedianAge(year?: number, state?: string) {
    return this.getCityData('median_age', year, state);
  }
  async getZipMedianAge(year?: number, state?: string) {
    return this.getZipData('median_age', year, state);
  }

  // ============================================================================
  // Homeownership Rate
  // ============================================================================
  async getNationalHomeownership(year?: number) {
    return this.getNationalData('homeownership_rate', year);
  }
  async getStateHomeownership(year?: number) {
    return this.getStateData('homeownership_rate', year);
  }
  async getMetroHomeownership(year?: number) {
    return this.getMetroData('homeownership_rate', year);
  }
  async getCountyHomeownership(year?: number) {
    return this.getCountyData('homeownership_rate', year);
  }
  async getCityHomeownership(year?: number, state?: string) {
    return this.getCityData('homeownership_rate', year, state);
  }
  async getZipHomeownership(year?: number, state?: string) {
    return this.getZipData('homeownership_rate', year, state);
  }
}
