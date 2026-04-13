import { Injectable, Inject, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';
import { RedisLockService } from '../redis/redis-lock.service';

@Injectable()
export class SocialProofService {
  private readonly logger = new Logger(SocialProofService.name);

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly lockService: RedisLockService,
  ) {}

  async getStats(geoLevel: string, geoId: string) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000)
      .toISOString()
      .split('T')[0];

    const { data } = await this.supabase
      .from('market_engagement_stats')
      .select(
        'view_count, score_check_count, report_count, tracking_user_count',
      )
      .eq('geo_level', geoLevel)
      .eq('geo_id', geoId)
      .gte('date', thirtyDaysAgo);

    if (!data?.length)
      return { views: 0, scoreChecks: 0, reports: 0, tracking: 0 };

    return {
      views: data.reduce((sum, r) => sum + (r.view_count || 0), 0),
      scoreChecks: data.reduce((sum, r) => sum + (r.score_check_count || 0), 0),
      reports: data.reduce((sum, r) => sum + (r.report_count || 0), 0),
      tracking: Math.max(...data.map((r) => r.tracking_user_count || 0)),
    };
  }

  @Cron('0 2 * * *') // 2 AM UTC daily
  async aggregateDailyStats() {
    const lockAcquired = await this.lockService.acquireLock(
      'cron:social-proof-aggregate',
      300,
    );
    if (!lockAcquired) return;

    try {
      const yesterday = new Date(Date.now() - 86400000)
        .toISOString()
        .split('T')[0];
      const { data: events } = await this.supabase.rpc(
        'aggregate_market_engagement',
        { target_date: yesterday },
      );

      if (events?.length) {
        await this.supabase
          .from('market_engagement_stats')
          .upsert(events, { onConflict: 'geo_level,geo_id,date' });
      }

      this.logger.log(
        `Aggregated ${events?.length ?? 0} market stats for ${yesterday}`,
      );
    } finally {
      await this.lockService.releaseLock('cron:social-proof-aggregate');
    }
  }
}
