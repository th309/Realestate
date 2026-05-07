import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { QueueMonitorService } from '../observability/queue-monitor.service';

@Injectable()
export class QueueMonitorCron {
  constructor(private readonly monitor: QueueMonitorService) {}

  @Cron('*/3 * * * *') // every 3 minutes
  async run(): Promise<void> {
    await this.monitor.sampleAll();
  }
}

