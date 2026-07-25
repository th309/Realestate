import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PostPublisherService } from './post-publisher.service';

/**
 * Every minute, publishes posts whose scheduled_at has arrived. Thin wrapper
 * over PostPublisherService (mirrors crons/recover-stuck-runs.cron.ts idioms).
 *
 * A single in-flight guard skips a tick while the previous one is still running
 * — the DB status-flip claim already prevents double-posting; this just avoids
 * redundant overlapping scans. Only fires when RUN_CRONS=true (ScheduleModule is
 * gated app-wide via config/cron-schedule.imports.ts).
 */
@Injectable()
export class PublishSchedulerCron {
  private readonly logger = new Logger(PublishSchedulerCron.name);
  private running = false;

  constructor(private readonly publisher: PostPublisherService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async run(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const result = await this.publisher.runOnce();
      if (result.claimed > 0) {
        this.logger.log(
          `publish tick: ${result.published} published, ${result.failed} failed, ${result.claimed} claimed`,
        );
      }
    } catch (err) {
      this.logger.error('publish tick failed', err as Error);
    } finally {
      this.running = false;
    }
  }
}
