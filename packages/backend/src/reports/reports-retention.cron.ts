/**
 * ReportsRetentionCron
 *
 * Two safety nets for the `reports` table:
 *
 * 1. Stuck-report recovery. Report generation is fire-and-forget inside the
 *    API process (`ReportsService.generateReport` does not await the
 *    pipeline), so a crash, deploy, or restart mid-run strands the row at
 *    status='generating' forever — and the viewer replays the generation
 *    progress screen every time that report is reopened, which reads as
 *    "reopening regenerates my report". No pipeline survives a process
 *    restart, so any report still 'generating' after
 *    STUCK_GENERATING_TIMEOUT_MINUTES is unrecoverable and is marked
 *    'failed' with a user-facing message. Runs shortly after boot and every
 *    15 minutes. The age threshold (rather than fail-all-at-boot) keeps this
 *    deploy-safe: during blue-green overlap the outgoing instance may
 *    legitimately still be generating.
 *
 * 2. 90-day retention. Reports are stored for REPORT_RETENTION_DAYS from
 *    creation, then purged daily. Child rows clean up via FKs:
 *    report_conversations, saved_insights and report_follow_up_alerts are
 *    ON DELETE CASCADE; user_alerts.source_report_id is ON DELETE SET NULL.
 *
 * @Cron firing is gated by RUN_CRONS==='true' (config/cron-schedule.imports.ts
 * registers ScheduleModule globally). The delayed boot scan runs on every
 * backend boot regardless — any boot is an opportunity to clear dead rows.
 */

import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';

export const STUCK_GENERATING_TIMEOUT_MINUTES = 30;
export const REPORT_RETENTION_DAYS = 90;

/** Shown in the viewer's failed state when a generation died with the process. */
export const STUCK_GENERATION_ERROR_MESSAGE =
  'Report generation was interrupted before it could finish. Please generate a new report.';

@Injectable()
export class ReportsRetentionCron implements OnModuleInit {
  private readonly logger = new Logger(ReportsRetentionCron.name);

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  onModuleInit(): void {
    // Delayed so the scan never competes with application boot (same idiom as
    // content-pipeline's RecoverStuckRunsCron).
    setTimeout(() => {
      this.failStuckReports().catch((err) =>
        this.logger.error('boot-time stuck-report scan failed', err),
      );
    }, 60_000);
  }

  @Cron('*/15 * * * *')
  async failStuckReports(): Promise<void> {
    try {
      const cutoffIso = new Date(
        Date.now() - STUCK_GENERATING_TIMEOUT_MINUTES * 60_000,
      ).toISOString();

      const { count, error } = await this.supabase
        .from('reports')
        .update(
          {
            status: 'failed',
            error_message: STUCK_GENERATION_ERROR_MESSAGE,
          },
          { count: 'exact' },
        )
        .eq('status', 'generating')
        .lt('created_at', cutoffIso);

      if (error) {
        this.logger.error(`stuck-report scan failed: ${error.message}`);
        return;
      }
      if (count) {
        this.logger.warn(
          `marked ${count} report(s) failed after >${STUCK_GENERATING_TIMEOUT_MINUTES} min stuck in 'generating'`,
        );
      }
    } catch (err) {
      this.logger.error(
        `stuck-report scan threw: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  @Cron('30 3 * * *', { timeZone: 'UTC' })
  async purgeExpiredReports(): Promise<void> {
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - REPORT_RETENTION_DAYS);
      const cutoffIso = cutoff.toISOString();

      const { count, error } = await this.supabase
        .from('reports')
        .delete({ count: 'exact' })
        .lt('created_at', cutoffIso);

      if (error) {
        this.logger.error(`report retention purge failed: ${error.message}`);
        return;
      }
      this.logger.log(
        `report retention purge complete: removed ${count ?? 0} report(s) older than ${REPORT_RETENTION_DAYS} days (cutoff ${cutoffIso})`,
      );
    } catch (err) {
      this.logger.error(
        `report retention purge threw: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
