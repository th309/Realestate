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
  sf_ratio?: number | null;
  value_per_unit?: number | null;
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

// Calculate total_units from component parts when null
// total = sf + duplex + small_multi + large_multi
function calculateTotalUnits(row: PermitsRow): number | null {
  const storedTotal = toMetricValue(row.total_units);
  if (storedTotal !== null) return storedTotal;

  // If total is null, compute from parts
  const sf = toMetricValue(row.sf_units) ?? 0;
  const duplex = toMetricValue(row.duplex_units) ?? 0;
  const smallMulti = toMetricValue(row.small_multi_units) ?? 0;
  const largeMf = toMetricValue(row.large_multi_units) ?? 0;

  // If all parts are 0 or null, return 0 (not null) since we have data for this county
  return sf + duplex + smallMulti + largeMf;
}

@Injectable()
export class PermitsService {
  private readonly CACHE_TTL = 60 * 60 * 1000; // 1 hour
  private readonly PAGE_SIZE = 1000; // Supabase default limit
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
  // National-Level Permits (aggregated from state data)
  // ============================================================================

  async getNationalPermits(): Promise<{
    success: boolean;
    count: number;
    data: any[];
  }> {
    const latestPeriod = await this.getLatestPeriod('permits_state');

    const { data, error } = await this.supabase
      .from('permits_state')
      .select('*')
      .eq('period_date', latestPeriod);

    if (error) throw error;

    const rows = (data || []) as PermitsRow[];

    // Aggregate all states into national totals
    let sfUnits = 0;
    let largeMultiUnits = 0;
    let totalUnits = 0;
    let sfBuildings = 0;
    let totalBuildings = 0;
    let totalValue = 0;

    rows.forEach((row) => {
      sfUnits += toMetricValue(row.sf_units) || 0;
      largeMultiUnits += toMetricValue(row.large_multi_units) || 0;
      totalUnits += calculateTotalUnits(row) || 0;
      sfBuildings += toMetricValue(row.sf_buildings) || 0;
      totalBuildings += toMetricValue(row.total_buildings) || 0;
      totalValue += toMetricValue(row.total_value) || 0;
    });

    // Calculate YoY by comparing to previous year's same month
    const currentDate = new Date(latestPeriod as string);
    const prevYear = new Date(currentDate);
    prevYear.setFullYear(prevYear.getFullYear() - 1);
    const prevPeriod = prevYear.toISOString().split('T')[0].slice(0, 7) + '-01';

    const { data: prevData } = await this.supabase
      .from('permits_state')
      .select('total_units, sf_units, duplex_units, small_multi_units, large_multi_units')
      .eq('period_date', prevPeriod);

    let prevTotalUnits = 0;
    ((prevData || []) as PermitsRow[]).forEach((row) => {
      prevTotalUnits += calculateTotalUnits(row) || 0;
    });

    const totalUnitsYoy = prevTotalUnits > 0
      ? ((totalUnits - prevTotalUnits) / prevTotalUnits) * 100
      : null;

    const result = [{
      region_id: 'US',
      region_name: 'United States',
      period_date: latestPeriod,
      sf_units: sfUnits,
      large_multi_units: largeMultiUnits,
      total_units: totalUnits,
      total_units_yoy: totalUnitsYoy,
      sf_buildings: sfBuildings,
      total_buildings: totalBuildings,
      total_value: totalValue,
    }];

    return { success: true, count: 1, data: result };
  }

  async getNationalSfRatio(): Promise<{
    success: boolean;
    count: number;
    data: PermitsDataPoint[];
  }> {
    const { data: permitsData } = await this.getNationalPermits();
    const national = permitsData[0];

    const sfRatio = national.sf_units && national.total_units && national.total_units > 0
      ? (national.sf_units / national.total_units) * 100
      : null;

    return {
      success: true,
      count: 1,
      data: [{
        region_id: 'US',
        region_name: 'United States',
        value: sfRatio,
        period_date: national.period_date,
        sf_ratio: sfRatio,
      }],
    };
  }

