import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SuccessRateService } from '../analytics/success-rate.service';

@Injectable()
export class SuccessRateCheckCron {
  constructor(private readonly svc: SuccessRateService) {}

  @Cron('0 5 * * *', { timeZone: 'UTC' }) // daily 5am UTC
  async run(): Promise<void> {
    await this.svc.checkAll();
  }
}

