import { Injectable, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';
import { normalizeStateToFips, STATE_FIPS_TO_NAME } from '../common/geo.js';

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

  /**
   * Calculate YoY for rows where it's NULL in the database.
   * This ensures we show YoY data for all counties/states that have current year data,
   * even if the YoY wasn't backfilled in the database.
   * Uses batch fetching for efficiency.
   */
  private async enrichYoYData(
    rows: PermitsRow[],
    table: 'permits_state' | 'permits_county',
    currentPeriod: string,
    idField: 'state_fips' | 'fips_code'
  ): Promise<void> {
    // Check if any rows need YoY calculation
    const needsYoY = rows.some(row => toMetricValue(row.total_units_yoy) === null);
    if (!needsYoY) {
      return; // All rows already have YoY
    }

    // Calculate previous year period
    const currentDate = new Date(currentPeriod);
    const prevYear = new Date(currentDate);
    prevYear.setFullYear(prevYear.getFullYear() - 1);
    const prevPeriod = prevYear.toISOString().split('T')[0].slice(0, 7) + '-01';

    // Get IDs that need YoY calculation
    const idsNeedingYoY = rows
      .filter(row => toMetricValue(row.total_units_yoy) === null)
      .map(row => String(row[idField]));

    if (idsNeedingYoY.length === 0) {
      return;
    }

    // Batch fetch previous year data for all regions that need it
    // Paginate if needed (Supabase has 1000 row limit)
    const prevYearDataMap = new Map<string, PermitsRow>();
    let offset = 0;

    while (true) {
      let query = this.supabase
        .from(table)
        .select(`${idField}, sf_units, duplex_units, small_multi_units, large_multi_units, total_units`)
        .eq('period_date', prevPeriod)
        .in(idField, idsNeedingYoY);

      const { data: prevData, error } = await query.range(offset, offset + this.PAGE_SIZE - 1);

      if (error) {
        console.error(`Error fetching previous year data for YoY calculation:`, error);
        break; // Continue without YoY enrichment rather than failing
      }

      if (!prevData || prevData.length === 0) {
        break;
      }

      (prevData as PermitsRow[]).forEach((prevRow) => {
        const id = String(prevRow[idField]);
        prevYearDataMap.set(id, prevRow);
      });

      if (prevData.length < this.PAGE_SIZE) {
        break;
      }
      offset += this.PAGE_SIZE;
    }

    // Calculate YoY for rows that need it
    rows.forEach((row) => {
      const storedYoY = toMetricValue(row.total_units_yoy);
      if (storedYoY !== null) {
        return; // Already has YoY
      }

      const id = String(row[idField]);
      const prevRow = prevYearDataMap.get(id);

      if (!prevRow) {
        return; // No previous year data available
      }

      const currentTotal = calculateTotalUnits(row);
      const prevTotal = calculateTotalUnits(prevRow);

      if (currentTotal === null) {
        return; // Can't calculate without current year data
      }

      if (prevTotal === null || prevTotal === 0) {
        // If previous year was 0 and current > 0, this is "new activity" (100% growth)
        if (currentTotal > 0) {
          row.total_units_yoy = 100;
        } else {
          // Both are 0, YoY is 0
          row.total_units_yoy = 0;
        }
        return;
      }

      // Calculate YoY percentage
      row.total_units_yoy = Math.round(((currentTotal - prevTotal) / prevTotal) * 100 * 100) / 100;
    });
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

    const sfUnits = national.sf_units ?? 0; // Treat null as 0 (all MF)
    const totalUnits = national.total_units ?? 0;
    
    // Calculate SF ratio: if totalUnits > 0, calculate ratio
    // If sfUnits is null/0, ratio will be 0% (meaning 0% SF, 100% MF)
    const sfRatio = totalUnits > 0
      ? (sfUnits / totalUnits) * 100
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
    
    const latestPeriod = await this.getLatestPeriod('permits_state');
    
    if (cached) {
      // Still enrich YoY for cached data if needed (in case YoY wasn't backfilled)
      if (latestPeriod) {
        await this.enrichYoYData(cached, 'permits_state', latestPeriod, 'state_fips');
      }
      
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

    const { data, error } = await this.supabase
      .from('permits_state')
      .select('*')
      .eq('period_date', latestPeriod);

    if (error) throw error;

    const rows = (data || []) as PermitsRow[];
    
    // Enrich YoY data for rows where it's NULL
    if (latestPeriod) {
      await this.enrichYoYData(rows, 'permits_state', latestPeriod, 'state_fips');
    }
    
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
    
    const latestPeriod = await this.getLatestPeriod('permits_county');
    
    if (cached) {
      // Still enrich YoY for cached data if needed (in case YoY wasn't backfilled)
      if (latestPeriod) {
        await this.enrichYoYData(cached, 'permits_county', latestPeriod, 'fips_code');
      }
      
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

    // Paginate to get all counties (Supabase has 1000 row default limit)
    const allRows: PermitsRow[] = [];
    let offset = 0;

    while (true) {
      let query = this.supabase
        .from('permits_county')
        .select('*')
        .eq('period_date', latestPeriod);

      if (state) {
        const stateFips = normalizeStateToFips(state);
        query = query.eq('state_fips', stateFips);
      }

      const { data, error } = await query.range(offset, offset + this.PAGE_SIZE - 1);

      if (error) throw error;

      const pageData = (data || []) as PermitsRow[];
      allRows.push(...pageData);

      if (pageData.length < this.PAGE_SIZE) break;
      offset += this.PAGE_SIZE;
    }

    // Enrich YoY data for rows where it's NULL
    if (latestPeriod) {
      await this.enrichYoYData(allRows, 'permits_county', latestPeriod, 'fips_code');
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
        const sfUnits = toMetricValue(row.sf_units) ?? 0; // Treat null as 0 (all MF)
        const totalUnits = calculateTotalUnits(row);
        
        // Calculate SF ratio: if totalUnits exists and > 0, calculate ratio
        // If sfUnits is null, treat as 0 (meaning 0% SF, 100% MF)
        const sfRatio = totalUnits !== null && totalUnits > 0
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
        const stateFips = normalizeStateToFips(state);
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
      const sfUnits = toMetricValue(row.sf_units) ?? 0; // Treat null as 0 (all MF)
      const totalUnits = calculateTotalUnits(row);
      
      // Calculate SF ratio: if totalUnits exists and > 0, calculate ratio
      // If sfUnits is null, treat as 0 (meaning 0% SF, 100% MF)
      const sfRatio = totalUnits !== null && totalUnits > 0
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
        const stateFips = normalizeStateToFips(state);
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
