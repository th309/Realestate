import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { OverviewDataFetcherService } from './overview-data-fetcher.service';
import {
  aggregateSessionRows,
  buildMetricWithTrend,
  groupVisitorCountsByDate,
} from './utils/overview-session-aggregator';
import { AnalyticsFilters, OverviewData } from './user-analytics.types';

const CACHE_TTL_SECONDS = 300;
const SESSION_KPI_FIELDS =
  'visitor_id,duration_seconds,is_bounce,page_count,converted';

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
    const cacheKey = `analytics:overview:${days}:${JSON.stringify(filters)}`;

    const cached = await this.redis.getByKey(cacheKey);
    if (cached) {
      this.logger.log(`[OverviewAnalytics] Cache HIT for ${cacheKey}`);
      return cached as OverviewData;
    }

    const now = new Date();
    const currentStart = new Date(now.getTime() - days * 86400_000);
    const previousStart = new Date(currentStart.getTime() - days * 86400_000);

    const [
      kpis,
      sparklines,
      quickFunnel,
      topPages,
      activeUsersChart,
      annotations,
    ] = await Promise.all([
      this.buildKpis(currentStart, previousStart, filters),
      this.buildSparklines(currentStart, filters),
      this.fetcher.fetchQuickFunnelStageCounts(currentStart, filters),
      this.fetcher.fetchTopPages(currentStart, filters),
      this.buildActiveUsersChart(currentStart, filters),
      this.fetcher.fetchAnnotations(currentStart),
    ]);

    const result: OverviewData = {
      kpis,
      sparklines,
      quickFunnel,
      topPages,
      activeUsersChart,
      goalProgress: [],
      annotations,
    };

    await this.redis.setByKey(cacheKey, result, CACHE_TTL_SECONDS);
    return result;
  }

  // ── Private assembly helpers ─────────────────────────────────────────────────

  private async buildKpis(
    currentStart: Date,
    previousStart: Date,
    filters: AnalyticsFilters,
  ): Promise<OverviewData['kpis']> {
    const [currentRows, previousRows] = await Promise.all([
      this.fetcher.fetchSessionRows(
        currentStart,
        null,
        SESSION_KPI_FIELDS,
        filters,
      ),
      this.fetcher.fetchSessionRows(
        previousStart,
        currentStart,
        SESSION_KPI_FIELDS,
        filters,
      ),
    ]);

    const cur = aggregateSessionRows(currentRows);
    const prev = aggregateSessionRows(previousRows);

    return {
      uniqueVisitors: buildMetricWithTrend(
        cur.uniqueVisitors,
        prev.uniqueVisitors,
      ),
      totalSessions: buildMetricWithTrend(
        cur.totalSessions,
        prev.totalSessions,
      ),
      avgSessionDuration: buildMetricWithTrend(
        Math.round(cur.avgSessionDuration),
        Math.round(prev.avgSessionDuration),
      ),
      bounceRate: buildMetricWithTrend(
        Math.round(cur.bounceRate * 10000) / 10000,
        Math.round(prev.bounceRate * 10000) / 10000,
      ),
      pagesPerSession: buildMetricWithTrend(
        Math.round(cur.avgPagesPerSession * 100) / 100,
        Math.round(prev.avgPagesPerSession * 100) / 100,
      ),
      conversionRate: buildMetricWithTrend(
        Math.round(cur.conversionRate * 10000) / 10000,
        Math.round(prev.conversionRate * 10000) / 10000,
      ),
    };
  }

  private async buildSparklines(
    startDate: Date,
    filters: AnalyticsFilters,
  ): Promise<Record<string, number[]>> {
    const rows = await this.fetcher.fetchSessionRows(
      startDate,
      null,
      'visitor_id,started_at',
      filters,
    );
    const dailyCounts = groupVisitorCountsByDate(rows).map((p) => p.value);

    return {
      uniqueVisitors: dailyCounts,
      totalSessions: dailyCounts,
      avgSessionDuration: dailyCounts,
      bounceRate: dailyCounts,
      pagesPerSession: dailyCounts,
      conversionRate: dailyCounts,
    };
  }

  private async buildActiveUsersChart(
    startDate: Date,
    filters: AnalyticsFilters,
  ) {
    const rows = await this.fetcher.fetchSessionRows(
      startDate,
      null,
      'visitor_id,started_at',
      filters,
    );
    return groupVisitorCountsByDate(rows);
  }
}