  async getNationalValuePerUnit(): Promise<{
    success: boolean;
    count: number;
    data: PermitsDataPoint[];
  }> {
    const { data: permitsData } = await this.getNationalPermits();
    const national = permitsData[0];

    const valuePerUnit = national.total_value && national.total_units && national.total_units > 0
      ? Math.round(national.total_value / national.total_units)
      : null;

    return {
      success: true,
      count: 1,
      data: [{
        region_id: 'US',
        region_name: 'United States',
        value: valuePerUnit,
        period_date: national.period_date,
        value_per_unit: valuePerUnit,
      }],
    };
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
        total_units: calculateTotalUnits(row),
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
      total_units: calculateTotalUnits(row),
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
        total_units: calculateTotalUnits(row),
        total_units_yoy: toMetricValue(row.total_units_yoy),
        sf_buildings: toMetricValue(row.sf_buildings),
        total_buildings: toMetricValue(row.total_buildings),
        total_value: toMetricValue(row.total_value),
      }));
      return { success: true, count: result.length, data: result };
    }

    const latestPeriod = await this.getLatestPeriod('permits_county');

    // Paginate to get all counties (Supabase has 1000 row default limit)
    const allRows: PermitsRow[] = [];
    let offset = 0;

    while (true) {
      let query = this.supabase
        .from('permits_county')
        .select('*')
        .eq('period_date', latestPeriod);

      if (state) {
        const stateFips = toStateFips(state);
        query = query.eq('state_fips', stateFips);
      }

      const { data, error } = await query.range(offset, offset + this.PAGE_SIZE - 1);

      if (error) throw error;

      const pageData = (data || []) as PermitsRow[];
      allRows.push(...pageData);

      if (pageData.length < this.PAGE_SIZE) break;
      offset += this.PAGE_SIZE;
    }

    this.setCache(cacheKey, allRows);

    const result = allRows.map((row) => ({
      region_id: String(row.fips_code || ''),
      region_name: String(row.county_name || ''),
      period_date: String(row.period_date || ''),
      fips_code: String(row.fips_code || ''),
      county_fips: String(row.fips_code || ''),
      state_fips: String(row.state_fips || ''),
      // Include all metric fields for valueField extraction
      sf_units: toMetricValue(row.sf_units),
      large_multi_units: toMetricValue(row.large_multi_units),
      total_units: calculateTotalUnits(row),
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
      .select('state_fips, period_date, sf_units, duplex_units, small_multi_units, large_multi_units, total_units')
      .eq('period_date', latestPeriod);

    if (error) throw error;

    const result = ((data || []) as PermitsRow[])
      .map((row) => {
        const sfUnits = toMetricValue(row.sf_units);
        const totalUnits = calculateTotalUnits(row);
        const sfRatio = sfUnits !== null && totalUnits !== null && totalUnits > 0
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

    // Paginate to get all counties
    const allRows: PermitsRow[] = [];
    let offset = 0;

    while (true) {
      let query = this.supabase
        .from('permits_county')
        .select('fips_code, county_name, state_fips, period_date, sf_units, duplex_units, small_multi_units, large_multi_units, total_units')
        .eq('period_date', latestPeriod);

      if (state) {
        const stateFips = toStateFips(state);
        query = query.eq('state_fips', stateFips);
      }

      const { data, error } = await query.range(offset, offset + this.PAGE_SIZE - 1);

      if (error) throw error;

      const pageData = (data || []) as PermitsRow[];
      allRows.push(...pageData);

      if (pageData.length < this.PAGE_SIZE) break;
      offset += this.PAGE_SIZE;
    }

    const result = allRows.map((row) => {
      const sfUnits = toMetricValue(row.sf_units);
      const totalUnits = calculateTotalUnits(row);
      const sfRatio = sfUnits !== null && totalUnits !== null && totalUnits > 0
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
      .select('state_fips, period_date, total_value, sf_units, duplex_units, small_multi_units, large_multi_units, total_units')
      .eq('period_date', latestPeriod);

    if (error) throw error;

    const result = ((data || []) as PermitsRow[])
      .map((row) => {
        const totalValue = toMetricValue(row.total_value);
        const totalUnits = calculateTotalUnits(row);
        const valuePerUnit = totalValue !== null && totalUnits !== null && totalUnits > 0
          ? Math.round(totalValue / totalUnits)
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

    // Paginate to get all counties
    const allRows: PermitsRow[] = [];
    let offset = 0;

    while (true) {
      let query = this.supabase
        .from('permits_county')
        .select('fips_code, county_name, state_fips, period_date, total_value, sf_units, duplex_units, small_multi_units, large_multi_units, total_units')
        .eq('period_date', latestPeriod);

      if (state) {
        const stateFips = toStateFips(state);
        query = query.eq('state_fips', stateFips);
      }

      const { data, error } = await query.range(offset, offset + this.PAGE_SIZE - 1);

      if (error) throw error;

      const pageData = (data || []) as PermitsRow[];
      allRows.push(...pageData);

      if (pageData.length < this.PAGE_SIZE) break;
      offset += this.PAGE_SIZE;
    }

    const result = allRows.map((row) => {
      const totalValue = toMetricValue(row.total_value);
      const totalUnits = calculateTotalUnits(row);
      const valuePerUnit = totalValue !== null && totalUnits !== null && totalUnits > 0
        ? Math.round(totalValue / totalUnits)
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
