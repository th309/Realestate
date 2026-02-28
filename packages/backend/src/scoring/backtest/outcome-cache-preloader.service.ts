/**
 * Outcome Cache Preloader Service
 *
 * Bulk-loads market data (Zillow ZHVI/ZORI, Redfin, Realtor) into the
 * OutcomeCacheService using keyset pagination. Called once at startup
 * to eliminate per-outcome DB queries during batch population.
 */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import type { GeographyType } from '../scoring.types';
import type { HistoricalDataPoint } from './outcome-generator.types';
import {
  getZillowTable,
  getZillowIdColumn,
  getRedfinRoute,
  getRealtorRoute,
} from './outcome-generator.types';
import { OutcomeCacheService } from './outcome-cache.service';

@Injectable()
export class OutcomeCachePreloaderService {
  private readonly logger = new Logger(OutcomeCachePreloaderService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly cache: OutcomeCacheService,
  ) {}

  /**
   * Bulk-load Zillow ZHVI + ZORI data for a geography type into the cache.
   * Runs two separate passes (ZHVI first, then ZORI) to keep each query
   * simple enough for PostgreSQL to handle on large tables like zillow_zip.
   */
  async preloadHistoricalData(geographyType: GeographyType): Promise<number> {
    const table = getZillowTable(geographyType);
    const idCol = getZillowIdColumn(geographyType);
    const geoDateSets = new Map<string, Set<string>>();

    // Pass 1: ZHVI (primary price data)
    console.log(`      ZHVI pass...`);
    const zhviCount = await this.loadMetricPass(
      table,
      idCol,
      'zhvi',
      geographyType,
      geoDateSets,
    );

    // Pass 2: ZORI (rent data — merge into existing points)
    console.log(`      ZORI pass...`);
    const zoriCount = await this.loadMetricPass(
      table,
      idCol,
      'zori',
      geographyType,
      geoDateSets,
    );

    this.cache.flushDateIndex(geoDateSets, 'historical');

    const total = zhviCount + zoriCount;
    console.log(
      `    Preloaded ${total.toLocaleString()} points (${zhviCount.toLocaleString()} ZHVI + ${zoriCount.toLocaleString()} ZORI) + ${this.cache.stateCodeCache.size} state codes for ${geographyType}`,
    );
    return total;
  }

  /** Load a single metric (zhvi or zori) using keyset pagination. */
  private async loadMetricPass(
    table: string,
    idCol: string,
    metric: 'zhvi' | 'zori',
    geographyType: GeographyType,
    geoDateSets: Map<string, Set<string>>,
  ): Promise<number> {
    const client = this.supabase.getClient();
    let loaded = 0;
    const pageSize = 1000;
    let cursorId = '';
    let cursorDate = '';

    while (true) {
      let query = client
        .from(table)
        .select(`${idCol}, period_date, value, state_code`)
        .eq('metric_name', metric)
        .order(idCol, { ascending: true })
        .order('period_date', { ascending: true })
        .limit(pageSize);

      if (cursorId) {
        query = query.or(
          `${idCol}.gt.${cursorId},and(${idCol}.eq.${cursorId},period_date.gt.${cursorDate})`,
        );
      }

      const { data } = (await query) as {
        data: Record<string, any>[] | null;
      };

      if (!data || data.length === 0) break;

      for (const row of data) {
        const geoId = row[idCol] as string;
        const date = row.period_date as string;
        const indexKey = `${geographyType}:${geoId}`;
        const histKey = `${indexKey}:${date}`;

        const existing = this.cache.historicalCache.get(histKey);
        if (existing) {
          if (metric === 'zori') existing[0].zori = row.value as number;
          else existing[0].zhvi = row.value as number;
        } else {
          const point: HistoricalDataPoint = { date, source: 'zillow' };
          if (metric === 'zori') point.zori = row.value as number;
          else point.zhvi = row.value as number;
          this.cache.historicalCache.set(histKey, [point]);
          loaded++;
        }

        this.cache.addToDateIndex(geoDateSets, indexKey, date);

        if (row.state_code && !this.cache.stateCodeCache.has(indexKey)) {
          this.cache.stateCodeCache.set(indexKey, row.state_code as string);
        }
      }

      const lastRow = data[data.length - 1];
      cursorId = lastRow[idCol] as string;
      cursorDate = lastRow.period_date as string;

      if (loaded % 50000 === 0 && loaded > 0) {
        console.log(
          `      ... ${loaded.toLocaleString()} ${metric} rows from ${table}`,
        );
      }

      if (data.length < pageSize) break;
    }

    return loaded;
  }

