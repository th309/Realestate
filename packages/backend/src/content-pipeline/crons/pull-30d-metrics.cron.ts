import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { MetricsPullerService } from '../analytics/metrics-puller.service';

@Injectable()
export class Pull30dMetricsCron {
  private readonly logger = new Logger(Pull30dMetricsCron.name);

  constructor(private readonly puller: MetricsPullerService) {}

  @Cron('30 3 * * *', { timeZone: 'UTC' })
  async run(): Promise<void> {
    const count = await this.puller.pullWindow('30d');
    this.logger.log(`pulled 30d metrics for ${count} posts`);
  }
}

