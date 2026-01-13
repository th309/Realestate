import { Injectable, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.module';

export interface RealtorDataPoint {
  region_id: string;
  region_name: string;
  value: number;
  state_id?: string;
  cbsa_code?: string;
  county_fips?: string;
  postal_code?: string;
}

// Type for generic row data from Supabase
interface RealtorRow {
  [key: string]: unknown;
}

@Injectable()
export class RealtorService {
  private readonly PAGE_SIZE = 1000; // Supabase default max

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  /**
   * Fetch all rows using pagination to bypass Supabase 1000 row limit
   */
  private async fetchAllRows(
    table: string,
    periodDate: string
  ): Promise<RealtorRow[]> {
    const allData: RealtorRow[] = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await this.supabase
        .from(table)
        .select('*')
        .eq('period_date', periodDate)
        .range(offset, offset + this.PAGE_SIZE - 1);

      if (error) throw error;

      if (data && data.length > 0) {
        allData.push(...(data as RealtorRow[]));
        offset += this.PAGE_SIZE;
        hasMore = data.length === this.PAGE_SIZE;
      } else {
        hasMore = false;
      }
    }

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

  // ============================================================================
  // State Data
  // ============================================================================

  async getStateData(metric: string, date?: string): Promise<RealtorDataPoint[]> {
    // Get latest date if not specified
    const { data: latestData } = await this.supabase
      .from('realtor_state')
      .select('period_date')
      .order('period_date', { ascending: false })
      .limit(1);

    const latestDate = date || (latestData?.[0] as RealtorRow)?.period_date;

    const { data, error } = await this.supabase
      .from('realtor_state')
      .select('*')
      .eq('period_date', latestDate);

    if (error) throw error;

    return ((data || []) as RealtorRow[]).map(row => ({
      region_id: String(row.state_id || ''),
      region_name: String(row.state_name || ''),
      state_id: String(row.state_id || ''),
      value: Number(row[metric]) || 0,
    }));
  }

  // ============================================================================
  // Metro Data
  // ============================================================================

  async getMetroData(metric: string, date?: string, state?: string): Promise<RealtorDataPoint[]> {
    // Get latest date if not specified
    const { data: latestData } = await this.supabase
      .from('realtor_metro')
      .select('period_date')
      .order('period_date', { ascending: false })
      .limit(1);

    const latestDate = date || (latestData?.[0] as RealtorRow)?.period_date;

    // Use high limit to get all metros (~1000)
    const { data, error } = await this.supabase
      .from('realtor_metro')
      .select('*')
      .eq('period_date', latestDate)
      .limit(2000);

    if (error) throw error;

    return ((data || []) as RealtorRow[]).map(row => ({
      region_id: String(row.cbsa_code || ''),
      region_name: String(row.cbsa_title || ''),
      cbsa_code: String(row.cbsa_code || ''),
      value: Number(row[metric]) || 0,
    }));
  }

  // ============================================================================
  // County Data
  // ============================================================================

  async getCountyData(metric: string, date?: string, state?: string): Promise<RealtorDataPoint[]> {
    // Get latest date if not specified
    const { data: latestData } = await this.supabase
      .from('realtor_county')
      .select('period_date')
      .order('period_date', { ascending: false })
      .limit(1);

    const latestDate = date || (latestData?.[0] as RealtorRow)?.period_date;

    // Use pagination to get all counties (~3200)
    const data = await this.fetchAllRows('realtor_county', latestDate as string);

    return data.map(row => ({
      region_id: String(row.county_fips || ''),
      region_name: String(row.county_name || ''),
      county_fips: String(row.county_fips || ''),
      value: Number(row[metric]) || 0,
    }));
  }

  // ============================================================================
  // ZIP Data
  // ============================================================================

  async getZipData(metric: string, state?: string, date?: string): Promise<RealtorDataPoint[]> {
    // Get latest date if not specified
    const { data: latestData } = await this.supabase
      .from('realtor_zip')
      .select('period_date')
      .order('period_date', { ascending: false })
      .limit(1);

    const latestDate = date || (latestData?.[0] as RealtorRow)?.period_date;

    // Use pagination to get all ZIPs (~28000)
    const data = await this.fetchAllRows('realtor_zip', latestDate as string);

    return data.map(row => ({
      region_id: String(row.postal_code || ''),
      region_name: String(row.zip_name || ''),
      postal_code: String(row.postal_code || ''),
      value: Number(row[metric]) || 0,
    }));
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
