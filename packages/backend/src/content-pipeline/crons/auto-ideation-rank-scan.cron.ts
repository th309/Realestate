import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AutoIdeationService } from '../auto-ideation/auto-ideation.service';

@Injectable()
export class AutoIdeationRankScanCron {
  constructor(private readonly autoIdeation: AutoIdeationService) {}

  @Cron('0 5 * * *', { timeZone: 'UTC' })
  async run(): Promise<void> {
    await this.autoIdeation.runEnabledRules('rank_change');
  }
}

