import { Injectable, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';
import { normalizeZipKey } from '../common/zip';
import { normalizeStateToCode } from '../common/geo';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

/**
 * Inventory Surplus Calculation Service
 *
 * Calculates and stores inventory surplus/deficit for all geographic levels.
 * Formula: Current Inventory - Historical Average Inventory
 *
 * Positive values = more inventory than typical (buyer's market)
 * Negative values = less inventory than typical (seller's market)
 */
@Injectable()
export class InventorySurplusService {
  private readonly PAGE_SIZE = 1000;
  private readonly BATCH_SIZE = 100;
  private readonly CACHE_TTL = 4 * 60 * 60 * 1000; // 4 hours

  // In-memory cache for fast repeated queries
  private cache = new Map<string, CacheEntry<any[]>>();
  private latestDateCache = new Map<string, CacheEntry<string>>();

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  // ============================================================================
  // CACHE HELPERS
  // ============================================================================

  private getCached<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > this.CACHE_TTL) {
      this.cache.delete(key);
      return null;
    }
    return entry.data as T;
  }

  private setCache<T>(key: string, data: T): void {
    this.cache.set(key, { data: data as any, timestamp: Date.now() });
  }

  private getCachedDate(key: string): string | null {
    const entry = this.latestDateCache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > this.CACHE_TTL) {
      this.latestDateCache.delete(key);
      return null;
    }
    return entry.data;
  }

  private setCachedDate(key: string, date: string): void {
    this.latestDateCache.set(key, { data: date, timestamp: Date.now() });
  }

  // ============================================================================
  // CALCULATION HELPERS
  // ============================================================================

  /**
   * Calculate 5-year average inventory for a specific month
   * Uses same month across 5 previous years for seasonality adjustment
   */
  private calculate5YearAverage(values: number[]): number | null {
    if (!values || values.length === 0) return null;
    const sum = values.reduce((acc, val) => acc + val, 0);
    return sum / values.length;
  }

  /**
   * Get historical inventory data for the same month across multiple years
   */
  private async getHistoricalInventory(
    table: string,
    idField: string,
    targetYear: number,
    targetMonth: number,
    targetDay: number,
    yearsBack: number = 5,
  ): Promise<Map<string, number[]>> {
    const historicalByRegion = new Map<string, number[]>();

    // Build date filters for same month in previous years (before current data year)
    const dateFilters: string[] = [];

    for (let i = 1; i <= yearsBack; i++) {
      const year = targetYear - i;
      const month = String(targetMonth).padStart(2, '0');
      const day = String(targetDay).padStart(2, '0');
      dateFilters.push(`${year}-${month}-${day}`);
    }

    // Query historical data for each year
    for (const dateStr of dateFilters) {
      const { data } = await this.supabase
        .from(table)
        .select('*')
        .eq('period_date', dateStr)
        .not('active_listing_count', 'is', null);

      if (data) {
        for (const row of data) {
          const regionId = row[idField];
          const count = row.active_listing_count;

          if (!historicalByRegion.has(regionId)) {
            historicalByRegion.set(regionId, []);
          }
          historicalByRegion.get(regionId)!.push(count);
        }
      }
    }

    return historicalByRegion;
  }

  /**
   * Calculate and store inventory surplus for all metros
   */
  async calculateForMetros(): Promise<{
    processed: number;
    stored: number;
    debug?: any;
  }> {
    // Get latest period date
    const { data: latestDateRow } = await this.supabase
      .from('realtor_metro')
      .select('period_date')
      .order('period_date', { ascending: false })
      .limit(1)
      .single();

    if (!latestDateRow?.period_date) {
      return {
        processed: 0,
        stored: 0,
        debug: { error: 'No latest date found' },
      };
    }

    const targetDate = new Date(latestDateRow.period_date);
    const targetYear = targetDate.getUTCFullYear();
    const targetMonth = targetDate.getUTCMonth() + 1;
    const targetDay = targetDate.getUTCDate();

    console.log(
      `[InventorySurplus] Target date: ${latestDateRow.period_date}, Year: ${targetYear}, Month: ${targetMonth}, Day: ${targetDay}`,
    );

    // Get current inventory data
    const { data: currentData } = await this.supabase
      .from('realtor_metro')
      .select('cbsa_code, cbsa_title, active_listing_count')
      .eq('period_date', latestDateRow.period_date)
      .not('active_listing_count', 'is', null);

    if (!currentData || currentData.length === 0) {
      return {
        processed: 0,
        stored: 0,
        debug: { error: 'No current data found' },
      };
    }

    console.log(
      `[InventorySurplus] Found ${currentData.length} metros with current data`,
    );

    // Get historical data (same month in previous 5 years)
    const historicalByRegion = await this.getHistoricalInventory(
      'realtor_metro',
      'cbsa_code',
      targetYear,
      targetMonth,
      targetDay,
    );

    console.log(
      `[InventorySurplus] Historical data for ${historicalByRegion.size} regions`,
    );

    // Calculate and store
    let stored = 0;
    let skippedNoHistory = 0;
    const upsertErrors: string[] = [];
    const recordsToUpsert: any[] = [];

    for (const metro of currentData) {
      const historicalValues = historicalByRegion.get(metro.cbsa_code);
      const avg = this.calculate5YearAverage(historicalValues || []);

      if (avg === null) {
        skippedNoHistory++;
        continue;
      }

      // Calculate as percentage: ((current - avg) / avg) * 100
      const surplusPct = ((metro.active_listing_count - avg) / avg) * 100;

      recordsToUpsert.push({
        geography_id: metro.cbsa_code,
        geography_type: 'metro',
        geography_name: metro.cbsa_title,
        period_date: latestDateRow.period_date,
        inventory_surplus_pct: Math.round(surplusPct * 100) / 100, // 2 decimal places
        calculated_at: new Date().toISOString(),
      });

      if (recordsToUpsert.length >= this.BATCH_SIZE) {
        const { error } = await this.supabase
          .from('calculated_metrics')
          .upsert(recordsToUpsert, {
            onConflict: 'geography_id,geography_type,period_date',
          });
        if (error) {
          upsertErrors.push(error.message);
          console.error(`[InventorySurplus] Upsert error: ${error.message}`);
        } else {
          stored += recordsToUpsert.length;
        }
        recordsToUpsert.length = 0;
      }
    }

    // Upsert remaining records
    if (recordsToUpsert.length > 0) {
      const { error } = await this.supabase
        .from('calculated_metrics')
        .upsert(recordsToUpsert, {
          onConflict: 'geography_id,geography_type,period_date',
        });
      if (error) {
        upsertErrors.push(error.message);
        console.error(
          `[InventorySurplus] Final upsert error: ${error.message}`,
        );
      } else {
        stored += recordsToUpsert.length;
      }
    }

    console.log(
      `[InventorySurplus] Processed: ${currentData.length}, Stored: ${stored}, SkippedNoHistory: ${skippedNoHistory}`,
    );

    return {
      processed: currentData.length,
      stored,
      debug: {
        targetDate: latestDateRow.period_date,
        targetYear,
        targetMonth,
        targetDay,
        historicalRegions: historicalByRegion.size,
        skippedNoHistory,
        upsertErrors: upsertErrors.length > 0 ? upsertErrors : undefined,
      },
    };
  }

  /**
   * Calculate and store inventory surplus for national level
   */
  async calculateForNational(): Promise<{ processed: number; stored: number }> {
    const { data: latestDateRow } = await this.supabase
      .from('realtor_national')
      .select('period_date')
      .order('period_date', { ascending: false })
      .limit(1)
      .single();

    if (!latestDateRow?.period_date) {
      return { processed: 0, stored: 0 };
    }

    const targetDate = new Date(latestDateRow.period_date);
    const targetYear = targetDate.getUTCFullYear();
    const targetMonth = targetDate.getUTCMonth() + 1;
    const targetDay = targetDate.getUTCDate();

    // Get current national inventory
    const { data: currentData } = await this.supabase
      .from('realtor_national')
      .select('country, active_listing_count')
      .eq('period_date', latestDateRow.period_date)
      .not('active_listing_count', 'is', null);

    if (!currentData || currentData.length === 0) {
      return { processed: 0, stored: 0 };
    }

    // Get historical data for national level
    const historicalValues: number[] = [];
    for (let i = 1; i <= 5; i++) {
      const year = targetYear - i;
      const month = String(targetMonth).padStart(2, '0');
      const day = String(targetDay).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;

      const { data } = await this.supabase
        .from('realtor_national')
        .select('active_listing_count')
        .eq('period_date', dateStr)
        .not('active_listing_count', 'is', null)
        .single();

      if (data?.active_listing_count) {
        historicalValues.push(data.active_listing_count);
      }
    }

    let stored = 0;
    for (const national of currentData) {
      const avg = this.calculate5YearAverage(historicalValues);

      if (avg === null) continue;

      // Calculate as percentage: ((current - avg) / avg) * 100
      const surplusPct = ((national.active_listing_count - avg) / avg) * 100;

      const { error } = await this.supabase.from('calculated_metrics').upsert(
        {
          geography_id: 'US',
          geography_type: 'national',
          geography_name: national.country || 'United States',
          period_date: latestDateRow.period_date,
          inventory_surplus_pct: Math.round(surplusPct * 100) / 100,
          calculated_at: new Date().toISOString(),
        },
        { onConflict: 'geography_id,geography_type,period_date' },
      );

      if (!error) stored++;
    }

    return { processed: currentData.length, stored };
  }

  /**
   * Calculate and store inventory surplus for all states
   */
  async calculateForStates(): Promise<{ processed: number; stored: number }> {
    const { data: latestDateRow } = await this.supabase
      .from('realtor_state')
      .select('period_date')
      .order('period_date', { ascending: false })
      .limit(1)
      .single();

    if (!latestDateRow?.period_date) {
      return { processed: 0, stored: 0 };
    }

    const targetDate = new Date(latestDateRow.period_date);
    const targetYear = targetDate.getUTCFullYear();
    const targetMonth = targetDate.getUTCMonth() + 1;
    const targetDay = targetDate.getUTCDate();

    const { data: currentData } = await this.supabase
      .from('realtor_state')
      .select('state_id, state_name, active_listing_count')
      .eq('period_date', latestDateRow.period_date)
      .not('active_listing_count', 'is', null);

    if (!currentData || currentData.length === 0) {
      return { processed: 0, stored: 0 };
    }

    const historicalByRegion = await this.getHistoricalInventory(
      'realtor_state',
      'state_id',
      targetYear,
      targetMonth,
      targetDay,
    );

    let stored = 0;
    for (const state of currentData) {
      const historicalValues = historicalByRegion.get(state.state_id);
      const avg = this.calculate5YearAverage(historicalValues || []);

      if (avg === null) continue;

      // Calculate as percentage: ((current - avg) / avg) * 100
      const surplusPct = ((state.active_listing_count - avg) / avg) * 100;

      const { error } = await this.supabase.from('calculated_metrics').upsert(
        {
          geography_id: state.state_id,
          geography_type: 'state',
          geography_name: state.state_name,
          period_date: latestDateRow.period_date,
          inventory_surplus_pct: Math.round(surplusPct * 100) / 100,
          calculated_at: new Date().toISOString(),
        },
        { onConflict: 'geography_id,geography_type,period_date' },
      );

      if (!error) stored++;
    }

    return { processed: currentData.length, stored };
  }

  /**
   * Calculate and store inventory surplus for all counties (paginated)
   */
  async calculateForCounties(): Promise<{ processed: number; stored: number }> {
    const { data: latestDateRow } = await this.supabase
      .from('realtor_county')
      .select('period_date')
      .order('period_date', { ascending: false })
      .limit(1)
      .single();

    if (!latestDateRow?.period_date) {
      return { processed: 0, stored: 0 };
    }

    const targetDate = new Date(latestDateRow.period_date);
    const targetYear = targetDate.getUTCFullYear();
    const targetMonth = targetDate.getUTCMonth() + 1;
    const targetDay = targetDate.getUTCDate();

    // Get all current data (paginated)
    const allCurrentData: any[] = [];
    let offset = 0;
    while (true) {
      const { data: pageData } = await this.supabase
        .from('realtor_county')
        .select('county_fips, county_name, active_listing_count')
        .eq('period_date', latestDateRow.period_date)
        .not('active_listing_count', 'is', null)
        .range(offset, offset + this.PAGE_SIZE - 1);

      if (!pageData || pageData.length === 0) break;
      allCurrentData.push(...pageData);
      if (pageData.length < this.PAGE_SIZE) break;
      offset += this.PAGE_SIZE;
    }

    if (allCurrentData.length === 0) {
      return { processed: 0, stored: 0 };
    }

    // Get historical data (paginated for each year)
    const historicalByRegion = await this.getHistoricalInventoryPaginated(
      'realtor_county',
      'county_fips',
      targetYear,
      targetMonth,
      targetDay,
    );

    // Calculate and batch upsert
    let stored = 0;
    const recordsToUpsert: any[] = [];

    for (const county of allCurrentData) {
      const historicalValues = historicalByRegion.get(county.county_fips);
      const avg = this.calculate5YearAverage(historicalValues || []);

      if (avg === null) continue;

      // Calculate as percentage: ((current - avg) / avg) * 100
      const surplusPct = ((county.active_listing_count - avg) / avg) * 100;

      recordsToUpsert.push({
        geography_id: county.county_fips,
        geography_type: 'county',
        geography_name: county.county_name,
        period_date: latestDateRow.period_date,
        inventory_surplus_pct: Math.round(surplusPct * 100) / 100,
        calculated_at: new Date().toISOString(),
      });

      if (recordsToUpsert.length >= this.BATCH_SIZE) {
        const { error } = await this.supabase
          .from('calculated_metrics')
          .upsert(recordsToUpsert, {
            onConflict: 'geography_id,geography_type,period_date',
          });
        if (!error) stored += recordsToUpsert.length;
        recordsToUpsert.length = 0;
      }
    }

    if (recordsToUpsert.length > 0) {
      const { error } = await this.supabase
        .from('calculated_metrics')
        .upsert(recordsToUpsert, {
          onConflict: 'geography_id,geography_type,period_date',
        });
      if (!error) stored += recordsToUpsert.length;
    }

    return { processed: allCurrentData.length, stored };
  }

  /**
   * Calculate and store inventory surplus for all zip codes (paginated)
   */
  async calculateForZips(): Promise<{ processed: number; stored: number }> {
    const { data: latestDateRow } = await this.supabase
      .from('realtor_zip')
      .select('period_date')
      .order('period_date', { ascending: false })
      .limit(1)
      .single();

    if (!latestDateRow?.period_date) {
      return { processed: 0, stored: 0 };
    }

    const targetDate = new Date(latestDateRow.period_date);
    const targetYear = targetDate.getUTCFullYear();
    const targetMonth = targetDate.getUTCMonth() + 1;
    const targetDay = targetDate.getUTCDate();

    // Get all current data (paginated)
    const allCurrentData: any[] = [];
    let offset = 0;
    while (true) {
      const { data: pageData } = await this.supabase
        .from('realtor_zip')
        .select('postal_code, zip_name, active_listing_count')
        .eq('period_date', latestDateRow.period_date)
        .not('active_listing_count', 'is', null)
        .range(offset, offset + this.PAGE_SIZE - 1);

      if (!pageData || pageData.length === 0) break;
      allCurrentData.push(...pageData);
      if (pageData.length < this.PAGE_SIZE) break;
      offset += this.PAGE_SIZE;
    }

    if (allCurrentData.length === 0) {
      return { processed: 0, stored: 0 };
    }

    // Get historical data (paginated)
    const historicalByRegion = await this.getHistoricalInventoryPaginated(
      'realtor_zip',
      'postal_code',
      targetYear,
      targetMonth,
      targetDay,
    );

    // Calculate and batch upsert
    let stored = 0;
    const recordsToUpsert: any[] = [];

    for (const zip of allCurrentData) {
      const historicalValues = historicalByRegion.get(zip.postal_code);
      const avg = this.calculate5YearAverage(historicalValues || []);

      if (avg === null) continue;

      // Calculate as percentage: ((current - avg) / avg) * 100
      const surplusPct = ((zip.active_listing_count - avg) / avg) * 100;

      recordsToUpsert.push({
        geography_id: normalizeZipKey(String(zip.postal_code)),
        geography_type: 'zip',
        geography_name: zip.zip_name,
        period_date: latestDateRow.period_date,
        inventory_surplus_pct: Math.round(surplusPct * 100) / 100,
        calculated_at: new Date().toISOString(),
      });

      if (recordsToUpsert.length >= this.BATCH_SIZE) {
        const { error } = await this.supabase
          .from('calculated_metrics')
          .upsert(recordsToUpsert, {
            onConflict: 'geography_id,geography_type,period_date',
          });
        if (!error) stored += recordsToUpsert.length;
        recordsToUpsert.length = 0;
      }
    }

    if (recordsToUpsert.length > 0) {
      const { error } = await this.supabase
        .from('calculated_metrics')
        .upsert(recordsToUpsert, {
          onConflict: 'geography_id,geography_type,period_date',
        });
      if (!error) stored += recordsToUpsert.length;
    }

    return { processed: allCurrentData.length, stored };
  }

  /**
   * Get historical inventory data with pagination (for large tables)
   */
  private async getHistoricalInventoryPaginated(
    table: string,
    idField: string,
    targetYear: number,
    targetMonth: number,
    targetDay: number,
    yearsBack: number = 5,
  ): Promise<Map<string, number[]>> {
    const historicalByRegion = new Map<string, number[]>();

    for (let i = 1; i <= yearsBack; i++) {
      const year = targetYear - i;
      const month = String(targetMonth).padStart(2, '0');
      const day = String(targetDay).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;

      let offset = 0;
      while (true) {
        const { data } = await this.supabase
          .from(table)
          .select('*')
          .eq('period_date', dateStr)
          .not('active_listing_count', 'is', null)
          .range(offset, offset + this.PAGE_SIZE - 1);

        if (!data || data.length === 0) break;

        for (const row of data) {
          const regionId = row[idField];
          const count = row.active_listing_count;

          if (!historicalByRegion.has(regionId)) {
            historicalByRegion.set(regionId, []);
          }
          historicalByRegion.get(regionId)!.push(count);
        }

        if (data.length < this.PAGE_SIZE) break;
        offset += this.PAGE_SIZE;
      }
    }

    return historicalByRegion;
  }

  /**
   * Calculate inventory surplus for all geographies
   */
  async calculateForAll(): Promise<{
    national: { processed: number; stored: number };
    metros: { processed: number; stored: number };
    states: { processed: number; stored: number };
    counties: { processed: number; stored: number };
    zips: { processed: number; stored: number };
  }> {
    const [national, metros, states, counties, zips] = await Promise.all([
      this.calculateForNational(),
      this.calculateForMetros(),
      this.calculateForStates(),
      this.calculateForCounties(),
      this.calculateForZips(),
    ]);

    return { national, metros, states, counties, zips };
  }

  /**
   * Get pre-calculated inventory surplus data for map display
   * For ZIP geography, pass state to filter at database level for faster queries
   */
  async getForMap(
    geographyType: 'national' | 'metro' | 'state' | 'county' | 'zip',
    state?: string,
  ): Promise<{ data: any[]; success: boolean; source: string }> {
    if (state) state = normalizeStateToCode(state);
    // For zip, do not filter by state: return all zips for the date so the map can look up by postal_code
    // (map only loads state-specific GeoJSON and uses mapData[zipCode] - same as income-to-buy)
    const cacheKey =
      geographyType === 'zip'
        ? `inventory_surplus:zip`
        : state
          ? `inventory_surplus:${geographyType}:${state.toLowerCase()}`
          : `inventory_surplus:${geographyType}`;

    // Check cache first
    const cached = this.getCached<any[]>(cacheKey);
    if (cached) {
      return {
        data: cached,
        success: true,
        source: 'calculated_metrics (cached)',
      };
    }

    // Get the latest period_date for this geography type (with caching)
    const dateCacheKey = `inventory_surplus_date:${geographyType}`;
    let latestDate = this.getCachedDate(dateCacheKey);

    if (!latestDate) {
      const { data: latestRow } = await this.supabase
        .from('calculated_metrics')
        .select('period_date')
        .eq('geography_type', geographyType)
        .not('inventory_surplus_pct', 'is', null)
        .order('period_date', { ascending: false })
        .limit(1)
        .single();

      if (!latestRow?.period_date) {
        return { data: [], success: false, source: 'calculated_metrics' };
      }
      latestDate = latestRow.period_date;
      this.setCachedDate(dateCacheKey, latestDate!);
    }

    // At this point latestDate is guaranteed to be a string
    const effectiveDate: string = latestDate!;

    // ZIP: return all zips for the date (no state filter). Map uses state-specific GeoJSON and looks up by postal_code.
    // Get all data for that period (paginated for large datasets)
    const allData: any[] = [];
    let offset = 0;

    while (true) {
      const { data: pageData } = await this.supabase
        .from('calculated_metrics')
        .select(
          'geography_id, geography_name, inventory_surplus_pct, period_date',
        )
        .eq('geography_type', geographyType)
        .eq('period_date', effectiveDate)
        .not('inventory_surplus_pct', 'is', null)
        .range(offset, offset + this.PAGE_SIZE - 1);

      if (!pageData || pageData.length === 0) break;
      allData.push(...pageData);
      if (pageData.length < this.PAGE_SIZE) break;
      offset += this.PAGE_SIZE;
    }

    // Transform to API format
    const results = this.transformToApiFormat(allData, geographyType);
    this.setCache(cacheKey, results);

    return { data: results, success: true, source: 'calculated_metrics' };
  }

  /**
   * Fetch ZIP inventory surplus data filtered by state at database level
   * This is MUCH faster than loading all 28,000+ ZIPs and filtering in memory
   */
  private async fetchZipsByState(
    periodDate: string,
    state: string,
  ): Promise<any[]> {
    // geography_name format is "city, ST" so we use ilike to match state suffix
    const statePattern = `%, ${state.toLowerCase()}`;
    const allData: any[] = [];
    let offset = 0;

    while (true) {
      const { data: pageData } = await this.supabase
        .from('calculated_metrics')
        .select(
          'geography_id, geography_name, inventory_surplus_pct, period_date',
        )
        .eq('geography_type', 'zip')
        .eq('period_date', periodDate)
        .ilike('geography_name', statePattern)
        .not('inventory_surplus_pct', 'is', null)
        .range(offset, offset + this.PAGE_SIZE - 1);

      if (!pageData || pageData.length === 0) break;
      allData.push(...pageData);
      if (pageData.length < this.PAGE_SIZE) break;
      offset += this.PAGE_SIZE;
    }

    return this.transformToApiFormat(allData, 'zip');
  }

  /**
   * Transform database rows to API format
   */
  private transformToApiFormat(rows: any[], geographyType: string): any[] {
    return rows.map((row) => ({
      region_id: row.geography_id,
      region_name: row.geography_name,
      value: row.inventory_surplus_pct,
      inventory_surplus: row.inventory_surplus_pct,
      date: row.period_date,
      // Add geo-specific fields for key matching
      ...(geographyType === 'metro' ? { cbsa_code: row.geography_id } : {}),
      ...(geographyType === 'county' ? { county_fips: row.geography_id } : {}),
      ...(geographyType === 'zip' ? { postal_code: row.geography_id } : {}),
    }));
  }
}
