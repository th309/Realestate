/**
 * Outcome Data Source Service
 *
 * Handles all raw data access for the outcome generator pipeline:
 * - Historical price data with Zillow → Redfin → Realtor fallback
 * - Score lookups from propertyiq_scores (v2 schema)
 * - Geography-to-state-code resolution
 * - Benchmark data (state/national) for comparison
 *
 * Uses OutcomeCacheService for in-memory caching of repeated lookups.
 * Delegates rare DB fallback queries to OutcomeDbFallbackService.
 */

import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import type { ScoreType, GeographyType } from '../scoring.types';
import type {
  HistoricalDataPoint,
  BenchmarkData,
} from './outcome-generator.types';
import { OutcomeCacheService } from './outcome-cache.service';
import { OutcomeDbFallbackService } from './outcome-db-fallback.service';

@Injectable()
export class OutcomeDataSourceService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly cache: OutcomeCacheService,
    private readonly dbFallback: OutcomeDbFallbackService,
  ) {}

  async getHistoricalScore(
    geographyId: string,
    geographyType: GeographyType,
    scoreType: ScoreType,
    date: string,
  ): Promise<number | null> {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('propertyiq_scores')
      .select('score')
      .eq('location_id', geographyId)
      .eq('geography', geographyType)
      .eq('score_type', scoreType)
      .eq('score_date', date)
      .single();

    if (error || !data) return null;
    return data.score as number | null;
  }

  async getGeographiesWithScores(
    geographyType: GeographyType,
    scoreType: ScoreType,
    date: string,
    limit: number,
  ): Promise<Array<{ id: string }>> {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('propertyiq_scores')
      .select('location_id')
      .eq('geography', geographyType)
      .eq('score_type', scoreType)
      .eq('score_date', date)
      .not('score', 'is', null)
      .limit(limit);

    if (error || !data) return [];
    return data.map((d) => ({ id: d.location_id }));
  }

  /**
   * Get historical price data with multi-source fallback:
   * Zillow cache → Redfin cache → Realtor cache → DB fallback
   */
  async getHistoricalData(
    geographyId: string,
    geographyType: GeographyType,
    date: string,
  ): Promise<HistoricalDataPoint[] | null> {
    // 1. Try preloaded Zillow cache (includes both ZHVI and ZORI)
    const cached = this.cache.lookupHistorical(
      geographyType,
      geographyId,
      date,
    );
    if (cached !== undefined) {
      // Lazy-fill: mutates the cached HistoricalDataPoint in-place so subsequent
      // lookups for the same key benefit from the ACS result without re-querying.
      if (cached && cached[0] && cached[0].zori == null) {
        const acsRent = await this.dbFallback.getAcsRentData(
          geographyId,
          geographyType,
          date,
        );
        if (acsRent != null) {
          cached[0].zori = acsRent;
        }
      }
      return cached;
    }

    // 2. Not in Zillow cache — try Redfin cache
    const redfinCached = this.cache.lookupRedfin(
      geographyType,
      geographyId,
      date,
    );
    if (redfinCached !== undefined && redfinCached !== null) {
      const result: HistoricalDataPoint[] = [
        { date: redfinCached.date, zhvi: redfinCached.price, source: 'redfin' },
      ];
      // Backfill rent from ACS since Redfin has no rent data
      const acsRent = await this.dbFallback.getAcsRentData(
        geographyId,
        geographyType,
        date,
      );
      if (acsRent != null) {
        result[0].zori = acsRent;
      }
      this.cache.historicalCache.set(
        `${geographyType}:${geographyId}:${date}`,
        result,
      );
      return result;
    }

    // 3. Try Realtor cache
    const realtorCached = this.cache.lookupRealtor(
      geographyType,
      geographyId,
      date,
    );
    if (realtorCached !== undefined && realtorCached !== null) {
      const result: HistoricalDataPoint[] = [
        {
          date: realtorCached.date,
          zhvi: realtorCached.price,
          source: 'realtor',
        },
      ];
      // Backfill rent from ACS since Realtor has no rent data
      const acsRent = await this.dbFallback.getAcsRentData(
        geographyId,
        geographyType,
        date,
      );
      if (acsRent != null) {
        result[0].zori = acsRent;
      }
      this.cache.historicalCache.set(
        `${geographyType}:${geographyId}:${date}`,
        result,
      );
      return result;
    }

    // 4. All caches missed — fall back to individual DB queries
    return this.dbFallback.getHistoricalDataFromDb(
      geographyId,
      geographyType,
      date,
    );
  }

  async getStateCode(
    geographyId: string,
    geographyType: GeographyType,
  ): Promise<string | null> {
    const cacheKey = `${geographyType}:${geographyId}`;
    if (this.cache.stateCodeCache.has(cacheKey))
      return this.cache.stateCodeCache.get(cacheKey)!;

    const client = this.supabase.getClient();
    let result: string | null = null;

    switch (geographyType) {
      case 'metro': {
        const { data } = await client
          .from('zillow_metro')
          .select('state_code')
          .eq('cbsa_code', geographyId)
          .limit(1)
          .single();
        result = data?.state_code || null;
        break;
      }
      case 'county': {
        const { data } = await client
          .from('zillow_county')
          .select('state_code')
          .eq('fips_code', geographyId)
          .limit(1)
          .single();
        result = data?.state_code || null;
        break;
      }
      case 'zip': {
        const { data } = await client
          .from('zillow_zip')
          .select('state_code')
          .eq('region_name', geographyId)
          .limit(1)
          .single();
        result = data?.state_code || null;
        break;
      }
    }

    this.cache.stateCodeCache.set(cacheKey, result);
    return result;
  }

  async getBenchmarkData(
    level: 'state' | 'national',
    stateCode: string | null,
    date: string,
    metric: 'zhvi' | 'zori' = 'zhvi',
  ): Promise<BenchmarkData | null> {
    // Try preloaded cache with nearest-date matching
    const cached = this.cache.lookupBenchmark(
      level,
      stateCode ?? 'US',
      date,
      metric,
    );
    if (cached !== undefined) return cached;

    const client = this.supabase.getClient();
    const filter =
      level === 'national'
        ? { column: 'region_name', value: 'United States' }
        : stateCode
          ? { column: 'state_code', value: stateCode }
          : null;

    const bmCacheKey = `${level}:${stateCode ?? 'US'}:${date}:${metric}`;

    if (!filter) {
      this.cache.benchmarkCache.set(bmCacheKey, null);
      return null;
    }

    const { data, error } = await client
      .from('zillow_state')
      .select('value')
      .eq(filter.column, filter.value)
      .eq('metric_name', metric)
      .lte('period_date', date)
      .order('period_date', { ascending: false })
      .limit(1);

    let result: BenchmarkData | null = null;
    if (!error && data?.length) {
      result =
        metric === 'zhvi' ? { zhvi: data[0].value } : { zori: data[0].value };
    }

    this.cache.benchmarkCache.set(bmCacheKey, result);
    return result;
  }
}
