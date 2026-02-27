import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SupabaseService } from '../supabase/supabase.service';
import { RedisService } from '../redis/redis.service';
import { SessionManagerService } from './session-manager.service';

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

  @Cron('0 2 * * *') // 2 AM daily
  async dailyRollupJob() {
    try {
      const yesterday = new Date(Date.now() - 86400000);
      const dateStr = yesterday.toISOString().split('T')[0];
      const dayStart = `${dateStr}T00:00:00Z`;
      const dayEnd = `${dateStr}T23:59:59Z`;

      const client = this.supabase.getClient();

      // Compute metrics for yesterday
      const { data: sessions } = await client
        .from('user_sessions')
        .select('visitor_id, duration_seconds, is_bounce, page_count, converted, user_tier')
        .gte('started_at', dayStart)
        .lte('started_at', dayEnd);

      if (!sessions?.length) {
        this.logger.log(`No sessions for ${dateStr}, skipping rollup`);
        return;
      }

      const tiers = ['all', ...new Set(sessions.map((s) => s.user_tier || 'anonymous'))];
      const rows: {
        date: string;
        metric_name: string;
        dimension: string;
        user_tier: string;
        value: number;
      }[] = [];

      for (const tier of tiers) {
        const filtered =
          tier === 'all' ? sessions : sessions.filter((s) => (s.user_tier || 'anonymous') === tier);
        if (filtered.length === 0) continue;

        const uniqueVisitors = new Set(filtered.map((s) => s.visitor_id)).size;
        const totalSessions = filtered.length;
        const bounceRate = filtered.filter((s) => s.is_bounce).length / totalSessions;
        const avgDuration =
          filtered.reduce((sum, s) => sum + (s.duration_seconds || 0), 0) / totalSessions;
        const avgPages =
          filtered.reduce((sum, s) => sum + (s.page_count || 0), 0) / totalSessions;
        const conversionRate = filtered.filter((s) => s.converted).length / totalSessions;

        rows.push(
          {
            date: dateStr,
            metric_name: 'unique_visitors',
            dimension: 'all',
            user_tier: tier,
            value: uniqueVisitors,
          },
          {
            date: dateStr,
            metric_name: 'sessions',
            dimension: 'all',
            user_tier: tier,
            value: totalSessions,
          },
          {
            date: dateStr,
            metric_name: 'bounce_rate',
            dimension: 'all',
            user_tier: tier,
            value: bounceRate,
          },
          {
            date: dateStr,
            metric_name: 'avg_duration',
            dimension: 'all',
            user_tier: tier,
            value: avgDuration,
          },
          {
            date: dateStr,
            metric_name: 'avg_pages',
            dimension: 'all',
            user_tier: tier,
            value: avgPages,
          },
          {
            date: dateStr,
            metric_name: 'conversion_rate',
            dimension: 'all',
            user_tier: tier,
            value: conversionRate,
          },
        );
      }

      // Upsert daily_analytics
      const { error } = await client.from('daily_analytics').upsert(rows, {
        onConflict: 'date,metric_name,dimension,user_tier',
      });
      if (error) {
        this.logger.error(`Rollup upsert failed: ${error.message}`);
      } else {
        this.logger.log(`Daily rollup for ${dateStr}: ${rows.length} metrics computed`);
      }

      // Purge events older than 90 days
      const purgeDate = new Date(Date.now() - 90 * 86400000).toISOString();
      await client.from('user_events').delete().lt('created_at', purgeDate);

      // Clear analytics caches
      await this.redis.deleteByPrefix('analytics:');
      this.logger.log('Daily rollup complete');
    } catch (err) {
      this.logger.error('Daily rollup failed', err);
    }
  }
}
