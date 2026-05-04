import { Injectable, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../../supabase/supabase.service';

/**
 * Internal service for client-side-filter list endpoints (metros, counties,
 * ZIPs, cities) and metro name search. Each "getAll*" method paginates the
 * realtor_* / zillow_* table at the most recent period_date and returns a
 * deduped list suitable for instant frontend search.
 */
@Injectable()
export class MarketsSearchService {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  async searchMetros(query: string, limit = 10) {
    // Search metros by name using ilike for case-insensitive partial match
    const { data, error } = await this.supabase
      .from('zillow_metro')
      .select('region_id, region_name')
      .ilike('region_name', `%${query}%`)
      .order('region_name')
      .limit(limit * 3); // Fetch more to account for duplicates

    if (error) throw error;

    // Dedupe metros by region_id
    const metroMap = new Map<number, { regionId: number; name: string }>();
    for (const row of data || []) {
      if (row.region_name && !metroMap.has(row.region_id)) {
        metroMap.set(row.region_id, {
          regionId: row.region_id,
          name: row.region_name,
        });
      }
    }

    return Array.from(metroMap.values()).slice(0, limit);
  }

  // Get all metros for client-side filtering (fast search)
  // Uses realtor_metro which has metros we actually have data for
  // Returns deduped list sorted by name - used by frontend for instant search
  async getAllMetros() {
    // First, get the most recent date to avoid scanning all historical data
    const { data: dateData } = await this.supabase
      .from('realtor_metro')
      .select('period_date')
      .order('period_date', { ascending: false })
      .limit(1);

    const latestDate = dateData?.[0]?.period_date;
    if (!latestDate) return [];

    // Paginate to handle >1000 rows (Supabase default limit)
    const metroMap = new Map<string, { regionId: number; name: string }>();
    const batchSize = 1000;
    let offset = 0;

    while (true) {
      const { data, error } = await this.supabase
        .from('realtor_metro')
        .select('cbsa_code, cbsa_title')
        .eq('period_date', latestDate)
        .order('cbsa_title')
        .range(offset, offset + batchSize - 1);

      if (error) throw error;
      if (!data || data.length === 0) break;

      // Dedupe by cbsa_code, filter out nulls and "United States"
      for (const row of data) {
        if (
          row.cbsa_title &&
          row.cbsa_code &&
          !metroMap.has(row.cbsa_code) &&
          !row.cbsa_title.toLowerCase().includes('united states')
        ) {
          metroMap.set(row.cbsa_code, {
            regionId: parseInt(row.cbsa_code, 10) || 0,
            name: row.cbsa_title,
          });
        }
      }

      if (data.length < batchSize) break;
      offset += batchSize;
    }

    return Array.from(metroMap.values());
  }

  // Get all counties for client-side filtering (fast search)
  // Uses realtor_county which has counties we actually have data for
  async getAllCounties() {
    // First, get the most recent date to avoid scanning all historical data
    const { data: dateData } = await this.supabase
      .from('realtor_county')
      .select('period_date')
      .order('period_date', { ascending: false })
      .limit(1);

    const latestDate = dateData?.[0]?.period_date;
    if (!latestDate) return [];

    // Paginate to handle >1000 rows (Supabase default limit)
    const countyMap = new Map<
      string,
      { fips: string; name: string; state: string }
    >();
    const batchSize = 1000;
    let offset = 0;

    while (true) {
      const { data, error } = await this.supabase
        .from('realtor_county')
        .select('county_fips, county_name')
        .eq('period_date', latestDate)
        .order('county_name')
        .range(offset, offset + batchSize - 1);

      if (error) throw error;
      if (!data || data.length === 0) break;

      // Dedupe by county_fips
      for (const row of data) {
        if (
          row.county_name &&
          row.county_fips &&
          !countyMap.has(row.county_fips)
        ) {
          // Extract state from county_name (e.g., "vance, nc" -> "NC")
          const parts = row.county_name.split(',');
          const state =
            parts.length > 1
              ? parts[parts.length - 1].trim().toUpperCase()
              : '';
          const name =
            parts.length > 1
              ? parts.slice(0, -1).join(',').trim()
              : row.county_name;
          // Capitalize county name properly
          const capitalizedName = name
            .split(' ')
            .map(
              (word: string) =>
                word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
            )
            .join(' ');

          countyMap.set(row.county_fips, {
            fips: row.county_fips,
            name: capitalizedName,
            state: state,
          });
        }
      }

      if (data.length < batchSize) break;
      offset += batchSize;
    }

    return Array.from(countyMap.values());
  }

  // Get all ZIP codes for client-side filtering (fast search)
  // Uses realtor_zip which has ZIPs we actually have data for
  async getAllZips() {
    // First, get the most recent date to avoid scanning all historical data
    const { data: dateData } = await this.supabase
      .from('realtor_zip')
      .select('period_date')
      .order('period_date', { ascending: false })
      .limit(1);

    const latestDate = dateData?.[0]?.period_date;
    if (!latestDate) return [];

    // Paginate to handle >1000 rows (Supabase default limit)
    const zipMap = new Map<string, { code: string; name: string }>();
    const batchSize = 1000;
    let offset = 0;

    while (true) {
      const { data, error } = await this.supabase
        .from('realtor_zip')
        .select('postal_code, zip_name')
        .eq('period_date', latestDate)
        .order('postal_code')
        .range(offset, offset + batchSize - 1);

      if (error) throw error;
      if (!data || data.length === 0) break;

      // Dedupe by postal_code
      for (const row of data) {
        if (row.postal_code && !zipMap.has(row.postal_code)) {
          zipMap.set(row.postal_code, {
            code: row.postal_code,
            name: row.zip_name || row.postal_code,
          });
        }
      }

      if (data.length < batchSize) break;
      offset += batchSize;
    }

    return Array.from(zipMap.values());
  }

  // Get all cities for client-side filtering (fast search)
  // Uses zillow_city which has cities we have data for
  async getAllCities() {
    // Paginate to handle >1000 rows (Supabase default limit)
    const cityMap = new Map<
      number,
      { id: number; name: string; state: string }
    >();
    const batchSize = 1000;
    let offset = 0;

    while (true) {
      const { data, error } = await this.supabase
        .from('zillow_city')
        .select('region_id, region_name, state_code')
        .order('region_name')
        .range(offset, offset + batchSize - 1);

      if (error) throw error;
      if (!data || data.length === 0) break;

      // Dedupe by region_id
      for (const row of data) {
        if (row.region_name && row.region_id && !cityMap.has(row.region_id)) {
          cityMap.set(row.region_id, {
            id: row.region_id,
            name: row.region_name,
            state: row.state_code || '',
          });
        }
      }

      if (data.length < batchSize) break;
      offset += batchSize;
    }

    return Array.from(cityMap.values());
  }
}
