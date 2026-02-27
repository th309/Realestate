import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { RedisService } from '../redis/redis.service';
import type {
  RetentionData,
  AnalyticsFilters,
  CohortRow,
  ChurnRiskUser,
  TimeSeriesPoint,
  Annotation,
} from './user-analytics.types';
import {
  groupByCohortWeek,
  groupSessionsByUser,
  computeCohortRetentionRows,
  averageWeeklyCurveAcrossCohorts,
  applyTierFilterToIdentities,
  countUniqueVisitors,
  aggregateUserSessionStats,
} from './retention-cohort-utils';

const RETENTION_CACHE_TTL_SECONDS = 900;

@Injectable()
export class RetentionAnalyticsService {
  private readonly logger = new Logger(RetentionAnalyticsService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly redis: RedisService,
  ) {}

  async getRetention(
    days: number,
    filters: AnalyticsFilters,
  ): Promise<RetentionData> {
    const cacheKey = `analytics:retention:${days}:${JSON.stringify(filters)}`;
    const cached = await this.redis.getByKey(cacheKey);
    if (cached) {
      this.logger.log(`[RetentionAnalytics] Cache HIT for key ${cacheKey}`);
      return cached as RetentionData;
    }

    const startDate = new Date(
      Date.now() - days * 24 * 60 * 60 * 1000,
    ).toISOString();

    const [
      cohortMatrix,
      dauWauMau,
      retentionCurves,
      churnSignals,
      engagementTrend,
      annotations,
    ] = await Promise.all([
      this.buildCohortMatrix(startDate, filters),
      this.computeDauWauMau(filters),
      this.buildRetentionCurvesByTier(startDate, filters),
      this.detectChurnSignals(filters),
      this.buildEngagementTrend(startDate, filters),
      this.fetchAnnotations(startDate),
    ]);

    const result: RetentionData = {
      cohortMatrix,
      dauWauMau,
      retentionCurves,
      churnSignals,
      engagementTrend,
      annotations,
    };

    await this.redis.setByKey(cacheKey, result, RETENTION_CACHE_TTL_SECONDS);
    return result;
  }

  // ---------------------------------------------------------------------------
  // Private query methods
  // ---------------------------------------------------------------------------

  private async buildCohortMatrix(
    startDate: string,
    filters: AnalyticsFilters,
  ): Promise<CohortRow[]> {
    const client = this.supabase.getClient();

    const [{ data: identities }, { data: sessions }] = await Promise.all([
      client
        .from('visitor_identities')
        .select('user_id, signup_cohort')
        .gte('signup_cohort', startDate),
      client
        .from('user_sessions')
        .select('user_id, started_at, user_tier')
        .not('user_id', 'is', null)
        .gte('started_at', startDate),
    ]);

    if (!identities?.length) return [];

    const filteredIdentities = applyTierFilterToIdentities(
      identities,
      sessions ?? [],
      filters.tier,
    );
    const cohortMap = groupByCohortWeek(filteredIdentities);
    const sessionsByUser = groupSessionsByUser(sessions ?? []);
    return computeCohortRetentionRows(cohortMap, sessionsByUser);
  }

  private async computeDauWauMau(
    filters: AnalyticsFilters,
  ): Promise<RetentionData['dauWauMau']> {
    const client = this.supabase.getClient();
    const now = Date.now();

    const { data: sessions } = await client
      .from('user_sessions')
      .select('visitor_id, started_at, user_tier')
      .gte(
        'started_at',
        new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString(),
      );

    const rows = (sessions ?? []).filter(
      (s) => !filters.tier || s.user_tier === filters.tier,
    );

    const dau = countUniqueVisitors(
      rows,
      new Date(now - 1 * 24 * 60 * 60 * 1000).toISOString(),
    );
    const wau = countUniqueVisitors(
      rows,
      new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString(),
    );
    const mau = countUniqueVisitors(
      rows,
      new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString(),
    );
    const stickiness = mau > 0 ? parseFloat((dau / mau).toFixed(4)) : 0;

    return { dau, wau, mau, stickiness };
  }

