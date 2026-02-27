import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { RedisService } from '../redis/redis.service';
import type {
  JourneyData,
  AnalyticsFilters,
  NavigationFlow,
  PathSequence,
  LandingPageMetric,
  ExitPageMetric,
  DurationBucket,
  Annotation,
} from './user-analytics.types';
import {
  aggregateLandingPages,
  computeAvgPagesPerSession,
  bucketSessionDurations,
} from './journey-session-aggregators';

const CACHE_TTL_SECONDS = 900;

@Injectable()
export class JourneyAnalyticsService {
  private readonly logger = new Logger(JourneyAnalyticsService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly redis: RedisService,
  ) {}

  async getJourneys(
    days: number,
    filters: AnalyticsFilters,
  ): Promise<JourneyData> {
    const cacheKey = `analytics:journeys:${days}:${JSON.stringify(filters)}`;
    const cached = await this.redis.getByKey(cacheKey);
    if (cached) return cached as JourneyData;

    const startDate = new Date(Date.now() - days * 86400000).toISOString();
    const client = this.supabase.getClient();

    const [
      navigationFlows,
      { landingPages, avgPagesPerSession, sessionDurationDistribution },
      exitPages,
      commonPaths,
      annotations,
    ] = await Promise.all([
      this.fetchNavigationFlows(client, startDate, filters),
      this.fetchSessionAggregates(client, startDate, filters),
      this.fetchExitPages(client, startDate, filters),
      this.fetchCommonPaths(client, startDate, filters),
      this.fetchAnnotations(client, startDate),
    ]);

    const result: JourneyData = {
      navigationFlows,
      landingPages,
      exitPages,
      commonPaths,
      avgPagesPerSession,
      sessionDurationDistribution,
      annotations,
    };

    await this.redis.setByKey(cacheKey, result, CACHE_TTL_SECONDS);
    return result;
  }

  private async fetchNavigationFlows(
    client: ReturnType<SupabaseService['getClient']>,
    startDate: string,
    filters: AnalyticsFilters,
  ): Promise<NavigationFlow[]> {
    let query = client
      .from('user_events')
      .select('page_path, previous_page_path')
      .eq('event_category', 'pageview')
      .not('previous_page_path', 'is', null)
      .gte('created_at', startDate)
      .limit(5000);

    if (filters.tier) query = query.eq('user_tier', filters.tier);
    if (filters.device) query = query.eq('device_type', filters.device);

    const { data: flowEvents, error } = await query;
    if (error) {
      this.logger.error(
        `Failed to fetch navigation flow events: ${error.message}`,
      );
      return [];
    }

    const transitionCounts = new Map<string, number>();
    for (const row of flowEvents ?? []) {
      const key = `${row.previous_page_path}|||${row.page_path}`;
      transitionCounts.set(key, (transitionCounts.get(key) ?? 0) + 1);
    }

    return Array.from(transitionCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 50)
      .map(([key, transitions]) => {
        const [fromPage, toPage] = key.split('|||');
        return { fromPage, toPage, transitions };
      });
  }

  private async fetchSessionAggregates(
    client: ReturnType<SupabaseService['getClient']>,
    startDate: string,
    filters: AnalyticsFilters,
  ): Promise<{
    landingPages: LandingPageMetric[];
    avgPagesPerSession: number;
    sessionDurationDistribution: DurationBucket[];
  }> {
    let query = client
      .from('user_sessions')
      .select('landing_page, is_bounce, duration_seconds, page_count')
      .gte('started_at', startDate)
      .not('landing_page', 'is', null)
      .limit(5000);

    if (filters.tier) query = query.eq('user_tier', filters.tier);
    if (filters.device) query = query.eq('device_type', filters.device);

    const { data: sessions, error } = await query;
    if (error) {
      this.logger.error(
        `Failed to fetch sessions for aggregates: ${error.message}`,
      );
      return {
        landingPages: [],
        avgPagesPerSession: 0,
        sessionDurationDistribution: [],
      };
    }

    const rows = sessions ?? [];
    const landingPages = aggregateLandingPages(rows);
    const avgPagesPerSession = computeAvgPagesPerSession(rows);
    const sessionDurationDistribution = bucketSessionDurations(rows);

    return { landingPages, avgPagesPerSession, sessionDurationDistribution };
  }

  private async fetchExitPages(
    client: ReturnType<SupabaseService['getClient']>,
    startDate: string,
    filters: AnalyticsFilters,
  ): Promise<ExitPageMetric[]> {
    let query = client
      .from('user_sessions')
      .select('exit_page')
      .gte('started_at', startDate)
      .not('exit_page', 'is', null)
      .limit(5000);

    if (filters.tier) query = query.eq('user_tier', filters.tier);
    if (filters.device) query = query.eq('device_type', filters.device);

    const { data: exitData, error } = await query;
    if (error) {
      this.logger.error(`Failed to fetch exit pages: ${error.message}`);
      return [];
    }

    const exitCounts = new Map<string, number>();
    for (const row of exitData ?? []) {
      exitCounts.set(row.exit_page, (exitCounts.get(row.exit_page) ?? 0) + 1);
    }

    return Array.from(exitCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([page, exits]) => ({ page, exits }));
  }

  private async fetchCommonPaths(
    client: ReturnType<SupabaseService['getClient']>,
    startDate: string,
    filters: AnalyticsFilters,
  ): Promise<PathSequence[]> {
    let query = client
      .from('user_events')
      .select('session_id, page_path, created_at')
      .eq('event_category', 'pageview')
      .gte('created_at', startDate)
      .order('created_at', { ascending: true })
      .limit(10000);

    if (filters.tier) query = query.eq('user_tier', filters.tier);
    if (filters.device) query = query.eq('device_type', filters.device);

    const { data: pathEvents, error } = await query;
    if (error) {
      this.logger.error(`Failed to fetch path events: ${error.message}`);
      return [];
    }

    const sessionPages = new Map<string, string[]>();
    for (const row of pathEvents ?? []) {
      const pages = sessionPages.get(row.session_id) ?? [];
      pages.push(row.page_path);
      sessionPages.set(row.session_id, pages);
    }

    const prefixCounts = new Map<string, number>();
    for (const pages of sessionPages.values()) {
      const prefix = pages.slice(0, 3).join(' → ');
      prefixCounts.set(prefix, (prefixCounts.get(prefix) ?? 0) + 1);
    }

    return Array.from(prefixCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([prefix, sessions]) => ({
        path: prefix.split(' → '),
        sessions,
      }));
  }

  private async fetchAnnotations(
    client: ReturnType<SupabaseService['getClient']>,
    startDate: string,
  ): Promise<Annotation[]> {
    const { data, error } = await client
      .from('analytics_annotations')
      .select('id, annotation_date, label, description')
      .gte('annotation_date', startDate)
      .order('annotation_date', { ascending: true });

    if (error) {
      this.logger.warn(`Failed to fetch annotations: ${error.message}`);
      return [];
    }

    return (data ?? []).map((row) => ({
      id: row.id,
      annotationDate: row.annotation_date,
      label: row.label,
      description: row.description ?? undefined,
    }));
  }
}
