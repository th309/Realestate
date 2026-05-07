import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { MetricsPullerService } from '../analytics/metrics-puller.service';

@Injectable()
export class Pull7dMetricsCron {
  private readonly logger = new Logger(Pull7dMetricsCron.name);

  constructor(private readonly puller: MetricsPullerService) {}

  @Cron('15 3 * * *', { timeZone: 'UTC' })
  async run(): Promise<void> {
    const count = await this.puller.pullWindow('7d');
    this.logger.log(`pulled 7d metrics for ${count} posts`);
  }
}

