import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SupabaseService } from '../supabase/supabase.service';
import { RedisService } from '../redis/redis.service';
import { SessionManagerService } from './session-manager.service';

/** One year. The Visitors tab reconstructs journeys from user_events. */
const EVENT_RETENTION_DAYS = 365;
const PURGE_BATCH_SIZE = 20000;
/** Caps a single night's purge; the rest waits for tomorrow. */
const MAX_PURGE_BATCHES = 25;

@Injectable()
export class DailyRollupService {
  private readonly logger = new Logger(DailyRollupService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly redis: RedisService,
    private readonly sessionManager: SessionManagerService,
  ) {}

  @Cron('*/15 * * * *') // Every 15 minutes
  async closeStaleSessionsJob() {
    try {
      await this.sessionManager.closeStaleSessions();
    } catch (err) {
      this.logger.error('Failed to close stale sessions', err);
    }
  }

  /**
   * Resolve sessions that never earned a human verdict.
   *
   * Ingestion writes `true` (self-identified crawler) or NULL (unknown) and
   * never `false` — nothing observable at insert proves a human, since duration
   * is 0 for everyone at that moment. `false` is earned afterwards from a second
   * heartbeat, a deliberate interaction, a second pageview, a login or a signup.
   * A session that produces none of those is a one-shot hit, not a pending one,
   * and without this it would sit NULL forever and quietly inflate the
   * unclassified bucket.
   *
   * The whole decision runs inside SQL. Doing it in Node would mean selecting
   * the candidate sessions first, which is the 1,000-row PostgREST truncation
   * that made every number on this dashboard wrong in the first place.
   *
   * Idempotent — only NULL rows are in scope, so a second run inside the same
   * window changes nothing. It is also bounded to sessions written after the 5s
   * early heartbeat shipped: before that, a real visitor leaving inside the 30s
   * cadence was indistinguishable from a crawler, so those stay unclassified
   * rather than being guessed at.
   */
  @Cron('*/20 * * * *') // Every 20 minutes
  async sweepUnclassifiedSessionsJob() {
    try {
      const { data, error } = await this.supabase
        .getClient()
        .rpc('analytics_sweep_unclassified_sessions', {
          p_older_than_minutes: 30,
        });

      if (error) {
        this.logger.error(
          `Traffic classification sweep failed: ${error.message}`,
        );
        return;
      }

      const row = data?.[0] as
        | { sessions_swept: number; events_swept: number }
        | undefined;

      // Only log when it did something. A silent no-op every 20 minutes is
      // noise; a sudden large sweep is worth seeing in the logs.
      if (row && Number(row.sessions_swept) > 0) {
        this.logger.log(
          `Traffic classification sweep resolved ${row.sessions_swept} sessions, ${row.events_swept} events`,
        );
      }
    } catch (err) {
      this.logger.error('Traffic classification sweep threw', err);
    }
  }

  @Cron('0 2 * * *') // 2 AM daily
  async dailyRollupJob() {
    const yesterday = new Date(Date.now() - 86400000);
    const dateStr = yesterday.toISOString().split('T')[0];

    try {
      await this.rollUpDay(dateStr);
    } catch (err) {
      this.logger.error(`Daily rollup failed for ${dateStr}`, err);
    }

    // Retention and cache invalidation are INDEPENDENT of the rollup. They used
    // to sit after an early `return` that fired whenever the rollup produced no
    // rows, so a zero-session day — or a day where every tier errored — silently
    // skipped the purge and left every analytics cache stale.
    try {
      await this.purgeExpiredEvents();
    } catch (err) {
      this.logger.error('Event retention purge failed', err);
    }

    try {
      await this.redis.deleteByPrefix('analytics:');
    } catch (err) {
      this.logger.error('Analytics cache clear failed', err);
    }
  }

