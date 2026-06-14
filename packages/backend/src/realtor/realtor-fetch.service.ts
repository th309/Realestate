import { Injectable, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';
import type { RealtorRow, CacheEntry } from './realtor.types';

/**
 * Low-level Supabase access for Realtor tables: latest-date lookup, single owner
 * of the in-memory row/date caches, and parallel/state-filtered pagination that
 * bypasses Supabase's 1000-row default limit.
 */
@Injectable()
export class RealtorFetchService {
  private readonly PAGE_SIZE = 1000; // Supabase default max
  private readonly PARALLEL_PAGES = 5; // Fetch 5 pages concurrently
  private readonly CACHE_TTL = 4 * 60 * 60 * 1000; // 4 hours in ms
  private cache = new Map<string, CacheEntry<RealtorRow[]>>();
  // Cache for latest dates per table (avoids redundant date queries)
  private latestDateCache = new Map<string, CacheEntry<string>>();

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
   * Get latest date for a table (with cache to avoid redundant queries)
   */
  async getLatestDate(table: string): Promise<string | null> {
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
    offset: number,
    columns = '*',
  ): Promise<RealtorRow[]> {
    const { data, error } = await this.supabase
      .from(table)
      .select(columns)
      .eq('period_date', periodDate)
      .range(offset, offset + this.PAGE_SIZE - 1);

    if (error) throw error;
    return (data || []) as unknown as RealtorRow[];
  }

  /**
   * Fetch ZIP data filtered by state at database level with pagination
   * ZIP names are formatted as "city, ST" so we use ilike to match state suffix
   */
  async fetchZipsByState(
    periodDate: string,
    state: string,
    columns = '*',
  ): Promise<RealtorRow[]> {
    // Check cache with state-specific key (include columns for metric-specific caching)
    const cacheKey = `realtor_zip:${periodDate}:${state.toLowerCase()}:${columns}`;
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
        .select(columns)
        .eq('period_date', periodDate)
        .ilike('zip_name', statePattern)
        .range(offset, offset + this.PAGE_SIZE - 1);

      if (error) throw error;
      const rows = (data || []) as unknown as RealtorRow[];

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
  async fetchAllRows(
    table: string,
    periodDate: string,
    columns = '*',
  ): Promise<RealtorRow[]> {
    // Check cache first (include columns for metric-specific caching)
    const cacheKey = `${table}:${periodDate}:${columns}`;
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
        pagePromises.push(
          this.fetchPage(
            table,
            periodDate,
            offset + i * this.PAGE_SIZE,
            columns,
          ),
        );
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

      if (
        totalFetched < this.PARALLEL_PAGES * this.PAGE_SIZE ||
        lastPageSize < this.PAGE_SIZE
      ) {
        hasMore = false;
      } else {
        offset += this.PARALLEL_PAGES * this.PAGE_SIZE;
      }
    }

    // Cache the result
    this.setCache(cacheKey, allData);
    return allData;
  }
}
