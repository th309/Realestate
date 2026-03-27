/**
 * HeroStatsService
 *
 * Computes the five hero-stat cards shown on the admin dashboard:
 *   - system_health  — 30-day uptime % (snapshot -> live DB check)
 *   - active_alerts  — active alert counts by severity + 7d sparkline
 *   - data_freshness — fresh/total source counts (snapshot -> live check)
 *   - total_users    — user count + new-this-week (snapshot -> user_profiles)
 *   - score_health   — hit_rate_1y (snapshot -> backtest outcomes)
 *
 * Each card first checks its admin_* snapshot table. When the snapshot
 * table is empty (no cron has populated it yet), it falls back to a live
 * query against the real source tables. Fallback logic lives in
 * hero-stats-live-fallback.ts.
 *
 * All five queries run in parallel via Promise.allSettled; each has an
 * individual fallback so a single DB failure never breaks the whole row.
 */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { HeroStats } from '../admin-metrics.types';
import {
  buildDailySparkline,
  buildDailyCountSparkline,
} from './sparkline-utils';
import {
  fallbackUptimeStats,
  fallbackAlertStats,
  fallbackFreshnessStats,
  fallbackUserStats,
  fallbackScoreStats,
} from './hero-stats-live-fallback';

@Injectable()
export class HeroStatsService {
  private readonly logger = new Logger(HeroStatsService.name);

  async getHeroStats(client: SupabaseClient): Promise<HeroStats> {
    const [uptime, alerts, freshness, users, scores] = await Promise.allSettled(
      [
        this.getUptimeStats(client),
        this.getAlertStats(client),
        this.getFreshnessStats(client),
        this.getUserStats(client),
        this.getScoreStats(client),
      ],
    );

    return {
      system_health:
        uptime.status === 'fulfilled'
          ? uptime.value
          : { uptime_pct: 0, sparkline: [] },
      active_alerts:
        alerts.status === 'fulfilled'
          ? alerts.value
          : { count: 0, critical: 0, warning: 0, sparkline: [] },
      data_freshness:
        freshness.status === 'fulfilled'
          ? freshness.value
          : { fresh: 0, total: 0, sparkline: [] },
      total_users:
        users.status === 'fulfilled'
          ? users.value
          : { count: 0, new_this_week: 0, sparkline: [] },
      score_health:
        scores.status === 'fulfilled'
          ? scores.value
          : { hit_rate_1y: 0, sparkline: [] },
    };
  }

  // -------------------------------------------------------------------------
  // Private helpers — one per hero card
  // -------------------------------------------------------------------------

  private async getUptimeStats(
    client: SupabaseClient,
  ): Promise<HeroStats['system_health']> {
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const { data, error } = await client
      .from('admin_health_snapshots')
      .select('timestamp, available')
      .gte('timestamp', since.toISOString())
      .order('timestamp', { ascending: true });

    if (!error && data?.length) {
      const total = data.length;
      const availableCount = data.filter((r) => r.available).length;
      const uptime_pct = total > 0 ? (availableCount / total) * 100 : 0;
      const sparkline = buildDailySparkline(
        data as Array<{ timestamp: string; available: boolean }>,
        (r) => (r.available ? 100 : 0),
      );
      return { uptime_pct, sparkline };
    }

    this.logger.log('[getUptimeStats] Snapshot empty, using live fallback');
    return fallbackUptimeStats(client);
  }

  private async getAlertStats(
    client: SupabaseClient,
  ): Promise<HeroStats['active_alerts']> {
    const since = new Date();
    since.setDate(since.getDate() - 7);

    const { data, error } = await client
      .from('admin_alerts')
      .select('triggered_at, severity, resolved_at')
      .gte('triggered_at', since.toISOString());

    if (!error && data && data.length > 0) {
      const active = data.filter((r) => r.resolved_at === null);
      return {
        count: active.length,
        critical: active.filter((r) => r.severity === 'critical').length,
        warning: active.filter((r) => r.severity === 'warning').length,
        sparkline: buildDailyCountSparkline(
          data as Array<Record<string, unknown>>,
          'triggered_at',
          7,
        ),
      };
    }

    this.logger.log('[getAlertStats] Snapshot empty, using live fallback');
    return fallbackAlertStats(client, since);
  }

  private async getFreshnessStats(
    client: SupabaseClient,
  ): Promise<HeroStats['data_freshness']> {
    const since = new Date();
    since.setDate(since.getDate() - 7);

    const { data, error } = await client
      .from('admin_health_snapshots')
      .select('timestamp, source_name, fresh')
      .gte('timestamp', since.toISOString())
      .order('timestamp', { ascending: false });

    if (!error && data?.length) {
      const latestBySource = new Map<string, { fresh: boolean }>();
      for (const row of data) {
        if (!latestBySource.has(row.source_name)) {
          latestBySource.set(row.source_name, { fresh: row.fresh });
        }
      }
      const total = latestBySource.size;
      const fresh = Array.from(latestBySource.values()).filter(
        (r) => r.fresh,
      ).length;
      const sparkline = buildDailySparkline(
        data as Array<{ timestamp: string; fresh: boolean }>,
        (r) => (r.fresh ? 1 : 0),
      );
      return { fresh, total, sparkline };
    }

    this.logger.log('[getFreshnessStats] Snapshot empty, using live fallback');
    return fallbackFreshnessStats(client);
  }

  private async getUserStats(
    client: SupabaseClient,
  ): Promise<HeroStats['total_users']> {
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const { data, error } = await client
      .from('admin_user_snapshots')
      .select('timestamp, total_users, new_signups')
      .gte('timestamp', since.toISOString())
      .order('timestamp', { ascending: false });

    if (!error && data?.length) {
      const latest = data[0];
      const count = latest.total_users ?? 0;
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const new_this_week = data
        .filter((r) => new Date(r.timestamp) >= weekAgo)
        .reduce((acc, r) => acc + (r.new_signups ?? 0), 0);
      const sparkline = buildDailySparkline(
        data as Array<{ timestamp: string; total_users: number }>,
        (r) => r.total_users,
      );
      return { count, new_this_week, sparkline };
    }

    this.logger.log('[getUserStats] Snapshot empty, using live fallback');
    return fallbackUserStats(client);
  }

  private async getScoreStats(
    client: SupabaseClient,
  ): Promise<HeroStats['score_health']> {
    const since = new Date();
    since.setMonth(since.getMonth() - 12);

    const { data, error } = await client
      .from('admin_score_snapshots')
      .select('timestamp, hit_rate_1y')
      .gte('timestamp', since.toISOString())
      .order('timestamp', { ascending: false });

    if (!error && data?.length) {
      const latest = data[0];
      const hit_rate_1y = latest.hit_rate_1y ?? 0;
      const sparkline = buildDailySparkline(
        data as Array<{ timestamp: string; hit_rate_1y: number | null }>,
        (r) => r.hit_rate_1y,
      );
      return { hit_rate_1y, sparkline };
    }

    this.logger.log('[getScoreStats] Snapshot empty, using live fallback');
    return fallbackScoreStats(client);
  }
}