  /**
   * Bulk-load ALL Redfin median sale price data for a geography type.
   * Returns 0 if the geography type has no Redfin table.
   */
  async preloadRedfinData(geographyType: GeographyType): Promise<number> {
    const route = getRedfinRoute(geographyType);
    if (!route) {
      this.logger.log(`No Redfin data for ${geographyType}, skipping preload`);
      return 0;
    }

    const client = this.supabase.getClient();
    let loaded = 0;
    const pageSize = 1000;
    const geoDateSets = new Map<string, Set<string>>();
    // Keyset pagination cursor (same pattern as preloadHistoricalData)
    let cursorId = '';
    let cursorDate = '';

    while (true) {
      let query = client
        .from(route.table)
        .select(`${route.idColumn}, ${route.dateColumn}, median_sale_price`)
        .eq('property_type', 'All Residential')
        .not('median_sale_price', 'is', null)
        .order(route.idColumn, { ascending: true })
        .order(route.dateColumn, { ascending: true })
        .limit(pageSize);

      if (cursorId) {
        query = query.or(
          `${route.idColumn}.gt.${cursorId},and(${route.idColumn}.eq.${cursorId},${route.dateColumn}.gt.${cursorDate})`,
        );
      }

      const { data } = (await query) as {
        data: Record<string, any>[] | null;
      };

      if (!data || data.length === 0) break;

      for (const row of data) {
        const geoId = String(row[route.idColumn]);
        const date = String(row[route.dateColumn]);
        const cacheKey = `${geographyType}:${geoId}:${date}`;

        if (!this.cache.redfinCache.has(cacheKey)) {
          this.cache.redfinCache.set(cacheKey, {
            date,
            price: row.median_sale_price as number,
          });
          loaded++;
        }

        this.cache.addToDateIndex(
          geoDateSets,
          `${geographyType}:${geoId}`,
          date,
        );
      }

      if (loaded % 50000 === 0 && loaded > 0) {
        console.log(
          `    ... ${loaded.toLocaleString()} Redfin rows loaded from ${route.table}`,
        );
      }

      const lastRow = data[data.length - 1];
      cursorId = String(lastRow[route.idColumn]);
      cursorDate = String(lastRow[route.dateColumn]);

      if (data.length < pageSize) break;
    }

    this.cache.flushDateIndex(geoDateSets, 'redfin');

    console.log(
      `    Preloaded ${loaded.toLocaleString()} Redfin price points for ${geographyType}`,
    );
    return loaded;
  }

  /**
   * Bulk-load ALL Realtor median listing price data for a geography type.
   * Returns 0 if the geography type has no Realtor table.
   */
  async preloadRealtorData(geographyType: GeographyType): Promise<number> {
    const route = getRealtorRoute(geographyType);
    if (!route) {
      this.logger.log(`No Realtor data for ${geographyType}, skipping preload`);
      return 0;
    }

    const client = this.supabase.getClient();
    let loaded = 0;
    const pageSize = 1000;
    const geoDateSets = new Map<string, Set<string>>();
    // Keyset pagination cursor (same pattern as preloadHistoricalData)
    let cursorId = '';
    let cursorDate = '';

    while (true) {
      let query = client
        .from(route.table)
        .select(`${route.idColumn}, ${route.dateColumn}, median_listing_price`)
        .not('median_listing_price', 'is', null)
        .order(route.idColumn, { ascending: true })
        .order(route.dateColumn, { ascending: true })
        .limit(pageSize);

      if (cursorId) {
        query = query.or(
          `${route.idColumn}.gt.${cursorId},and(${route.idColumn}.eq.${cursorId},${route.dateColumn}.gt.${cursorDate})`,
        );
      }

      const { data } = (await query) as {
        data: Record<string, any>[] | null;
      };

      if (!data || data.length === 0) break;

      for (const row of data) {
        const geoId = String(row[route.idColumn]);
        const date = String(row[route.dateColumn]);
        const cacheKey = `${geographyType}:${geoId}:${date}`;

        if (!this.cache.realtorCache.has(cacheKey)) {
          this.cache.realtorCache.set(cacheKey, {
            date,
            price: row.median_listing_price as number,
          });
          loaded++;
        }

        this.cache.addToDateIndex(
          geoDateSets,
          `${geographyType}:${geoId}`,
          date,
        );
      }

      if (loaded % 50000 === 0 && loaded > 0) {
        console.log(
          `    ... ${loaded.toLocaleString()} Realtor rows loaded from ${route.table}`,
        );
      }

      const lastRow = data[data.length - 1];
      cursorId = String(lastRow[route.idColumn]);
      cursorDate = String(lastRow[route.dateColumn]);

      if (data.length < pageSize) break;
    }

    this.cache.flushDateIndex(geoDateSets, 'realtor');

    console.log(
      `    Preloaded ${loaded.toLocaleString()} Realtor price points for ${geographyType}`,
    );
    return loaded;
  }
}
