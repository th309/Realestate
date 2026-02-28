/**
 * Outcome Cache Service
 *
 * Manages in-memory caches for the outcome pipeline. Stores preloaded
 * benchmark, historical (Zillow ZHVI/ZORI), Redfin, and Realtor data.
 * Lookup methods use binary search for nearest-date matching.
 *
 * Preloading is handled by OutcomeCachePreloaderService.
 */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import type { GeographyType } from '../scoring.types';
import type { BenchmarkData } from './outcome-generator.types';
import type { HistoricalDataPoint } from './outcome-generator.types';

@Injectable()
export class OutcomeCacheService {
  private readonly logger = new Logger(OutcomeCacheService.name);

  /** Benchmark data keyed by "level:code:date:metric" */
  readonly benchmarkCache = new Map<string, BenchmarkData | null>();

  /** State code lookups keyed by "geoType:geoId" */
  readonly stateCodeCache = new Map<string, string | null>();

  /** Historical data keyed by "geoType:geoId:date" */
  readonly historicalCache = new Map<string, HistoricalDataPoint[] | null>();

  /** Sorted date index per geography: "geoType:geoId" → sorted dates */
  private readonly historicalDateIndex = new Map<string, string[]>();

  /** Sorted date index per benchmark: "level:code:metric" → sorted dates */
  private readonly benchmarkDateIndex = new Map<string, string[]>();

  /** Redfin price data keyed by "geoType:geoId:date" */
  readonly redfinCache = new Map<
    string,
    { date: string; price: number } | null
  >();

  /** Sorted date index per Redfin geography */
  private readonly redfinDateIndex = new Map<string, string[]>();

  /** Realtor price data keyed by "geoType:geoId:date" */
  readonly realtorCache = new Map<
    string,
    { date: string; price: number } | null
  >();

  /** Sorted date index per Realtor geography */
  private readonly realtorDateIndex = new Map<string, string[]>();

  constructor(private readonly supabase: SupabaseService) {}

  clearAll(): void {
    this.benchmarkCache.clear();
    this.stateCodeCache.clear();
    this.historicalCache.clear();
    this.historicalDateIndex.clear();
    this.benchmarkDateIndex.clear();
    this.redfinCache.clear();
    this.redfinDateIndex.clear();
    this.realtorCache.clear();
    this.realtorDateIndex.clear();
  }

  /**
   * Look up historical data for the nearest date <= requested.
   * Returns undefined if the geo wasn't preloaded (caller should query DB).
   */
  lookupHistorical(
    geoType: GeographyType,
    geoId: string,
    requestedDate: string,
  ): HistoricalDataPoint[] | null | undefined {
    const exactKey = `${geoType}:${geoId}:${requestedDate}`;
    if (this.historicalCache.has(exactKey))
      return this.historicalCache.get(exactKey)!;

    const indexKey = `${geoType}:${geoId}`;
    const dates = this.historicalDateIndex.get(indexKey);
    if (!dates) return undefined; // Not preloaded — fall through to DB

    const nearestDate = this.binarySearchFloor(dates, requestedDate);
    if (!nearestDate) return null; // No data at or before requested date

    const cacheKey = `${geoType}:${geoId}:${nearestDate}`;
    return this.historicalCache.get(cacheKey) ?? null;
  }

  /**
   * Look up benchmark data for the nearest date <= requested.
   * Returns undefined if the benchmark wasn't preloaded.
   */
  lookupBenchmark(
    level: 'state' | 'national',
    code: string,
    requestedDate: string,
    metric: 'zhvi' | 'zori',
  ): BenchmarkData | null | undefined {
    const exactKey = `${level}:${code}:${requestedDate}:${metric}`;
    if (this.benchmarkCache.has(exactKey))
      return this.benchmarkCache.get(exactKey)!;

    const indexKey = `${level}:${code}:${metric}`;
    const dates = this.benchmarkDateIndex.get(indexKey);
    if (!dates) return undefined;

    const nearestDate = this.binarySearchFloor(dates, requestedDate);
    if (!nearestDate) return null;

    const cacheKey = `${level}:${code}:${nearestDate}:${metric}`;
    return this.benchmarkCache.get(cacheKey) ?? null;
  }

