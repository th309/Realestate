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
import { DEFAULT_TRAFFIC_SEGMENT } from './traffic-segment';
import {
  toCohortRows,
  buildTierCurves,
  type CohortRetentionRpcRow,
} from './retention-cohort-utils';

/**
 * Retention reads go through SQL aggregate functions, never through
 * `.select()` + aggregate-in-JS.
 *
 * Every panel here used to fetch session rows and reduce them in Node. PostgREST
 * caps an unranged `.select()` at 1,000 rows without erroring, so each number
 * was a correct calculation over a truncated population — DAU/WAU/MAU was
 * derived from at most 1,000 of ~48,000 trailing-30-day sessions, and the churn
 * list had no date predicate at all, so its 1,000 rows were an arbitrary slice
 * of all history. Aggregating server-side removes the failure mode rather than
 * raising the ceiling: there is no array left to truncate.
 */

const RETENTION_CACHE_TTL_SECONDS = 900;

/** Matrix width. Matches p_weeks in analytics_cohort_retention. */
const COHORT_WEEKS = 12;

/** A user is "at risk" once they have been silent this long. */
const CHURN_INACTIVE_DAYS = 14;

/** ...and only if they were engaged enough for the silence to mean something. */
const CHURN_MIN_SESSIONS = 3;

const CHURN_MAX_USERS = 100;

/**
 * Churn always looks back at least this far, regardless of the selected window.
 *
 * The window alone cannot bound it: on a 7-day view, "last seen more than 14
 * days ago" and "active in the last 7 days" have no overlap, so the panel would
 * be empty by construction rather than by evidence. A quarter comfortably spans
 * the inactivity threshold while still excluding accounts that went quiet years
 * ago — which the old unbounded scan was reporting as fresh churn signals.
 */
const CHURN_LOOKBACK_DAYS = 90;

