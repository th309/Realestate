import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InsightsMetricsPullService } from './insights-metrics.pull.service';

/**
 * Daily pull of per-post metrics from Late into analytics_snapshots. Thin
 * wrapper over InsightsMetricsPullService with an in-flight guard. Only fires
 * when RUN_CRONS=true (ScheduleModule is gated app-wide) and no-ops without
 * LATE_API_KEY.
 */
@Injectable()
export class InsightsMetricsCron {
  private readonly logger = new Logger(InsightsMetricsCron.name);
  private running = false;

  constructor(private readonly pull: InsightsMetricsPullService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async run(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const result = await this.pull.pullAll();
      if (result.captured > 0 || result.failed > 0) {
        this.logger.log(
          `insights pull: ${result.captured} captured, ${result.failed} failed`,
        );
      }
    } catch (err) {
      this.logger.error('insights pull tick failed', err as Error);
    } finally {
      this.running = false;
    }
  }
}