  /**
   * Look up Redfin price for the nearest date <= requested.
   * Returns undefined if the geo wasn't preloaded.
   */
  lookupRedfin(
    geoType: GeographyType,
    geoId: string,
    requestedDate: string,
  ): { date: string; price: number } | null | undefined {
    const exactKey = `${geoType}:${geoId}:${requestedDate}`;
    if (this.redfinCache.has(exactKey)) return this.redfinCache.get(exactKey)!;

    const indexKey = `${geoType}:${geoId}`;
    const dates = this.redfinDateIndex.get(indexKey);
    if (!dates) return undefined;

    const nearestDate = this.binarySearchFloor(dates, requestedDate);
    if (!nearestDate) return null;

    const cacheKey = `${geoType}:${geoId}:${nearestDate}`;
    return this.redfinCache.get(cacheKey) ?? null;
  }

  /**
   * Look up Realtor price for the nearest date <= requested.
   * Returns undefined if the geo wasn't preloaded.
   */
  lookupRealtor(
    geoType: GeographyType,
    geoId: string,
    requestedDate: string,
  ): { date: string; price: number } | null | undefined {
    const exactKey = `${geoType}:${geoId}:${requestedDate}`;
    if (this.realtorCache.has(exactKey))
      return this.realtorCache.get(exactKey)!;

    const indexKey = `${geoType}:${geoId}`;
    const dates = this.realtorDateIndex.get(indexKey);
    if (!dates) return undefined;

    const nearestDate = this.binarySearchFloor(dates, requestedDate);
    if (!nearestDate) return null;

    const cacheKey = `${geoType}:${geoId}:${nearestDate}`;
    return this.realtorCache.get(cacheKey) ?? null;
  }

  /** Binary search for the largest date <= target in a sorted array. */
  private binarySearchFloor(
    sortedDates: string[],
    target: string,
  ): string | null {
    let lo = 0;
    let hi = sortedDates.length - 1;
    let result: string | null = null;
    while (lo <= hi) {
      const mid = (lo + hi) >>> 1;
      if (sortedDates[mid] <= target) {
        result = sortedDates[mid];
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    return result;
  }

  /** Accumulate dates into a geo→Set<date> map during preloading. */
  addToDateIndex(
    map: Map<string, Set<string>>,
    key: string,
    date: string,
  ): void {
    let set = map.get(key);
    if (!set) {
      set = new Set<string>();
      map.set(key, set);
    }
    set.add(date);
  }

  /** Flush accumulated date sets into the appropriate sorted date index. */
  flushDateIndex(
    geoDateSets: Map<string, Set<string>>,
    target: 'historical' | 'benchmark' | 'redfin' | 'realtor',
  ): void {
    const indexMap =
      target === 'historical'
        ? this.historicalDateIndex
        : target === 'benchmark'
          ? this.benchmarkDateIndex
          : target === 'redfin'
            ? this.redfinDateIndex
            : this.realtorDateIndex;
    for (const [key, dates] of geoDateSets) {
      indexMap.set(key, [...dates].sort());
    }
  }

  /**
   * Bulk-load ALL state and national benchmark data (zhvi + zori).
   * Eliminates per-outcome benchmark queries entirely.
   */
  async preloadBenchmarkData(): Promise<number> {
    const client = this.supabase.getClient();
    let loaded = 0;
    const indexDateSets = new Map<string, Set<string>>();

    for (const metric of ['zhvi', 'zori'] as const) {
      let offset = 0;
      const pageSize = 1000;
      while (true) {
        const { data } = await client
          .from('zillow_state')
          .select('state_code, region_name, period_date, value')
          .eq('metric_name', metric)
          .range(offset, offset + pageSize - 1);

        if (!data || data.length === 0) break;

        for (const row of data) {
          const val =
            metric === 'zhvi' ? { zhvi: row.value } : { zori: row.value };
          const date = row.period_date as string;

          if (row.region_name === 'United States') {
            this.benchmarkCache.set(`national:US:${date}:${metric}`, val);
            this.addToDateIndex(indexDateSets, `national:US:${metric}`, date);
            loaded++;
          }
          if (row.state_code) {
            this.benchmarkCache.set(
              `state:${row.state_code}:${date}:${metric}`,
              val,
            );
            this.addToDateIndex(
              indexDateSets,
              `state:${row.state_code}:${metric}`,
              date,
            );
            loaded++;
          }
        }

        if (data.length < pageSize) break;
        offset += pageSize;
      }
    }

    this.flushDateIndex(indexDateSets, 'benchmark');

    this.logger.log(`Preloaded ${loaded} benchmark data points`);
    return loaded;
  }
}
