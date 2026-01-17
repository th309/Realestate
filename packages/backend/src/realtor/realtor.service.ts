import { Injectable, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.module';

export interface RealtorDataPoint {
  region_id: string;
  region_name: string;
  value: number;
  date?: string;
  state_id?: string;
  cbsa_code?: string;
  county_fips?: string;
  postal_code?: string;
}

// Type for generic row data from Supabase
interface RealtorRow {
  [key: string]: unknown;
}

// Cache entry with TTL
interface CacheEntry<T> {
  data: T;
  expiry: number;
}

@Injectable()
export class RealtorService {
  private readonly PAGE_SIZE = 1000; // Supabase default max
  private readonly PARALLEL_PAGES = 5; // Fetch 5 pages concurrently
  private readonly CACHE_TTL = 4 * 60 * 60 * 1000; // 4 hours in ms
  private cache = new Map<string, CacheEntry<RealtorRow[]>>();
  // Cache for latest dates per table (avoids redundant date queries)
  private latestDateCache = new Map<string, CacheEntry<string>>();

  // FIPS code to state abbreviation mapping (realtor_state uses abbreviations, not FIPS)
  private readonly fipsToAbbr: Record<string, string> = {
    '01': 'AL', '02': 'AK', '04': 'AZ', '05': 'AR', '06': 'CA',
    '08': 'CO', '09': 'CT', '10': 'DE', '11': 'DC', '12': 'FL',
    '13': 'GA', '15': 'HI', '16': 'ID', '17': 'IL', '18': 'IN',
    '19': 'IA', '20': 'KS', '21': 'KY', '22': 'LA', '23': 'ME',
    '24': 'MD', '25': 'MA', '26': 'MI', '27': 'MN', '28': 'MS',
    '29': 'MO', '30': 'MT', '31': 'NE', '32': 'NV', '33': 'NH',
    '34': 'NJ', '35': 'NM', '36': 'NY', '37': 'NC', '38': 'ND',
    '39': 'OH', '40': 'OK', '41': 'OR', '42': 'PA', '44': 'RI',
    '45': 'SC', '46': 'SD', '47': 'TN', '48': 'TX', '49': 'UT',
    '50': 'VT', '51': 'VA', '53': 'WA', '54': 'WV', '55': 'WI',
    '56': 'WY', '72': 'PR'
  };

  /**
   * Convert FIPS code or abbreviation to state abbreviation
   */
  private toStateAbbr(stateIdOrFips: string): string {
    // If it's already a 2-letter abbreviation, return as-is
    if (stateIdOrFips.length === 2 && /^[A-Z]{2}$/i.test(stateIdOrFips)) {
      return stateIdOrFips.toUpperCase();
    }
    // Try to convert from FIPS code
    const padded = stateIdOrFips.padStart(2, '0');
    return this.fipsToAbbr[padded] || stateIdOrFips;
  }

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  /**
   * Get cached data or fetch fresh
   */
  private getCached(key: string): RealtorRow[] | null {
    const entry = this.cache.get(key);
    if (entry && entry.expiry > Date.now()) {
      return entry.data;
    }
    this.cache.delete(key);
    return null;
  }

  /**
   * Store data in cache
   */
  private setCache(key: string, data: RealtorRow[]): void {
    this.cache.set(key, {
      data,
      expiry: Date.now() + this.CACHE_TTL,
    });
  }

  /**
   * Get latest date for a table (with 1-hour cache to avoid redundant queries)
   */
  private async getLatestDate(table: string): Promise<string | null> {
    // Check cache
    const cached = this.latestDateCache.get(table);
    if (cached && cached.expiry > Date.now()) {
      return cached.data;
    }

    const { data } = await this.supabase
      .from(table)
      .select('period_date')
      .order('period_date', { ascending: false })
      .limit(1);

    const latestDate = (data?.[0] as RealtorRow)?.period_date as string | null;

    if (latestDate) {
      this.latestDateCache.set(table, {
        data: latestDate,
        expiry: Date.now() + this.CACHE_TTL,
      });
    }

    return latestDate;
  }

  /**
   * Fetch a single page of data
   */
  private async fetchPage(
    table: string,
    periodDate: string,
    offset: number
  ): Promise<RealtorRow[]> {
    const { data, error } = await this.supabase
      .from(table)
      .select('*')
      .eq('period_date', periodDate)
      .range(offset, offset + this.PAGE_SIZE - 1);

    if (error) throw error;
    return (data || []) as RealtorRow[];
  }

  /**
   * Fetch ZIP data filtered by state at database level with pagination
   * ZIP names are formatted as "city, ST" so we use ilike to match state suffix
   */
  private async fetchZipsByState(
    periodDate: string,
    state: string
  ): Promise<RealtorRow[]> {
    // Check cache with state-specific key
    const cacheKey = `realtor_zip:${periodDate}:${state.toLowerCase()}`;
    const cached = this.getCached(cacheKey);
    if (cached) {
      return cached;
    }

    // Query with state filter at database level - zip_name format is "city, ST"
    const statePattern = `%, ${state.toLowerCase()}`;
    const allData: RealtorRow[] = [];
    let offset = 0;
    let hasMore = true;

    // Paginate to get all rows (bypasses Supabase 1000 row default limit)
    while (hasMore) {
      const { data, error } = await this.supabase
        .from('realtor_zip')
        .select('*')
        .eq('period_date', periodDate)
        .ilike('zip_name', statePattern)
        .range(offset, offset + this.PAGE_SIZE - 1);

      if (error) throw error;
      const rows = (data || []) as RealtorRow[];

      if (rows.length > 0) {
        allData.push(...rows);
      }

      // If we got fewer than PAGE_SIZE rows, we've fetched everything
      if (rows.length < this.PAGE_SIZE) {
        hasMore = false;
      } else {
        offset += this.PAGE_SIZE;
      }
    }

    // Cache state-specific results
    this.setCache(cacheKey, allData);
    return allData;
  }

  /**
   * Fetch all rows using parallel pagination to bypass Supabase 1000 row limit
   */
  private async fetchAllRows(
    table: string,
    periodDate: string
  ): Promise<RealtorRow[]> {
    // Check cache first
    const cacheKey = `${table}:${periodDate}`;
    const cached = this.getCached(cacheKey);
    if (cached) {
      return cached;
    }

    const allData: RealtorRow[] = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      // Fetch multiple pages in parallel
      const pagePromises: Promise<RealtorRow[]>[] = [];
      for (let i = 0; i < this.PARALLEL_PAGES; i++) {
        pagePromises.push(this.fetchPage(table, periodDate, offset + i * this.PAGE_SIZE));
      }

      const results = await Promise.all(pagePromises);

      for (const pageData of results) {
        if (pageData.length > 0) {
          allData.push(...pageData);
        }
      }

      // Check if we got full pages - if any page is less than PAGE_SIZE, we're done
      const lastPageSize = results[results.length - 1].length;
      const totalFetched = results.reduce((sum, r) => sum + r.length, 0);

      if (totalFetched < this.PARALLEL_PAGES * this.PAGE_SIZE || lastPageSize < this.PAGE_SIZE) {
        hasMore = false;
      } else {
        offset += this.PARALLEL_PAGES * this.PAGE_SIZE;
      }
    }

    // Cache the result
    this.setCache(cacheKey, allData);
    return allData;
  }

  // ============================================================================
  // National Data
  // ============================================================================

  async getNationalData(metric: string, date?: string): Promise<RealtorDataPoint[]> {
    let query = this.supabase
      .from('realtor_national')
      .select('*')
      .order('period_date', { ascending: false });

    if (date) {
      query = query.eq('period_date', date);
    }

    const { data, error } = await query.limit(1);
    if (error) throw error;

    return (data || []).map(row => ({
      region_id: 'US',
      region_name: 'United States',
      value: row[metric],
    }));
  }

  // Map frontend metric IDs to Realtor column names
  private readonly metricColumnMap: Record<string, string> = {
    'home_value': 'median_listing_price',
    'home_value_yoy': 'median_listing_price_yy',
    'home_value_mom': 'median_listing_price_mm',
    'for_sale_inventory': 'active_listing_count',
    'inventory_yoy': 'active_listing_count_yy',
    'days_on_market': 'median_days_on_market',
    'new_listings': 'new_listing_count',
    'pending_listings': 'pending_listing_count',
    'price_cut_pct': 'price_reduced_share',
    'price_per_sqft': 'median_listing_price_per_square_foot',
  };

  // Metrics that are stored as decimals and need to be converted to percentages
  // These are multiplied by 100 for display (0.05 -> 5%)
  private readonly percentMetrics = new Set([
    'home_value_yoy',
    'home_value_mom',
    'inventory_yoy',
    'price_cut_pct',
  ]);

  /**
   * Process a metric value for benchmark display
   * - Converts decimal percentages to display percentages (0.05 -> 5)
   * - Filters out corrupt data for growth metrics
   * - Rounds non-percentage values to integers
   */
  private processMetricValue(metricId: string, rawValue: unknown): number | null {
    if (rawValue === null || rawValue === undefined) return null;

    let value = Number(rawValue);
    if (isNaN(value)) return null;

    // Check for corrupt data in growth metrics (values stored as decimals)
    // Values > 100 or < -100 as decimals would mean >10,000% which is corrupt
    const isGrowthMetric = metricId.endsWith('_yoy') || metricId.endsWith('_mom');
    if (isGrowthMetric && (value > 100 || value < -100)) {
      return null; // Treat as corrupt data
    }

    // Convert decimal percentages to display percentages
    if (this.percentMetrics.has(metricId)) {
      // Stored as decimal (0.05 = 5%), convert to percentage (5)
      value = value * 100;
      // Round to 1 decimal place for percentages
      return Math.round(value * 10) / 10;
    }

    // Round non-percentage values to integers
    return Math.round(value);
  }

  /**
   * Get national average for a given frontend metric ID
   * Maps frontend metric IDs to Realtor column names
   */
  async getNationalAverage(metricId: string): Promise<{ value: number | null; metricId: string }> {
    const columnName = this.metricColumnMap[metricId];
    if (!columnName) {
      return { value: null, metricId };
    }

    const { data, error } = await this.supabase
      .from('realtor_national')
      .select(columnName)
      .order('period_date', { ascending: false })
      .limit(1);

    if (error) {
      console.error('Error fetching national average:', error);
      return { value: null, metricId };
    }

    const row = data?.[0];

    return {
      value: this.processMetricValue(metricId, row?.[columnName]),
      metricId
    };
  }

  /**
   * Get all national averages for benchmark comparison
   */
  async getAllNationalAverages(): Promise<Record<string, number | null>> {
    const columns = Object.values(this.metricColumnMap);

    const { data, error } = await this.supabase
      .from('realtor_national')
      .select(columns.join(','))
      .order('period_date', { ascending: false })
      .limit(1);

    if (error) {
      console.error('Error fetching national averages:', error);
      return {};
    }

    const row = data?.[0] || {};
    const result: Record<string, number | null> = {};

    for (const [metricId, column] of Object.entries(this.metricColumnMap)) {
      result[metricId] = this.processMetricValue(metricId, row[column]);
    }

    return result;
  }

  /**
   * Get state average for a given state
   * @param stateId - Can be FIPS code (e.g., "32") or abbreviation (e.g., "NV")
   */
  async getStateAverages(stateId: string): Promise<Record<string, number | null>> {
    const columns = ['state_id', ...Object.values(this.metricColumnMap)];
    // Convert FIPS to state abbreviation (database stores abbreviations like "NV", not FIPS "32")
    const stateAbbr = this.toStateAbbr(stateId);
    console.log(`[getStateAverages] Input stateId=${stateId}, converted to stateAbbr=${stateAbbr}`);

    const { data, error } = await this.supabase
      .from('realtor_state')
      .select(columns.join(','))
      .eq('state_id', stateAbbr)
      .order('period_date', { ascending: false })
      .limit(1);

    console.log(`[getStateAverages] Query result: ${data?.length || 0} rows`);

    if (error) {
      console.error('Error fetching state averages:', error);
      return {};
    }

    const row = data?.[0] || {};
    const result: Record<string, number | null> = {};

    for (const [metricId, column] of Object.entries(this.metricColumnMap)) {
      result[metricId] = this.processMetricValue(metricId, row[column]);
    }

    console.log(`[getStateAverages] Returning ${Object.values(result).filter(v => v !== null).length} metrics with values`);
    return result;
  }

  /**
   * Get comprehensive benchmark data for a specific geography
   * Returns location values, state averages, and national averages for all metrics
   */
  async getBenchmarks(
    geoLevel: string,
    regionId: string,
    stateId?: string
  ): Promise<{
    location: Record<string, number | null>;
    state: Record<string, number | null>;
    national: Record<string, number | null>;
    locationName: string;
    stateName: string | null;
  }> {
    console.log(`[getBenchmarks] geoLevel=${geoLevel}, regionId=${regionId}, stateId=${stateId}`);
    const columns = Object.values(this.metricColumnMap);

    // Get national averages
    const national = await this.getAllNationalAverages();
    console.log(`[getBenchmarks] National averages:`, Object.keys(national).length, 'metrics');

    // Get state averages if applicable
    let state: Record<string, number | null> = {};
    let stateName: string | null = null;

    if (stateId && geoLevel !== 'state') {
      // Convert FIPS to abbreviation (database stores "NV" not "32")
      const stateAbbr = this.toStateAbbr(stateId);
      console.log(`[getBenchmarks] Fetching state averages for stateId=${stateId} (abbr=${stateAbbr})`);
      state = await this.getStateAverages(stateId);
      const stateMetricsWithValues = Object.values(state).filter(v => v !== null).length;
      console.log(`[getBenchmarks] State averages received: ${stateMetricsWithValues} metrics with values`);

      // Get state name using abbreviation
      const { data: stateData } = await this.supabase
        .from('realtor_state')
        .select('state_name')
        .eq('state_id', stateAbbr)
        .limit(1);

      stateName = stateData?.[0]?.state_name || stateAbbr;
      console.log(`[getBenchmarks] State name: ${stateName}`);
    } else {
      console.log(`[getBenchmarks] Skipping state averages: stateId=${stateId}, geoLevel=${geoLevel}`);
    }

    // Get location values based on geo level
    const location: Record<string, number | null> = {};
    let locationName = '';

    if (geoLevel === 'state') {
      // Convert FIPS to abbreviation (database stores "NV" not "32")
      const stateAbbr = this.toStateAbbr(regionId);
      console.log(`[getBenchmarks] State query for regionId=${regionId} (abbr=${stateAbbr})`);

      const { data, error } = await this.supabase
        .from('realtor_state')
        .select([...columns, 'state_name'].join(','))
        .eq('state_id', stateAbbr)
        .order('period_date', { ascending: false })
        .limit(1);

      console.log(`[getBenchmarks] State query result:`, data?.length || 0, 'rows', error ? `Error: ${error.message}` : '');

      const row = (data as RealtorRow[] | null)?.[0];
      if (row) {
        locationName = String(row.state_name || '');
        for (const [metricId, column] of Object.entries(this.metricColumnMap)) {
          location[metricId] = this.processMetricValue(metricId, row[column]);
        }
        console.log(`[getBenchmarks] Found state: ${locationName}, metrics with values:`, Object.values(location).filter(v => v !== null).length);
      }
    } else if (geoLevel === 'metro') {
      const { data } = await this.supabase
        .from('realtor_metro')
        .select([...columns, 'cbsa_title'].join(','))
        .eq('cbsa_code', regionId)
        .order('period_date', { ascending: false })
        .limit(1);

      const row = (data as RealtorRow[] | null)?.[0];
      if (row) {
        locationName = String(row.cbsa_title || '');
        for (const [metricId, column] of Object.entries(this.metricColumnMap)) {
          location[metricId] = this.processMetricValue(metricId, row[column]);
        }
      }
    } else if (geoLevel === 'county') {
      const { data } = await this.supabase
        .from('realtor_county')
        .select([...columns, 'county_name'].join(','))
        .eq('county_fips', regionId)
        .order('period_date', { ascending: false })
        .limit(1);

      const row = (data as RealtorRow[] | null)?.[0];
      if (row) {
        locationName = String(row.county_name || '');
        for (const [metricId, column] of Object.entries(this.metricColumnMap)) {
          location[metricId] = this.processMetricValue(metricId, row[column]);
        }
      }
    } else if (geoLevel === 'zip') {
      const { data } = await this.supabase
        .from('realtor_zip')
        .select([...columns, 'zip_name'].join(','))
        .eq('postal_code', regionId)
        .order('period_date', { ascending: false })
        .limit(1);

      const row = (data as RealtorRow[] | null)?.[0];
      if (row) {
        locationName = String(row.zip_name || '');
        for (const [metricId, column] of Object.entries(this.metricColumnMap)) {
          location[metricId] = this.processMetricValue(metricId, row[column]);
        }
      }
    }

    return {
      location,
      state,
      national,
      locationName,
      stateName
    };
  }

  // ============================================================================
  // State Data
  // ============================================================================

  async getStateData(metric: string, date?: string): Promise<RealtorDataPoint[]> {
    // Use cached latest date if not specified
    const latestDate = date || await this.getLatestDate('realtor_state');

    const { data, error } = await this.supabase
      .from('realtor_state')
      .select('*')
      .eq('period_date', latestDate);

    if (error) throw error;

    // Check if this is a growth/percent metric that needs data quality filtering
    const isGrowthMetric = metric.endsWith('_yy') || metric.endsWith('_mm');

    return ((data || []) as RealtorRow[]).map(row => {
      let value = Number(row[metric]) || 0;

      // Filter out only clearly corrupt data (values in millions of percent)
      // Growth metrics are stored as decimals (0.05 = 5%), so ±100 (±10,000%) catches only corrupt data
      if (isGrowthMetric && (value > 100 || value < -100)) {
        value = 0; // Treat as corrupt data
      }

      return {
        region_id: String(row.state_id || ''),
        region_name: String(row.state_name || ''),
        state_id: String(row.state_id || ''),
        value,
        date: latestDate ? String(latestDate) : undefined,
      };
    });
  }

  // ============================================================================
  // Metro Data
  // ============================================================================

  async getMetroData(metric: string, date?: string, state?: string): Promise<RealtorDataPoint[]> {
    // Use cached latest date if not specified
    const latestDate = date || await this.getLatestDate('realtor_metro');

    // Use high limit to get all metros (~1000)
    const { data, error } = await this.supabase
      .from('realtor_metro')
      .select('*')
      .eq('period_date', latestDate)
      .limit(2000);

    if (error) throw error;

    // Check if this is a growth/percent metric that needs data quality filtering
    const isGrowthMetric = metric.endsWith('_yy') || metric.endsWith('_mm');

    return ((data || []) as RealtorRow[]).map(row => {
      let value = Number(row[metric]) || 0;

      // Filter out only clearly corrupt data (values in millions of percent)
      // Growth metrics are stored as decimals (0.05 = 5%), so ±100 (±10,000%) catches only corrupt data
      if (isGrowthMetric && (value > 100 || value < -100)) {
        value = 0; // Treat as corrupt data
      }

      return {
        region_id: String(row.cbsa_code || ''),
        region_name: String(row.cbsa_title || ''),
        cbsa_code: String(row.cbsa_code || ''),
        value,
        date: latestDate ? String(latestDate) : undefined,
      };
    });
  }

  // ============================================================================
  // County Data
  // ============================================================================

  async getCountyData(metric: string, date?: string, state?: string): Promise<RealtorDataPoint[]> {
    // Use cached latest date if not specified
    const latestDate = date || await this.getLatestDate('realtor_county');

    // Use pagination to get all counties (~3200)
    const data = await this.fetchAllRows('realtor_county', latestDate as string);

    // Check if this is a growth/percent metric that needs data quality filtering
    const isGrowthMetric = metric.endsWith('_yy') || metric.endsWith('_mm');

    return data.map(row => {
      let value = Number(row[metric]) || 0;

      // Filter out only clearly corrupt data (values in millions of percent)
      // Growth metrics are stored as decimals (0.05 = 5%), so ±100 (±10,000%) catches only corrupt data
      if (isGrowthMetric && (value > 100 || value < -100)) {
        value = 0; // Treat as corrupt data
      }

      return {
        region_id: String(row.county_fips || ''),
        region_name: String(row.county_name || ''),
        county_fips: String(row.county_fips || ''),
        value,
        date: latestDate ? String(latestDate) : undefined,
      };
    });
  }

  // ============================================================================
  // ZIP Data
  // ============================================================================

  async getZipData(metric: string, state?: string, date?: string): Promise<RealtorDataPoint[]> {
    // Get latest date from cache if not specified
    const latestDate = date || await this.getLatestDate('realtor_zip');

    // OPTIMIZATION: When state is provided, query database directly with filter
    // This fetches ~500-2000 ZIPs per state instead of all 28,000
    let data: RealtorRow[];
    if (state) {
      data = await this.fetchZipsByState(latestDate as string, state);
    } else {
      // No state filter - fetch all ZIPs (uses pagination + caching)
      data = await this.fetchAllRows('realtor_zip', latestDate as string);
    }

    // Check if this is a growth/percent metric that needs data quality filtering
    const isGrowthMetric = metric.endsWith('_yy') || metric.endsWith('_mm');

    return data.map(row => {
      let value = Number(row[metric]) || 0;

      // Filter out only clearly corrupt data (values in millions of percent)
      // Growth metrics are stored as decimals (0.05 = 5%), so ±100 (±10,000%) catches only corrupt data
      if (isGrowthMetric && (value > 100 || value < -100)) {
        value = 0; // Treat as corrupt data
      }

      return {
        region_id: String(row.postal_code || ''),
        region_name: String(row.zip_name || ''),
        postal_code: String(row.postal_code || ''),
        value,
        date: latestDate ? String(latestDate) : undefined,
      };
    });
  }

  // ============================================================================
  // Convenience Methods for Common Metrics
  // ============================================================================

  // Home Value (median_listing_price)
  async getStateHomeValues(date?: string) {
    return this.getStateData('median_listing_price', date);
  }

  async getMetroHomeValues(date?: string, state?: string) {
    return this.getMetroData('median_listing_price', date, state);
  }

  async getCountyHomeValues(date?: string, state?: string) {
    return this.getCountyData('median_listing_price', date, state);
  }

  async getZipHomeValues(state?: string, date?: string) {
    return this.getZipData('median_listing_price', state, date);
  }

  // Home Value YoY (median_listing_price_yy)
  async getStateHomeValueYoy(date?: string) {
    return this.getStateData('median_listing_price_yy', date);
  }

  async getMetroHomeValueYoy(date?: string) {
    return this.getMetroData('median_listing_price_yy', date);
  }

  async getCountyHomeValueYoy(date?: string) {
    return this.getCountyData('median_listing_price_yy', date);
  }

  async getZipHomeValueYoy(state?: string, date?: string) {
    return this.getZipData('median_listing_price_yy', state, date);
  }

  // Home Value MoM (median_listing_price_mm)
  async getStateHomeValueMom(date?: string) {
    return this.getStateData('median_listing_price_mm', date);
  }

  async getMetroHomeValueMom(date?: string) {
    return this.getMetroData('median_listing_price_mm', date);
  }

  async getCountyHomeValueMom(date?: string) {
    return this.getCountyData('median_listing_price_mm', date);
  }

  async getZipHomeValueMom(state?: string, date?: string) {
    return this.getZipData('median_listing_price_mm', state, date);
  }

  // Inventory (active_listing_count)
  async getStateInventory(date?: string) {
    return this.getStateData('active_listing_count', date);
  }

  async getMetroInventory(date?: string) {
    return this.getMetroData('active_listing_count', date);
  }

  async getCountyInventory(date?: string) {
    return this.getCountyData('active_listing_count', date);
  }

  async getZipInventory(state?: string, date?: string) {
    return this.getZipData('active_listing_count', state, date);
  }

  // Inventory YoY (active_listing_count_yy)
  async getStateInventoryYoy(date?: string) {
    return this.getStateData('active_listing_count_yy', date);
  }

  async getMetroInventoryYoy(date?: string) {
    return this.getMetroData('active_listing_count_yy', date);
  }

  async getCountyInventoryYoy(date?: string) {
    return this.getCountyData('active_listing_count_yy', date);
  }

  async getZipInventoryYoy(state?: string, date?: string) {
    return this.getZipData('active_listing_count_yy', state, date);
  }

  // Days on Market (median_days_on_market)
  async getStateDom(date?: string) {
    return this.getStateData('median_days_on_market', date);
  }

  async getMetroDom(date?: string) {
    return this.getMetroData('median_days_on_market', date);
  }

  async getCountyDom(date?: string) {
    return this.getCountyData('median_days_on_market', date);
  }

  async getZipDom(state?: string, date?: string) {
    return this.getZipData('median_days_on_market', state, date);
  }

  // New Listings (new_listing_count)
  async getStateNewListings(date?: string) {
    return this.getStateData('new_listing_count', date);
  }

  async getMetroNewListings(date?: string) {
    return this.getMetroData('new_listing_count', date);
  }

  async getCountyNewListings(date?: string) {
    return this.getCountyData('new_listing_count', date);
  }

  async getZipNewListings(state?: string, date?: string) {
    return this.getZipData('new_listing_count', state, date);
  }

  // Pending Listings (pending_listing_count)
  async getStatePendingListings(date?: string) {
    return this.getStateData('pending_listing_count', date);
  }

  async getMetroPendingListings(date?: string) {
    return this.getMetroData('pending_listing_count', date);
  }

  async getCountyPendingListings(date?: string) {
    return this.getCountyData('pending_listing_count', date);
  }

  async getZipPendingListings(state?: string, date?: string) {
    return this.getZipData('pending_listing_count', state, date);
  }

  // Home Sales (pending_listing_count - proxy for sales activity)
  async getStateHomeSales(date?: string) {
    return this.getStateData('pending_listing_count', date);
  }

  async getMetroHomeSales(date?: string) {
    return this.getMetroData('pending_listing_count', date);
  }

  async getCountyHomeSales(date?: string) {
    return this.getCountyData('pending_listing_count', date);
  }

  async getZipHomeSales(state?: string, date?: string) {
    return this.getZipData('pending_listing_count', state, date);
  }

  // Home Sales YoY (pending_listing_count_yy)
  async getStateHomeSalesYoy(date?: string) {
    return this.getStateData('pending_listing_count_yy', date);
  }

  async getMetroHomeSalesYoy(date?: string) {
    return this.getMetroData('pending_listing_count_yy', date);
  }

  async getCountyHomeSalesYoy(date?: string) {
    return this.getCountyData('pending_listing_count_yy', date);
  }

  async getZipHomeSalesYoy(state?: string, date?: string) {
    return this.getZipData('pending_listing_count_yy', state, date);
  }

  // Price Reduced Share (price_reduced_share)
  async getStatePriceReduced(date?: string) {
    return this.getStateData('price_reduced_share', date);
  }

  async getMetroPriceReduced(date?: string) {
    return this.getMetroData('price_reduced_share', date);
  }

  async getCountyPriceReduced(date?: string) {
    return this.getCountyData('price_reduced_share', date);
  }

  async getZipPriceReduced(state?: string, date?: string) {
    return this.getZipData('price_reduced_share', state, date);
  }

  // Price per Square Foot (median_listing_price_per_square_foot)
  async getStatePricePerSqft(date?: string) {
    return this.getStateData('median_listing_price_per_square_foot', date);
  }

  async getMetroPricePerSqft(date?: string) {
    return this.getMetroData('median_listing_price_per_square_foot', date);
  }

  async getCountyPricePerSqft(date?: string) {
    return this.getCountyData('median_listing_price_per_square_foot', date);
  }

  async getZipPricePerSqft(state?: string, date?: string) {
    return this.getZipData('median_listing_price_per_square_foot', state, date);
  }

  // Hotness Score (hotness_score) - Metro/County/ZIP only
  async getMetroHotness(date?: string) {
    return this.getMetroData('hotness_score', date);
  }

  async getCountyHotness(date?: string) {
    return this.getCountyData('hotness_score', date);
  }

  async getZipHotness(state?: string, date?: string) {
    return this.getZipData('hotness_score', state, date);
  }

  // Supply Score (supply_score) - Metro/County/ZIP only
  async getMetroSupplyScore(date?: string) {
    return this.getMetroData('supply_score', date);
  }

  async getCountySupplyScore(date?: string) {
    return this.getCountyData('supply_score', date);
  }

  async getZipSupplyScore(state?: string, date?: string) {
    return this.getZipData('supply_score', state, date);
  }

  // Demand Score (demand_score) - Metro/County/ZIP only
  async getMetroDemandScore(date?: string) {
    return this.getMetroData('demand_score', date);
  }

  async getCountyDemandScore(date?: string) {
    return this.getCountyData('demand_score', date);
  }

  async getZipDemandScore(state?: string, date?: string) {
    return this.getZipData('demand_score', state, date);
  }

  // Pending Ratio (pending_ratio)
  async getStatePendingRatio(date?: string) {
    return this.getStateData('pending_ratio', date);
  }

  async getMetroPendingRatio(date?: string) {
    return this.getMetroData('pending_ratio', date);
  }

  async getCountyPendingRatio(date?: string) {
    return this.getCountyData('pending_ratio', date);
  }

  async getZipPendingRatio(state?: string, date?: string) {
    return this.getZipData('pending_ratio', state, date);
  }
}
