import { Injectable, Inject, Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';
import { ScopeQueryDto } from './market-explorer.dto';
import { ScopeSeriesResponse } from './market-explorer.types';
import { resolveChildRegionsWithCount } from './resolve-child-regions';
import { resolveNearbyRegions } from './resolve-nearby-regions';
import { fetchMetricSeriesForRegions } from './fetch-metric-series';
import { fetchStateMetricSeries } from './fetch-state-series';
import { stateRegions } from './us-states';
import { alignAndMergeMetrics } from './merge-metric-series';
import { FETCHED_METRICS } from './market-explorer-metrics';
import { RedisService } from '../redis/redis.service';
import { ttlUntilNextRefresh } from '../market-snapshot/market-snapshot-ttl.helper';

/** First-of-month ISO string `months` months back from today (inclusive window start). */
function windowStart(months: number): string {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - (months - 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

@Injectable()
export class MarketExplorerService {
  private readonly logger = new Logger(MarketExplorerService.name);

  /** De-dupes concurrent cold-cache builds for the same key. Mirrors MarketSnapshotService's inflightSnapshots guard. */
  private readonly inflightScopes = new Map<
    string,
    Promise<ScopeSeriesResponse>
  >();

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly redis: RedisService,
  ) {}

  /**
   * Public entry point: a Redis read-through cache around the expensive
   * multi-metric scope build. Degrades gracefully when Redis is absent.
   */
  async getScopeSeries(
    geoLevel: string,
    dto: ScopeQueryDto,
  ): Promise<ScopeSeriesResponse> {
    const cacheKey = `market-explorer:v2:${geoLevel}:${dto.parentLevel ?? ''}:${dto.parentId ?? ''}:${!!dto.includeNearby}`;

    const cached = (await this.redis.getByKey(
      cacheKey,
    )) as ScopeSeriesResponse | null;
    if (cached) return cached;

    const inflight = this.inflightScopes.get(cacheKey);
    if (inflight) return inflight;

    const build = (async () => {
      const result = await this.buildScopeSeries(geoLevel, dto);
      const ttlSeconds = ttlUntilNextRefresh();
      const wrote = await this.redis.setByKey(cacheKey, result, ttlSeconds);
      if (wrote) {
        this.logger.log(
          `[Scope Cache] SET ${cacheKey} (TTL: ${ttlSeconds}s, expires ${new Date(Date.now() + ttlSeconds * 1000).toISOString()})`,
        );
      }
      return result;
    })();

    this.inflightScopes.set(cacheKey, build);
    try {
      return await build;
    } finally {
      this.inflightScopes.delete(cacheKey);
    }
  }

  private async buildScopeSeries(
    geoLevel: string,
    dto: ScopeQueryDto,
  ): Promise<ScopeSeriesResponse> {
    const startDate = windowStart(dto.months);

    let regions;
    let totalAvailable: number | undefined;
    if (geoLevel === 'state') {
      regions = stateRegions();
    } else {
      const resolved = await resolveChildRegionsWithCount(
        this.supabase,
        geoLevel,
        dto.parentLevel,
        dto.parentId,
        !!dto.includeNearby,
      );
      regions = resolved.regions;
      if (resolved.totalAvailable > regions.length)
        totalAvailable = resolved.totalAvailable;
      if (dto.includeNearby) {
        const nearby = await resolveNearbyRegions(
          this.supabase,
          geoLevel,
          dto.parentLevel,
          dto.parentId,
        );
        const have = new Set(regions.map((r) => r.id));
        regions = [...regions, ...nearby.filter((n) => !have.has(n.id))];
      }
    }

    const regionIds = regions.map((r) => r.id);
    const perMetric = await Promise.all(
      FETCHED_METRICS.map(async (metric) => ({
        metric,
        rows:
          geoLevel === 'state'
            ? await fetchStateMetricSeries(this.supabase, metric, startDate)
            : await fetchMetricSeriesForRegions(
                this.supabase,
                metric,
                geoLevel,
                regionIds,
                startDate,
              ),
      })),
    );

    const { dates, series } = alignAndMergeMetrics(perMetric, dto.months);
    return {
      success: true,
      geoLevel,
      months: dto.months,
      dates,
      regions,
      series,
      ...(totalAvailable != null ? { totalAvailable } : {}),
    };
  }
}
