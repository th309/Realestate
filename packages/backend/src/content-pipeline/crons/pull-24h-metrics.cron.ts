import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { MetricsPullerService } from '../analytics/metrics-puller.service';

/**
 * Runs once a day at 03:00 UTC and pulls the 24 hour metrics window for
 * every platform post published roughly a day ago. Anchoring to 03:00 UTC
 * keeps the work off the peak publishing hours in US/EU time zones.
 */
@Injectable()
export class Pull24hMetricsCron {
  private readonly logger = new Logger(Pull24hMetricsCron.name);

  constructor(private readonly puller: MetricsPullerService) {}

  @Cron('0 3 * * *', { timeZone: 'UTC' })
  async run(): Promise<void> {
    const count = await this.puller.pullWindow('24h');
    this.logger.log(`pulled 24h metrics for ${count} platform posts`);
  }
}
