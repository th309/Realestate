import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PostAutoSchedulerService } from '../scheduling/post-auto-scheduler.service';

/**
 * Safety net for auto-scheduling: every 10 minutes, gives a slot to any post
 * that is approved but still unscheduled.
 *
 * Approval normally schedules a post inline, so a healthy system finds nothing
 * here. This catches the cases that bypass that path — bulk approvals, posts
 * approved while a brand's kill switch was off and then switched back on, and
 * anything an earlier failure left behind — so no approved post can sit
 * unscheduled forever.
 *
 * An in-flight guard skips a tick while the previous one is still running; slot
 * assignment is serialized inside the service, so an overlapping tick would only
 * queue up behind it. Only fires when RUN_CRONS=true (ScheduleModule is gated
 * app-wide via config/cron-schedule.imports.ts).
 */
@Injectable()
export class AutoScheduleApprovedPostsCron {
  private readonly logger = new Logger(AutoScheduleApprovedPostsCron.name);
  private running = false;

  constructor(private readonly autoScheduler: PostAutoSchedulerService) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async run(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const result = await this.autoScheduler.sweep();
      if (result.scheduled > 0 || result.skipped > 0) {
        this.logger.log(
          `auto-schedule sweep: ${result.scheduled} scheduled, ${result.skipped} skipped of ${result.scanned} approved`,
        );
      }
    } catch (err) {
      this.logger.error(
        `auto-schedule sweep failed: ${(err as Error).message}`,
      );
    } finally {
      this.running = false;
    }
  }
}