  /**
   * Aggregate one day into daily_analytics, all-or-nothing.
   *
   * A per-tier failure used to `continue`, so the job upserted whatever
   * succeeded and logged "N metrics computed" with no sign the day was partial.
   * That is the same defect the SQL rewrite removed — a truncated day persisted
   * as if complete, and `daily_analytics` feeds a Parquet export, so it outlives
   * the cause. Any tier failing now aborts the whole day; a retry can redo it
   * because the upsert is keyed on (date, metric_name, dimension, user_tier).
   */
  private async rollUpDay(dateStr: string): Promise<void> {
    const client = this.supabase.getClient();
    const dayStart = `${dateStr}T00:00:00Z`;
    // Exclusive upper bound at the NEXT day's midnight. `T23:59:59Z` against the
    // RPC's `started_at < p_end` silently dropped every session in the final
    // second of the day.
    const dayEnd = new Date(Date.parse(dayStart) + 86400000).toISOString();

    const { data: tierRows, error: tierError } = await client.rpc(
      'analytics_active_tiers',
      { p_start: dayStart, p_end: dayEnd, p_traffic: 'human' },
    );

    if (tierError) {
      throw new Error(`Tier enumeration failed: ${tierError.message}`);
    }

    // Discovered, not hardcoded: user_tier is unvalidated client-supplied text,
    // so a fixed list makes the per-tier rows disagree with the 'all' row the
    // moment a new tier appears.
    const tiers = [
      'all',
      ...((tierRows ?? []) as { user_tier: string }[]).map((r) => r.user_tier),
    ];

    const rows: {
      date: string;
      metric_name: string;
      dimension: string;
      user_tier: string;
      value: number;
    }[] = [];

    for (const tier of tiers) {
      const { data, error } = await client.rpc('analytics_overview_kpis', {
        p_start: dayStart,
        p_end: dayEnd,
        // Real customer traffic only: bots AND our own browsing excluded.
        p_traffic: 'human',
        p_tier: tier === 'all' ? null : tier,
        p_device: null,
      });

      if (error) {
        throw new Error(`KPI rpc failed for tier ${tier}: ${error.message}`);
      }

      const k = data?.[0] as Record<string, number> | undefined;
      if (!k || Number(k.total_sessions ?? 0) === 0) continue;

      const metrics: [string, number][] = [
        ['unique_visitors', Number(k.unique_visitors ?? 0)],
        ['sessions', Number(k.total_sessions ?? 0)],
        ['bounce_rate', Number(k.bounce_rate ?? 0)],
        ['avg_duration', Number(k.avg_session_duration ?? 0)],
        ['avg_pages', Number(k.pages_per_session ?? 0)],
        ['conversion_rate', Number(k.conversion_rate ?? 0)],
      ];

      for (const [metric_name, value] of metrics) {
        rows.push({
          date: dateStr,
          metric_name,
          dimension: 'all',
          user_tier: tier,
          value,
        });
      }
    }

    if (rows.length === 0) {
      this.logger.log(`No human sessions for ${dateStr}, nothing to roll up`);
      return;
    }

    const { error } = await client.from('daily_analytics').upsert(rows, {
      onConflict: 'date,metric_name,dimension,user_tier',
    });

    if (error) {
      throw new Error(`Rollup upsert failed: ${error.message}`);
    }

    this.logger.log(
      `Daily rollup for ${dateStr}: ${rows.length} metrics across ${tiers.length} tiers`,
    );
  }

  /**
   * Delete events past the retention window, in batches.
   *
   * Retention is ONE YEAR. It was 90 days, set by a cleanup job nobody revisited
   * — which quietly capped how far the Visitors tab can reconstruct a person's
   * journey, since that view is built entirely from user_events.
   *
   * Batched because a single unbounded DELETE over a backlog runs past
   * PostgREST's 60s gateway timeout, rolls back, and retries the same work
   * forever making no progress. The previous call also discarded its result
   * entirely, so a failing purge and a purge with nothing to do were
   * indistinguishable.
   */
  private async purgeExpiredEvents(): Promise<void> {
    const client = this.supabase.getClient();
    let total = 0;

    // Bounded so a pathological backlog cannot run the job indefinitely; the
    // remainder is picked up by the next night's run.
    for (let pass = 0; pass < MAX_PURGE_BATCHES; pass++) {
      const { data, error } = await client.rpc('analytics_purge_old_events', {
        p_retain_days: EVENT_RETENTION_DAYS,
        p_batch_limit: PURGE_BATCH_SIZE,
      });

      if (error) {
        throw new Error(`Purge batch failed: ${error.message}`);
      }

      const deleted = Number(data ?? 0);
      total += deleted;
      if (deleted < PURGE_BATCH_SIZE) break;
    }

    if (total > 0) {
      this.logger.log(
        `Purged ${total} events older than ${EVENT_RETENTION_DAYS} days`,
      );
    }
  }
}