  private async buildRetentionCurvesByTier(
    startDate: string,
    filters: AnalyticsFilters,
  ): Promise<{ tier: string; curve: number[] }[]> {
    const client = this.supabase.getClient();

    const [{ data: identities }, { data: sessions }] = await Promise.all([
      client
        .from('visitor_identities')
        .select('user_id, signup_cohort')
        .gte('signup_cohort', startDate),
      client
        .from('user_sessions')
        .select('user_id, started_at, user_tier')
        .not('user_id', 'is', null)
        .gte('started_at', startDate),
    ]);

    if (!identities?.length || !sessions?.length) return [];

    const typedSessions = sessions as {
      user_id: string;
      started_at: string;
      user_tier: string;
    }[];
    const tierSet = new Set(
      typedSessions
        .filter((s) => !filters.tier || s.user_tier === filters.tier)
        .map((s) => s.user_tier)
        .filter(Boolean),
    );
    const sessionsByUser = groupSessionsByUser(typedSessions);

    return Array.from(tierSet).map((tier) => {
      const tierUserIds = new Set(
        typedSessions.filter((s) => s.user_tier === tier).map((s) => s.user_id),
      );
      const tierIdentities = (
        identities as { user_id: string; signup_cohort: string }[]
      ).filter((i) => tierUserIds.has(i.user_id));
      const cohortMap = groupByCohortWeek(tierIdentities);
      const rows = computeCohortRetentionRows(cohortMap, sessionsByUser);
      return { tier, curve: averageWeeklyCurveAcrossCohorts(rows) };
    });
  }

  private async detectChurnSignals(
    filters: AnalyticsFilters,
  ): Promise<ChurnRiskUser[]> {
    const client = this.supabase.getClient();

    const { data: sessions } = await client
      .from('user_sessions')
      .select('user_id, user_tier, last_activity_at')
      .not('user_id', 'is', null);

    if (!sessions?.length) return [];

    const churnCutoff = new Date(
      Date.now() - 14 * 24 * 60 * 60 * 1000,
    ).toISOString();
    const userStats = aggregateUserSessionStats(
      sessions as {
        user_id: string;
        user_tier: string;
        last_activity_at: string;
      }[],
    );

    return Object.entries(userStats)
      .filter(([, stats]) => {
        return (
          stats.lastActivityAt < churnCutoff &&
          stats.sessionCount >= 3 &&
          (!filters.tier || stats.tier === filters.tier)
        );
      })
      .map(([userId, stats]) => ({
        userId,
        lastSeen: stats.lastActivityAt,
        sessionCount: stats.sessionCount,
        tier: stats.tier,
        topFeatures: [],
      }))
      .slice(0, 100);
  }

  private async buildEngagementTrend(
    startDate: string,
    filters: AnalyticsFilters,
  ): Promise<TimeSeriesPoint[]> {
    const client = this.supabase.getClient();

    const { data: sessions } = await client
      .from('user_sessions')
      .select('visitor_id, started_at, user_tier')
      .gte('started_at', startDate);

    if (!sessions?.length) return [];

    const filtered = (
      sessions as {
        visitor_id: string;
        started_at: string;
        user_tier: string;
      }[]
    ).filter((s) => !filters.tier || s.user_tier === filters.tier);

    const dailyVisitors: Record<string, Set<string>> = {};
    for (const session of filtered) {
      const date = session.started_at.slice(0, 10);
      if (!dailyVisitors[date]) dailyVisitors[date] = new Set();
      dailyVisitors[date].add(session.visitor_id);
    }

    return Object.entries(dailyVisitors)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, visitors]) => ({ date, value: visitors.size }));
  }

  private async fetchAnnotations(startDate: string): Promise<Annotation[]> {
    const client = this.supabase.getClient();

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