const DAY_MS = 24 * 60 * 60 * 1000;

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
    // The traffic segment MUST be part of the key. It changes which population
    // DAU/WAU/MAU and the engagement trend describe, so sharing an entry across
    // segments would serve bot figures under a "human" label. The `v2` prefix
    // also strands entries written by the truncated implementation.
    const segment = filters.traffic ?? DEFAULT_TRAFFIC_SEGMENT;
    const cacheKey = `analytics:retention:v2:${days}:${segment}:${JSON.stringify(filters)}`;

    const cached = await this.redis.getByKey(cacheKey);
    if (cached) {
      this.logger.log(`[RetentionAnalytics] Cache HIT for key ${cacheKey}`);
      return cached as RetentionData;
    }

    const now = Date.now();
    const startDate = new Date(now - days * DAY_MS).toISOString();
    const churnStart = new Date(
      now - Math.max(days, CHURN_LOOKBACK_DAYS) * DAY_MS,
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
      this.detectChurnSignals(churnStart, filters),
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

  /**
   * The cohort RPC takes no traffic segment on purpose — it is scoped to
   * `user_id is not null` and a crawler never signs in. Passing `human` would
   * additionally drop every session written before bot classification existed
   * (`is_bot` NULL), which is most of the signed-in history.
   */
  private async fetchCohortRetention(
    startDate: string,
    filters: AnalyticsFilters,
    byTier: boolean,
  ): Promise<CohortRetentionRpcRow[]> {
    const { data, error } = await this.supabase
      .getClient()
      .rpc('analytics_cohort_retention', {
        p_start: startDate,
        p_tier: filters.tier ?? null,
        p_weeks: COHORT_WEEKS,
        p_by_tier: byTier,
      });

    if (error) {
      this.logger.error(
        `[RetentionAnalytics] Cohort retention rpc failed: ${error.message}`,
      );
      return [];
    }
    // Returns a single jsonb document rather than a row set, because the 1,000
    // row cap applies to table-returning RPCs too and this result grows with
    // (weeks x tiers) over an unbounded `days`.
    return (data ?? []) as CohortRetentionRpcRow[];
  }

  private async buildCohortMatrix(
    startDate: string,
    filters: AnalyticsFilters,
  ): Promise<CohortRow[]> {
    return toCohortRows(
      await this.fetchCohortRetention(startDate, filters, false),
    );
  }

  private async buildRetentionCurvesByTier(
    startDate: string,
    filters: AnalyticsFilters,
  ): Promise<{ tier: string; curve: number[] }[]> {
    return buildTierCurves(
      await this.fetchCohortRetention(startDate, filters, true),
    );
  }

  /**
   * Keyed on visitor_id, which is only meaningful once bots are excluded: a
   * crawler population runs ~1.00 sessions per visitor and never returns, so an
   * unsegmented MAU is a count of one-shot fetches. Hence the segment is a
   * first-class parameter here rather than a hardcoded `is_bot = false`.
   */
  private async computeDauWauMau(
    filters: AnalyticsFilters,
  ): Promise<RetentionData['dauWauMau']> {
    const { data, error } = await this.supabase
      .getClient()
      .rpc('analytics_active_users', {
        p_traffic: filters.traffic ?? DEFAULT_TRAFFIC_SEGMENT,
        p_tier: filters.tier ?? null,
      });

    if (error) {
      this.logger.error(
        `[RetentionAnalytics] Active users rpc failed: ${error.message}`,
      );
      return { dau: 0, wau: 0, mau: 0, stickiness: 0 };
    }

    const row = (data ?? [])[0] as Record<string, unknown> | undefined;
    return {
      dau: Number(row?.dau ?? 0),
      wau: Number(row?.wau ?? 0),
      mau: Number(row?.mau ?? 0),
      stickiness: Number(row?.stickiness ?? 0),
    };
  }

  private async detectChurnSignals(
    churnStart: string,
    filters: AnalyticsFilters,
  ): Promise<ChurnRiskUser[]> {
    const { data, error } = await this.supabase
      .getClient()
      .rpc('analytics_churn_risk_users', {
        p_start: churnStart,
        p_inactive_days: CHURN_INACTIVE_DAYS,
        p_min_sessions: CHURN_MIN_SESSIONS,
        p_tier: filters.tier ?? null,
        p_limit: CHURN_MAX_USERS,
      });

    if (error) {
      this.logger.error(
        `[RetentionAnalytics] Churn risk rpc failed: ${error.message}`,
      );
      return [];
    }

    return ((data ?? []) as Record<string, any>[]).map(
      (row): ChurnRiskUser => ({
        userId: String(row.user_id),
        // The whole point of this panel is deciding who to contact, and it
        // previously rendered a column of UUIDs. Undefined only when the auth
        // user row is gone (deleted account), which is still a churn signal —
        // the RPC left-joins so those rows survive rather than disappearing.
        email: row.email ?? undefined,
        lastSeen: row.last_seen,
        sessionCount: Number(row.session_count ?? 0),
        tier: row.tier ?? null,
        topFeatures: [],
      }),
    );
  }

  private async buildEngagementTrend(
    startDate: string,
    filters: AnalyticsFilters,
  ): Promise<TimeSeriesPoint[]> {
    // Same daily rollup the overview sparklines use. It was the sixth instance
    // of the truncated pattern, and it hardcoded `is_bot = false` where the rest
    // of the tab now honours the selected segment.
    const { data, error } = await this.supabase
      .getClient()
      .rpc('analytics_daily_visitors', {
        p_start: startDate,
        p_end: null,
        p_traffic: filters.traffic ?? DEFAULT_TRAFFIC_SEGMENT,
        p_tier: filters.tier ?? null,
      });

    if (error) {
      this.logger.error(
        `[RetentionAnalytics] Daily visitors rpc failed: ${error.message}`,
      );
      return [];
    }

    return ((data ?? []) as Record<string, any>[]).map(
      (row): TimeSeriesPoint => ({
        date: String(row.day),
        value: Number(row.visitors ?? 0),
      }),
    );
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
