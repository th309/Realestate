import { Injectable, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';

export interface PermitsDataPoint {
  region_id: string;
  region_name: string;
  value: number | null;
  period_date?: string;
  state_fips?: string;
  fips_code?: string;
  county_fips?: string;
}

interface PermitsRow {
  [key: string]: unknown;
}

interface CacheEntry<T> {
  data: T;
  expiry: number;
}

// State FIPS to name mapping
const STATE_FIPS_TO_NAME: Record<string, string> = {
  '01': 'Alabama', '02': 'Alaska', '04': 'Arizona', '05': 'Arkansas',
  '06': 'California', '08': 'Colorado', '09': 'Connecticut', '10': 'Delaware',
  '11': 'District of Columbia', '12': 'Florida', '13': 'Georgia', '15': 'Hawaii',
  '16': 'Idaho', '17': 'Illinois', '18': 'Indiana', '19': 'Iowa',
  '20': 'Kansas', '21': 'Kentucky', '22': 'Louisiana', '23': 'Maine',
  '24': 'Maryland', '25': 'Massachusetts', '26': 'Michigan', '27': 'Minnesota',
  '28': 'Mississippi', '29': 'Missouri', '30': 'Montana', '31': 'Nebraska',
  '32': 'Nevada', '33': 'New Hampshire', '34': 'New Jersey', '35': 'New Mexico',
  '36': 'New York', '37': 'North Carolina', '38': 'North Dakota', '39': 'Ohio',
  '40': 'Oklahoma', '41': 'Oregon', '42': 'Pennsylvania', '44': 'Rhode Island',
  '45': 'South Carolina', '46': 'South Dakota', '47': 'Tennessee', '48': 'Texas',
  '49': 'Utah', '50': 'Vermont', '51': 'Virginia', '53': 'Washington',
  '54': 'West Virginia', '55': 'Wisconsin', '56': 'Wyoming', '72': 'Puerto Rico',
};

// State abbreviation to FIPS mapping
const STATE_ABBREV_TO_FIPS: Record<string, string> = {
  AL: '01', AK: '02', AZ: '04', AR: '05', CA: '06', CO: '08', CT: '09',
  DE: '10', DC: '11', FL: '12', GA: '13', HI: '15', ID: '16', IL: '17',
  IN: '18', IA: '19', KS: '20', KY: '21', LA: '22', ME: '23', MD: '24',
  MA: '25', MI: '26', MN: '27', MS: '28', MO: '29', MT: '30', NE: '31',
  NV: '32', NH: '33', NJ: '34', NM: '35', NY: '36', NC: '37', ND: '38',
  OH: '39', OK: '40', OR: '41', PA: '42', RI: '44', SC: '45', SD: '46',
  TN: '47', TX: '48', UT: '49', VT: '50', VA: '51', WA: '53', WV: '54',
  WI: '55', WY: '56', PR: '72',
};

function toStateFips(state: string): string {
  const upper = state.toUpperCase();
  if (STATE_ABBREV_TO_FIPS[upper]) {
    return STATE_ABBREV_TO_FIPS[upper];
  }
  return state.padStart(2, '0');
}

function toMetricValue(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const num = Number(value);
  return isNaN(num) ? null : num;
}

@Injectable()
export class PermitsService {
  private readonly CACHE_TTL = 60 * 60 * 1000; // 1 hour
  private cache = new Map<string, CacheEntry<PermitsRow[]>>();

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  private getCached(key: string): PermitsRow[] | null {
    const entry = this.cache.get(key);
    if (entry && entry.expiry > Date.now()) {
      return entry.data;
    }
    this.cache.delete(key);
    return null;
  }

  private setCache(key: string, data: PermitsRow[]): void {
    this.cache.set(key, {
      data,
      expiry: Date.now() + this.CACHE_TTL,
    });
  }

  private async getLatestPeriod(table: string): Promise<string | null> {
    const { data } = await this.supabase
      .from(table)
      .select('period_date')
      .order('period_date', { ascending: false })
      .limit(1);

    return (data?.[0] as PermitsRow)?.period_date as string | null;
  }

  // ============================================================================
  // State-Level Permits
  // ============================================================================

  async getStatePermits(): Promise<{
    success: boolean;
    count: number;
    data: any[];
  }> {
    const cacheKey = `permits_state:all`;
    const cached = this.getCached(cacheKey);
    if (cached) {
      const result = cached.map((row) => ({
        region_id: String(row.state_fips || ''),
        region_name: STATE_FIPS_TO_NAME[String(row.state_fips)] || String(row.state_fips),
        period_date: String(row.period_date || ''),
        state_fips: String(row.state_fips || ''),
        // Include all metric fields for valueField extraction
        sf_units: toMetricValue(row.sf_units),
        large_multi_units: toMetricValue(row.large_multi_units),
        total_units: toMetricValue(row.total_units),
        total_units_yoy: toMetricValue(row.total_units_yoy),
        sf_buildings: toMetricValue(row.sf_buildings),
        total_buildings: toMetricValue(row.total_buildings),
        total_value: toMetricValue(row.total_value),
      }));
      return { success: true, count: result.length, data: result };
    }

    const latestPeriod = await this.getLatestPeriod('permits_state');

    const { data, error } = await this.supabase
      .from('permits_state')
      .select('*')
      .eq('period_date', latestPeriod);

    if (error) throw error;

    const rows = (data || []) as PermitsRow[];
    this.setCache(cacheKey, rows);

    const result = rows.map((row) => ({
      region_id: String(row.state_fips || ''),
      region_name: STATE_FIPS_TO_NAME[String(row.state_fips)] || String(row.state_fips),
      period_date: String(row.period_date || ''),
      state_fips: String(row.state_fips || ''),
      // Include all metric fields for valueField extraction
      sf_units: toMetricValue(row.sf_units),
      large_multi_units: toMetricValue(row.large_multi_units),
      total_units: toMetricValue(row.total_units),
      total_units_yoy: toMetricValue(row.total_units_yoy),
      sf_buildings: toMetricValue(row.sf_buildings),
      total_buildings: toMetricValue(row.total_buildings),
      total_value: toMetricValue(row.total_value),
    }));

    return { success: true, count: result.length, data: result };
  }

  // ============================================================================
  // County-Level Permits
  // ============================================================================

  async getCountyPermits(state?: string): Promise<{
    success: boolean;
    count: number;
    data: any[];
  }> {
    const cacheKey = `permits_county:${state || 'all'}`;
    const cached = this.getCached(cacheKey);
    if (cached) {
      const result = cached.map((row) => ({
        region_id: String(row.fips_code || ''),
        region_name: String(row.county_name || ''),
        period_date: String(row.period_date || ''),
        fips_code: String(row.fips_code || ''),
        county_fips: String(row.fips_code || ''),
        state_fips: String(row.state_fips || ''),
        // Include all metric fields for valueField extraction
        sf_units: toMetricValue(row.sf_units),
        large_multi_units: toMetricValue(row.large_multi_units),
        total_units: toMetricValue(row.total_units),
        total_units_yoy: toMetricValue(row.total_units_yoy),
        sf_buildings: toMetricValue(row.sf_buildings),
        total_buildings: toMetricValue(row.total_buildings),
        total_value: toMetricValue(row.total_value),
      }));
      return { success: true, count: result.length, data: result };
    }

    const latestPeriod = await this.getLatestPeriod('permits_county');

    let query = this.supabase
      .from('permits_county')
      .select('*')
      .eq('period_date', latestPeriod);

    if (state) {
      const stateFips = toStateFips(state);
      query = query.eq('state_fips', stateFips);
    }

    const { data, error } = await query;

    if (error) throw error;

    const rows = (data || []) as PermitsRow[];
    this.setCache(cacheKey, rows);

    const result = rows.map((row) => ({
      region_id: String(row.fips_code || ''),
      region_name: String(row.county_name || ''),
      period_date: String(row.period_date || ''),
      fips_code: String(row.fips_code || ''),
      county_fips: String(row.fips_code || ''),
      state_fips: String(row.state_fips || ''),
      // Include all metric fields for valueField extraction
      sf_units: toMetricValue(row.sf_units),
      large_multi_units: toMetricValue(row.large_multi_units),
      total_units: toMetricValue(row.total_units),
      total_units_yoy: toMetricValue(row.total_units_yoy),
      sf_buildings: toMetricValue(row.sf_buildings),
      total_buildings: toMetricValue(row.total_buildings),
      total_value: toMetricValue(row.total_value),
    }));

    return { success: true, count: result.length, data: result };
  }

  // ============================================================================
  // Calculated Metrics
  // ============================================================================

  async getStateSfRatio(): Promise<{
    success: boolean;
    count: number;
    data: PermitsDataPoint[];
  }> {
    const latestPeriod = await this.getLatestPeriod('permits_state');

    const { data, error } = await this.supabase
      .from('permits_state')
      .select('state_fips, period_date, sf_units, total_units')
      .eq('period_date', latestPeriod);

    if (error) throw error;

    const result = ((data || []) as PermitsRow[])
      .map((row) => {
        const sfUnits = toMetricValue(row.sf_units);
        const totalUnits = toMetricValue(row.total_units);
        const sfRatio = sfUnits && totalUnits && totalUnits > 0
          ? (sfUnits / totalUnits) * 100
          : null;

        return {
          region_id: String(row.state_fips || ''),
          region_name: STATE_FIPS_TO_NAME[String(row.state_fips)] || String(row.state_fips),
          value: sfRatio,
          period_date: String(row.period_date || ''),
          state_fips: String(row.state_fips || ''),
          sf_ratio: sfRatio,
        };
      });

    return { success: true, count: result.length, data: result };
  }

  async getCountySfRatio(state?: string): Promise<{
    success: boolean;
    count: number;
    data: PermitsDataPoint[];
  }> {
    const latestPeriod = await this.getLatestPeriod('permits_county');

    let query = this.supabase
      .from('permits_county')
      .select('fips_code, county_name, state_fips, period_date, sf_units, total_units')
      .eq('period_date', latestPeriod);

    if (state) {
      const stateFips = toStateFips(state);
      query = query.eq('state_fips', stateFips);
    }

    const { data, error } = await query;

    if (error) throw error;

    const result = ((data || []) as PermitsRow[])
      .map((row) => {
        const sfUnits = toMetricValue(row.sf_units);
        const totalUnits = toMetricValue(row.total_units);
        const sfRatio = sfUnits && totalUnits && totalUnits > 0
          ? (sfUnits / totalUnits) * 100
          : null;

        return {
          region_id: String(row.fips_code || ''),
          region_name: String(row.county_name || ''),
          value: sfRatio,
          period_date: String(row.period_date || ''),
          fips_code: String(row.fips_code || ''),
          county_fips: String(row.fips_code || ''),
          state_fips: String(row.state_fips || ''),
          sf_ratio: sfRatio,
        };
      });

    return { success: true, count: result.length, data: result };
  }

  async getStateValuePerUnit(): Promise<{
    success: boolean;
    count: number;
    data: PermitsDataPoint[];
  }> {
    const latestPeriod = await this.getLatestPeriod('permits_state');

    const { data, error } = await this.supabase
      .from('permits_state')
      .select('state_fips, period_date, total_value, total_units')
      .eq('period_date', latestPeriod);

    if (error) throw error;

    const result = ((data || []) as PermitsRow[])
      .map((row) => {
        const totalValue = toMetricValue(row.total_value);
        const totalUnits = toMetricValue(row.total_units);
        const valuePerUnit = totalValue && totalUnits && totalUnits > 0
          ? totalValue / totalUnits
          : null;

        return {
          region_id: String(row.state_fips || ''),
          region_name: STATE_FIPS_TO_NAME[String(row.state_fips)] || String(row.state_fips),
          value: valuePerUnit,
          period_date: String(row.period_date || ''),
          state_fips: String(row.state_fips || ''),
          value_per_unit: valuePerUnit,
        };
      });

    return { success: true, count: result.length, data: result };
  }

  async getCountyValuePerUnit(state?: string): Promise<{
    success: boolean;
    count: number;
    data: PermitsDataPoint[];
  }> {
    const latestPeriod = await this.getLatestPeriod('permits_county');

    let query = this.supabase
      .from('permits_county')
      .select('fips_code, county_name, state_fips, period_date, total_value, total_units')
      .eq('period_date', latestPeriod);

    if (state) {
      const stateFips = toStateFips(state);
      query = query.eq('state_fips', stateFips);
    }

    const { data, error } = await query;

    if (error) throw error;

    const result = ((data || []) as PermitsRow[])
      .map((row) => {
        const totalValue = toMetricValue(row.total_value);
        const totalUnits = toMetricValue(row.total_units);
        const valuePerUnit = totalValue && totalUnits && totalUnits > 0
          ? totalValue / totalUnits
          : null;

        return {
          region_id: String(row.fips_code || ''),
          region_name: String(row.county_name || ''),
          value: valuePerUnit,
          period_date: String(row.period_date || ''),
          fips_code: String(row.fips_code || ''),
          county_fips: String(row.fips_code || ''),
          state_fips: String(row.state_fips || ''),
          value_per_unit: valuePerUnit,
        };
      });

    return { success: true, count: result.length, data: result };
  }
}
