import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import {
  OverviewDataFetcherService,
  DailyPoint,
} from './overview-data-fetcher.service';
import { buildMetricWithTrend } from './utils/overview-session-aggregator';
import { AnalyticsFilters, OverviewData } from './user-analytics.types';
import { DEFAULT_TRAFFIC_SEGMENT } from './traffic-segment';

const CACHE_TTL_SECONDS = 300;

@Injectable()
export class OverviewAnalyticsService {
  private readonly logger = new Logger(OverviewAnalyticsService.name);

  constructor(
    private readonly fetcher: OverviewDataFetcherService,
    private readonly redis: RedisService,
  ) {}

  async getOverview(
    days: number,
    filters: AnalyticsFilters,
  ): Promise<OverviewData> {
    // The traffic segment MUST be part of the key. It changes which population
    // every number describes, so sharing a cache entry across segments would
    // serve bot figures under a "human" label.
    const segment = filters.traffic ?? DEFAULT_TRAFFIC_SEGMENT;
    const cacheKey = `analytics:overview:v2:${days}:${segment}:${JSON.stringify(filters)}`;

    const cached = await this.redis.getByKey(cacheKey);
    if (cached) {
      this.logger.log(`[OverviewAnalytics] Cache HIT for ${cacheKey}`);
      return cached as OverviewData;
    }

    const now = new Date();
    const currentStart = new Date(now.getTime() - days * 86400_000);
    const previousStart = new Date(currentStart.getTime() - days * 86400_000);

    const [
      current,
      previous,
      daily,
      trafficSegments,
      quickFunnel,
      topPages,
      annotations,
    ] = await Promise.all([
      this.fetcher.fetchKpis(currentStart, null, filters),
      this.fetcher.fetchKpis(previousStart, currentStart, filters),
      this.fetcher.fetchDailySeries(currentStart, filters),
      this.fetcher.fetchTrafficSegments(currentStart, null),
      this.fetcher.fetchQuickFunnelStageCounts(currentStart, filters),
      this.fetcher.fetchTopPages(currentStart, filters),
      this.fetcher.fetchAnnotations(currentStart),
    ]);

    const result: OverviewData = {
      kpis: {
        uniqueVisitors: buildMetricWithTrend(
          current?.unique_visitors ?? 0,
          previous?.unique_visitors ?? 0,
        ),
        totalSessions: buildMetricWithTrend(
          current?.total_sessions ?? 0,
          previous?.total_sessions ?? 0,
        ),
        avgSessionDuration: buildMetricWithTrend(
          Math.round(Number(current?.avg_session_duration ?? 0)),
          Math.round(Number(previous?.avg_session_duration ?? 0)),
        ),
        bounceRate: buildMetricWithTrend(
          Number(current?.bounce_rate ?? 0),
          Number(previous?.bounce_rate ?? 0),
        ),
        pagesPerSession: buildMetricWithTrend(
          Number(current?.pages_per_session ?? 0),
          Number(previous?.pages_per_session ?? 0),
        ),
        conversionRate: buildMetricWithTrend(
          Number(current?.conversion_rate ?? 0),
          Number(previous?.conversion_rate ?? 0),
        ),
      },
      sparklines: buildSparklines(daily),
      quickFunnel,
      topPages,
      activeUsersChart: daily.map((d) => ({
        date: String(d.day),
        value: Number(d.visitors),
      })),
      goalProgress: [],
      trafficSegments,
      annotations,
    };

    await this.redis.setByKey(cacheKey, result, CACHE_TTL_SECONDS);
    return result;
  }
}

/**
 * One series PER METRIC.
 *
 * Previously a single daily-unique-visitor array was assigned to all six keys,
 * so the sparkline under "Bounce Rate" was a visitor count and every tile drew
 * an identical shape. Only three of the six are genuinely available per day
 * from a session rollup; the other two are derived, and conversion is left flat
 * rather than faked — a sparkline that invents a trend is worse than none.
 */
function buildSparklines(daily: DailyPoint[]): Record<string, number[]> {
  return {
    uniqueVisitors: daily.map((d) => Number(d.visitors)),
    totalSessions: daily.map((d) => Number(d.sessions)),
    avgSessionDuration: daily.map((d) => Number(d.avg_duration)),
    bounceRate: daily.map((d) => Number(d.bounce_rate)),
    pagesPerSession: daily.map((d) => Number(d.pages_per_session)),
    // Left empty on purpose. Conversions are counted from signup_complete
    // events, not sessions, and at ~8 a month a daily series is all zeros with
    // occasional spikes — a sparkline that implies a trend it cannot support.
    conversionRate: [],
  };
}
