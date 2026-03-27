/**
 * MetricsCleanupService
 *
 * Weekly cron job (Sundays at 3 AM UTC) that prunes stale rows from
 * admin metrics tables according to the retention policy:
 *
 *   90-day retention (high-frequency data):
 *     - admin_api_metrics
 *     - admin_health_snapshots
 *     - admin_cache_metrics
 *
 *   1-year retention (event + daily data):
 *     - admin_alerts
 *     - admin_score_snapshots
 *     - admin_user_snapshots
 *     - admin_page_views
 *
 * Each table is pruned independently — one failure does not prevent
 * other tables from being cleaned up.
 */

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SupabaseService } from '../../supabase/supabase.service';

interface TableRetentionConfig {
  table: string;
  timestampColumn: string;
  retentionDays: number;
}

const NINETY_DAYS = 90;
const ONE_YEAR_DAYS = 365;

const RETENTION_POLICY: TableRetentionConfig[] = [
  // High-frequency tables — 90-day retention
  {
    table: 'admin_api_metrics',
    timestampColumn: 'timestamp',
    retentionDays: NINETY_DAYS,
  },
  {
    table: 'admin_health_snapshots',
    timestampColumn: 'timestamp',
    retentionDays: NINETY_DAYS,
  },
  {
    table: 'admin_cache_metrics',
    timestampColumn: 'timestamp',
    retentionDays: NINETY_DAYS,
  },
  // Event + daily tables — 1-year retention
  {
    table: 'admin_alerts',
    timestampColumn: 'triggered_at',
    retentionDays: ONE_YEAR_DAYS,
  },
  {
    table: 'admin_score_snapshots',
    timestampColumn: 'timestamp',
    retentionDays: ONE_YEAR_DAYS,
  },
  {
    table: 'admin_user_snapshots',
    timestampColumn: 'timestamp',
    retentionDays: ONE_YEAR_DAYS,
  },
  {
    table: 'admin_page_views',
    timestampColumn: 'timestamp',
    retentionDays: ONE_YEAR_DAYS,
  },
];

@Injectable()
export class MetricsCleanupService {
  private readonly logger = new Logger(MetricsCleanupService.name);

  constructor(private readonly supabase: SupabaseService) {}

  // ---------------------------------------------------------------------------
  // Weekly cleanup — Sundays at 3 AM UTC
  // ---------------------------------------------------------------------------

  @Cron('0 3 * * 0')
  async cleanup(): Promise<void> {
    this.logger.log('[MetricsCleanup] Starting weekly retention cleanup');

    for (const config of RETENTION_POLICY) {
      await this.pruneTable(config);
    }

    this.logger.log('[MetricsCleanup] Weekly retention cleanup complete');
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async pruneTable(config: TableRetentionConfig): Promise<void> {
    const { table, timestampColumn, retentionDays } = config;

    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - retentionDays);
      const cutoffIso = cutoff.toISOString();

      const { count, error } = await this.supabase
        .getClient()
        .from(table)
        .delete({ count: 'exact' })
        .lt(timestampColumn, cutoffIso);

      if (error) {
        this.logger.error(
          `[MetricsCleanup] Failed to prune ${table}: ${error.message}`,
        );
        return;
      }

      this.logger.log(
        `[MetricsCleanup] Pruned ${count ?? 0} rows from ${table} (cutoff: ${cutoffIso})`,
      );
    } catch (err) {
      this.logger.error(
        `[MetricsCleanup] Unexpected error pruning ${table}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
