/**
 * SnapshotRecorderService
 *
 * Thin cron orchestrator. Schedules four snapshot jobs and delegates all
 * data-gathering and persistence logic to focused sub-services:
 *
 *   HealthSnapshotService  — data source freshness (every 5 min)
 *   CacheSnapshotService   — Redis hit/miss stats   (every 5 min)
 *   UserSnapshotService    — user/trial/tier counts (daily midnight UTC)
 *   ScoreSnapshotService   — score validation stats (daily 1 AM UTC)
 */

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SupabaseService } from '../../supabase/supabase.service';
import { HealthSnapshotService } from './health-snapshot.service';
import { CacheSnapshotService } from './cache-snapshot.service';
import { UserSnapshotService } from './user-snapshot.service';
import { ScoreSnapshotService } from './score-snapshot.service';

@Injectable()
export class SnapshotRecorderService {
  private readonly logger = new Logger(SnapshotRecorderService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly healthSnapshot: HealthSnapshotService,
    private readonly cacheSnapshot: CacheSnapshotService,
    private readonly userSnapshot: UserSnapshotService,
    private readonly scoreSnapshot: ScoreSnapshotService,
  ) {}

  // ---------------------------------------------------------------------------
  // Health Snapshots — every 5 minutes
  // ---------------------------------------------------------------------------

  @Cron(CronExpression.EVERY_5_MINUTES)
  async recordHealthSnapshots(): Promise<void> {
    try {
      const client = this.supabase.getClient();
      const rows = await this.healthSnapshot.buildHealthSnapshotRows(client);

      if (!rows.length) return;

      const { error } = await client
        .from('admin_health_snapshots')
        .insert(rows);

      if (error) {
        this.logger.error(`[HealthSnapshots] Insert failed: ${error.message}`);
      } else {
        this.logger.log(
          `[HealthSnapshots] Recorded ${rows.length} source snapshots`,
        );
      }
    } catch (err) {
      this.logger.error('[HealthSnapshots] Unexpected error', err);
    }
  }

  // ---------------------------------------------------------------------------
  // Cache Snapshots — every 5 minutes
  // ---------------------------------------------------------------------------

  @Cron(CronExpression.EVERY_5_MINUTES)
  async recordCacheSnapshots(): Promise<void> {
    try {
      const row = await this.cacheSnapshot.buildCacheSnapshotRow();
      const { error } = await this.supabase
        .getClient()
        .from('admin_cache_metrics')
        .insert(row);

      if (error) {
        this.logger.error(`[CacheSnapshots] Insert failed: ${error.message}`);
      } else {
        this.logger.log('[CacheSnapshots] Recorded cache metric snapshot');
      }
    } catch (err) {
      this.logger.error('[CacheSnapshots] Unexpected error', err);
    }
  }

  // ---------------------------------------------------------------------------
  // User Snapshots — daily at midnight UTC
  // ---------------------------------------------------------------------------

  @Cron('0 0 * * *')
  async recordUserSnapshots(): Promise<void> {
    try {
      const client = this.supabase.getClient();
      const row = await this.userSnapshot.buildUserSnapshotRow(client);

      const { error } = await client.from('admin_user_snapshots').insert(row);

      if (error) {
        this.logger.error(`[UserSnapshots] Insert failed: ${error.message}`);
      } else {
        this.logger.log('[UserSnapshots] Recorded daily user snapshot');
      }
    } catch (err) {
      this.logger.error('[UserSnapshots] Unexpected error', err);
    }
  }

  // ---------------------------------------------------------------------------
  // Score Snapshots — daily at 1 AM UTC
  // ---------------------------------------------------------------------------

  @Cron('0 1 * * *')
  async recordScoreSnapshots(): Promise<void> {
    try {
      const client = this.supabase.getClient();
      const rows = await this.scoreSnapshot.buildScoreSnapshotRows(client);

      const { error } = await client.from('admin_score_snapshots').insert(rows);

      if (error) {
        this.logger.error(`[ScoreSnapshots] Insert failed: ${error.message}`);
      } else {
        this.logger.log(
          `[ScoreSnapshots] Recorded ${rows.length} score type snapshots`,
        );
      }
    } catch (err) {
      this.logger.error('[ScoreSnapshots] Unexpected error', err);
    }
  }
}
