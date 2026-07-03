import { Injectable, Inject, Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';
import { ScoringService } from '../scoring/scoring.service';
import { MetricResolutionService } from '../metric-resolution/metric-resolution.service';
import { RedisService } from '../redis/redis.service';
import { GeoType, MarketSnapshotResponse } from './market-snapshot.types';
import {
  fetchRealtor,
  fetchCensus,
  fetchEconomic,
  fetchCalculated,
  fetchPermits,
  logRejectedFetches,
} from './market-snapshot-fetchers.helper';
import { fetchZillow } from './market-snapshot-zillow-fetcher.helper';
import { ttlUntilNextRefresh } from './market-snapshot-ttl.helper';
import {
  SnapshotAccumulator,
  ToMetric,
  createAccumulator,
  makeToMetric,
  processRealtor,
  processZillow,
  applyHomeValueFallback,
  processScores,
} from './market-snapshot-assembler.helper';
import {
  processCensus,
  processEconomic,
  processCalculated,
  processPermits,
} from './market-snapshot-source-processors.helper';

// Backward-compat re-exports: these interfaces were originally declared here
// and are imported from this module path by consumers (e.g. content-data-adapters.ts).
export type {
  MarketSnapshotMetric,
  MarketSnapshotResponse,
} from './market-snapshot.types';

@Injectable()
export class MarketSnapshotService {
  private readonly logger = new Logger(MarketSnapshotService.name);

  /**
   * Seconds until the next monthly-pipeline refresh boundary. Thin static
   * delegate to the pure helper (see market-snapshot-ttl.helper.ts) so the
   * existing spec can keep calling it on the class.
   */
  static ttlUntilNextRefresh(now: Date = new Date()): number {
    return ttlUntilNextRefresh(now);
  }

  /**
   * De-dupes concurrent cold-cache builds for the same key, so a burst of
   * requests for one region triggers a single 7-source fan-out, not N. This is
   * the thundering-herd guard that matters after a deploy when caches are cold.
   */
  private readonly inflightSnapshots = new Map<
    string,
    Promise<MarketSnapshotResponse>
  >();

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly scoringService: ScoringService,
    private readonly metricResolution: MetricResolutionService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Public entry point: a Redis read-through cache around the expensive
   * 7-source snapshot build. Degrades gracefully when Redis is absent
   * (getByKey returns null, setByKey is a no-op — see RedisService), so local
   * dev without Redis behaves exactly as before, just uncached.
   */
  async getSnapshot(
    geoType: GeoType,
    geoId: string,
    state?: string,
  ): Promise<MarketSnapshotResponse> {
    const cacheKey = `snapshot:v1:${geoType}:${geoId}${
      state ? `:${state.toUpperCase()}` : ''
    }`;

    const cached = (await this.redis.getByKey(
      cacheKey,
    )) as MarketSnapshotResponse | null;
    if (cached) return cached;

    // Coalesce concurrent misses for the same key (cold-cache thundering herd).
    const inflight = this.inflightSnapshots.get(cacheKey);
    if (inflight) return inflight;

    const build = (async () => {
      const result = await this.buildSnapshot(geoType, geoId, state);
      const ttlSeconds = MarketSnapshotService.ttlUntilNextRefresh();
      const wrote = await this.redis.setByKey(cacheKey, result, ttlSeconds);
      // Logs only on a cold build (cache miss) AND only when the write actually
      // landed in Redis — so it never lies when Redis is absent (local/CI) or a
      // write silently fails. The sole way to confirm the refresh-aligned TTL
      // in prod, since setByKey is otherwise silent.
      if (wrote) {
        this.logger.log(
          `[Snapshot Cache] SET ${cacheKey} (TTL: ${ttlSeconds}s, expires ${new Date(
            Date.now() + ttlSeconds * 1000,
          ).toISOString()})`,
        );
      }
      return result;
    })();

    this.inflightSnapshots.set(cacheKey, build);
    try {
      return await build;
    } finally {
      this.inflightSnapshots.delete(cacheKey);
    }
  }

  private async buildSnapshot(
    geoType: GeoType,
    geoId: string,
    state?: string,
  ): Promise<MarketSnapshotResponse> {
    const acc = createAccumulator(`${geoType} ${geoId}`);
    const toMetric = makeToMetric(geoType, geoId);

    // Run all data source queries in parallel
    const [
      realtorResult,
      zillowResult,
      censusResult,
      economicResult,
      calcResult,
      permitsResult,
      scoresResult,
    ] = await Promise.allSettled([
      fetchRealtor(this.supabase, geoType, geoId),
      fetchZillow(this.supabase, this.logger, geoType, geoId),
      fetchCensus(this.supabase, geoType, geoId),
      fetchEconomic(this.supabase, geoType, geoId),
      fetchCalculated(this.supabase, geoType, geoId),
      geoType === 'county'
        ? fetchPermits(this.supabase, geoId)
        : Promise.resolve(null),
      this.fetchScores(geoType, geoId),
    ]);

    // Log any rejected promises for debugging
    logRejectedFetches(
      this.logger,
      [
        realtorResult,
        zillowResult,
        censusResult,
        economicResult,
        calcResult,
        permitsResult,
        scoresResult,
      ],
      geoType,
      geoId,
    );

    processRealtor(acc, realtorResult, toMetric);
    processZillow(acc, zillowResult, toMetric);

    // Fallbacks via centralized MetricResolutionService (source of truth: fallback-registry.ts)
    // home_sales: Zillow sales_count -> Realtor pending_listing_count
    // rent_index: Zillow ZORI -> HUD FMR (ZIP only) -> Census median_gross_rent
    await this.applyMetricResolutionFallbacks(acc, geoType, geoId, toMetric);

    processCensus(acc, censusResult, toMetric);
    applyHomeValueFallback(acc, censusResult, realtorResult, toMetric);
    processEconomic(acc, economicResult, toMetric);
    processCalculated(acc, calcResult, toMetric);
    processPermits(acc, permitsResult, toMetric);
    const scores = processScores(acc, scoresResult, toMetric);

    await this.enrichZipName(acc, geoType, geoId);

    return {
      success: true,
      geography: {
        id: geoId,
        name: acc.geographyName,
        type: geoType,
      },
      scores,
      metrics: acc.metrics,
      lastUpdated: acc.lastUpdated,
    };
  }

  private async applyMetricResolutionFallbacks(
    acc: SnapshotAccumulator,
    geoType: GeoType,
    geoId: string,
    toMetric: ToMetric,
  ): Promise<void> {
    const fallbackMetrics = ['home_sales', 'rent_index'].filter(
      (m) => !acc.metrics[m],
    );
    if (fallbackMetrics.length === 0) return;
    try {
      const resolved = await this.metricResolution.resolveMetricBatch(
        fallbackMetrics,
        geoType as any,
        geoId,
      );
      for (const metricId of fallbackMetrics) {
        const r = resolved[metricId];
        if (r?.value != null) {
          acc.metrics[metricId] = toMetric(r.value, r.date, r.source, {
            sourceGeoId: r.sourceGeoId,
            sourceGeoLevel: r.sourceGeoLevel,
            isInherited: r.isInherited,
            isFallback: r.isFallback,
          });
        }
      }
    } catch (e) {
      this.logger.warn(
        `MetricResolution fallback failed for ${geoType}/${geoId}: ${e}`,
      );
    }
  }

  // Enrich ZIP names: ensure we always show "City, ST" not just the ZIP code
  private async enrichZipName(
    acc: SnapshotAccumulator,
    geoType: GeoType,
    geoId: string,
  ): Promise<void> {
    if (geoType !== 'zip') return;
    if (acc.geographyName && acc.geographyName.includes(',')) return;
    const { data: cw } = await this.supabase
      .from('geography_crosswalk')
      .select('zip_default_city, zip_default_state')
      .eq('zip_code', geoId)
      .limit(1)
      .maybeSingle();
    if (cw?.zip_default_city && cw?.zip_default_state) {
      acc.geographyName = `${cw.zip_default_city}, ${cw.zip_default_state}`;
    }
  }

  private async fetchScores(geoType: GeoType, geoId: string): Promise<any> {
    try {
      return await this.scoringService.getScore(
        geoId,
        geoType as any,
        undefined,
        {
          components: true,
        },
      );
    } catch (e) {
      this.logger.warn(`Failed to fetch scores for ${geoType}/${geoId}: ${e}`);
      return null;
    }
  }
}
